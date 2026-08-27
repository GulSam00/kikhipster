"""iTunes 배치 조회 앞에 두는 DB 캐시.

왜 필요한가: 탑스터 카드 한 장이 최대 25칸, 목록 한 페이지가 30장이면 커버 URL을 알아내려고
iTunes를 수백 개 ID만큼 두드리게 된다. 그런데 "앨범 1097861387의 커버 URL"은 사실상 바뀌지
않는 값이다. 매번 물어볼 이유가 없어 답을 DB에 적어둔다.

캐싱하는 것: 메타데이터(제목·아티스트·커버 URL 등). 이미지 바이트가 아니다 —
커버는 mzstatic이 호스팅하므로 브라우저가 직접 받아가면 되고, 우리가 다시 서빙하면
스토리지와 대역폭만 떠안는다.
"""
from __future__ import annotations

import logging
from datetime import datetime, timedelta

from sqlalchemy import or_
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models.music_cache import MusicCache

logger = logging.getLogger(__name__)

# 릴리스된 앨범/트랙의 메타데이터는 사실상 불변이라 길게 잡아도 된다.
# 그래도 무한은 아니다 — 아트워크 경로가 갈리거나 우리 매핑 로직이 바뀔 수 있다.
CACHE_TTL_DAYS = 30

# "iTunes에 없다"도 캐싱한다(payload NULL). 안 하면 안 풀리는 ID 하나 때문에
# 매 요청마다 iTunes를 다시 두드린다 — 검색은 돌려주는데 lookup으로는 안 풀리는
# 앨범 ID가 실제로 존재한다(1508421225, 754383858 등에서 확인).
# 다만 '없음'은 '있음'보다 뒤집힐 여지가 크므로(재등록 등) TTL을 짧게 둔다.
MISSING_TTL_DAYS = 1

# 단건 조회 경로(아티스트 상세, 앨범 트랙 등)의 TTL.
#
# 두 종류로 나눈 이유: "이 앨범의 트랙 목록"이나 "이 아티스트가 누구냐"는 배치 조회와
# 마찬가지로 사실상 불변이지만, **"이 아티스트의 앨범 목록"은 신보가 나오면 바뀐다.**
# 목록류에 30일을 걸면 새 앨범이 한 달 동안 안 보인다.
DETAIL_TTL_DAYS = 30
LISTING_TTL_DAYS = 1

# item_type 별 payload 유효 기간. **조회와 정리가 같은 표를 본다.**
#
# 처음엔 TTL을 읽는 쪽(라우터가 인자로 넘김)과 지우는 쪽(purge가 자체 기준 사용)에
# 나눠 뒀는데, 목록류를 1일로 줄였을 때 purge 쪽이 따라오지 않아 하루면 무효가 되는 행이
# 29일 더 남았다. 한 곳에서 정의해 그런 어긋남을 없앤다.
ITEM_TYPE_TTL_DAYS = {
    # 배치 조회 (services/music_api.py 의 _map_album / _map_track 결과)
    "album": CACHE_TTL_DAYS,
    "track": CACHE_TTL_DAYS,
    # 단건 상세 — 사실상 불변
    "artist_detail": DETAIL_TTL_DAYS,
    "album_tracks": DETAIL_TTL_DAYS,
    # 단건 목록 — 신보가 나오면 바뀐다
    "artist_albums": LISTING_TTL_DAYS,
    "artist_top_tracks": LISTING_TTL_DAYS,
}

# 표에 없는 타입(나중에 캐시를 붙였는데 여기 등록을 잊은 경우)은 길게 잡아 둔다.
# 짧게 잡으면 등록을 잊었다는 이유만으로 조용히 캐시가 안 먹는다.
DEFAULT_TTL_DAYS = CACHE_TTL_DAYS


def ttl_for(item_type: str) -> int:
    return ITEM_TYPE_TTL_DAYS.get(item_type, DEFAULT_TTL_DAYS)


def get_cached(db: Session, item_type: str, ids: list[str]) -> tuple[dict[str, dict], set[str]]:
    """만료되지 않은 캐시를 (조회된 것, 없다고 확인된 것) 으로 나눠 돌려준다.

    둘 다 "iTunes를 부를 필요가 없다"는 뜻이지만 TTL이 다르다.
    """
    if not ids:
        return {}, set()

    now = datetime.utcnow()
    rows = (
        db.query(MusicCache)
        .filter(MusicCache.item_type == item_type, MusicCache.item_id.in_(ids))
        .all()
    )

    hits: dict[str, dict] = {}
    missing: set[str] = set()
    for r in rows:
        ttl = ttl_for(item_type) if r.payload is not None else MISSING_TTL_DAYS
        if r.fetched_at < now - timedelta(days=ttl):
            continue
        if r.payload is None:
            missing.add(r.item_id)
        else:
            # payload가 스키마와 안 맞으면(매핑 로직이 바뀐 경우) 라우터 쪽 검증에서 걸러진다.
            hits[r.item_id] = r.payload
    return hits, missing


def put_cached(db: Session, item_type: str, items: list[dict], requested: list[str]) -> None:
    """조회 결과를 upsert한다. 요청했는데 안 돌아온 ID는 tombstone(payload NULL)으로 남긴다.

    같은 ID가 이미 있으면 payload와 시각을 덮어쓴다 — tombstone이 실제 데이터로
    바뀌는 경우도 같은 경로로 처리된다.
    """
    now = datetime.utcnow()
    found = {str(item["id"]) for item in items if item.get("id")}

    rows = [
        {"item_type": item_type, "item_id": str(item["id"]), "payload": item, "fetched_at": now}
        for item in items
        if item.get("id")
    ]
    rows += [
        {"item_type": item_type, "item_id": mid, "payload": None, "fetched_at": now}
        for mid in requested
        if mid not in found
    ]
    if not rows:
        return

    stmt = insert(MusicCache).values(rows)
    stmt = stmt.on_conflict_do_update(
        index_elements=["item_type", "item_id"],
        set_={"payload": stmt.excluded.payload, "fetched_at": stmt.excluded.fetched_at},
    )
    db.execute(stmt)
    db.commit()


def get_cached_one(db: Session, item_type: str, key: str) -> dict | None:
    """단건 조회 경로용. 만료되지 않은 payload를 돌려주고, 없거나 만료면 None.

    TTL은 호출부가 정하지 않고 `ITEM_TYPE_TTL_DAYS` 에서 가져온다 — 정리(purge)와 같은
    표를 봐야 둘이 어긋나지 않는다.

    배치 경로(get_cached)와 달리 tombstone을 쓰지 않는다 — 단건 조회는 "없음"이 곧 404라
    응답 자체가 다르고, 그 404를 캐싱해 봐야 아낄 왕복이 거의 없다.
    """
    row = (
        db.query(MusicCache)
        .filter(MusicCache.item_type == item_type, MusicCache.item_id == key)
        .first()
    )
    if row is None or row.payload is None:
        return None
    if row.fetched_at < datetime.utcnow() - timedelta(days=ttl_for(item_type)):
        return None
    return row.payload


def put_cached_one(db: Session, item_type: str, key: str, payload: dict) -> None:
    """단건 조회 결과를 upsert한다."""
    stmt = insert(MusicCache).values(
        item_type=item_type, item_id=key, payload=payload, fetched_at=datetime.utcnow()
    )
    stmt = stmt.on_conflict_do_update(
        index_elements=["item_type", "item_id"],
        set_={"payload": stmt.excluded.payload, "fetched_at": stmt.excluded.fetched_at},
    )
    db.execute(stmt)
    db.commit()


def purge_expired(db: Session) -> int:
    """TTL이 지난 행을 지우고 지운 개수를 돌려준다.

    만료된 행은 다시 조회되면 덮어써지지만, **다시 조회되지 않는 행은 영원히 남는다** —
    한 번 보고 만 앨범, 지워진 탑스터가 참조하던 커버 따위가 그렇다. 그래서 주기적으로 턴다.

    **item_type 마다 제 TTL로 지운다.** 처음엔 가장 긴 TTL(30일) 하나로만 지웠는데,
    그러면 하루면 무효가 되는 목록 캐시가 29일을 더 버틴다. 조회 시점에 걸러지니 정확성
    문제는 없지만 공간이 아깝다 — 목록 payload 한 행이 배치 캐시 행의 10배가 넘는다
    (실측: artist_albums ~3.6KB vs album ~330B).
    """
    now = datetime.utcnow()

    # tombstone은 타입과 무관하게 짧은 TTL을 쓴다(payload가 없어 종류를 따질 것도 없다).
    conditions = [
        MusicCache.payload.is_(None)
        & (MusicCache.fetched_at < now - timedelta(days=MISSING_TTL_DAYS))
    ]
    for item_type, ttl in ITEM_TYPE_TTL_DAYS.items():
        conditions.append(
            (MusicCache.item_type == item_type)
            & MusicCache.payload.isnot(None)
            & (MusicCache.fetched_at < now - timedelta(days=ttl))
        )
    # 표에 등록되지 않은 타입도 방치하지 않는다.
    conditions.append(
        MusicCache.item_type.notin_(list(ITEM_TYPE_TTL_DAYS))
        & MusicCache.payload.isnot(None)
        & (MusicCache.fetched_at < now - timedelta(days=DEFAULT_TTL_DAYS))
    )

    deleted = (
        db.query(MusicCache).filter(or_(*conditions)).delete(synchronize_session=False)
    )
    db.commit()
    if deleted:
        logger.info("music_cache: 만료 행 %d개 정리", deleted)
    return deleted

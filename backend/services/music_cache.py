"""iTunes 배치 조회 앞에 두는 DB 캐시.

왜 필요한가: 탑스터 카드 한 장이 최대 25칸, 목록 한 페이지가 30장이면 커버 URL을 알아내려고
iTunes를 수백 개 ID만큼 두드리게 된다. 그런데 "앨범 1097861387의 커버 URL"은 사실상 바뀌지
않는 값이다. 매번 물어볼 이유가 없어 답을 DB에 적어둔다.

캐싱하는 것: 메타데이터(제목·아티스트·커버 URL 등). 이미지 바이트가 아니다 —
커버는 mzstatic이 호스팅하므로 브라우저가 직접 받아가면 되고, 우리가 다시 서빙하면
스토리지와 대역폭만 떠안는다.
"""
from __future__ import annotations

from datetime import datetime, timedelta

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from models.music_cache import MusicCache

# 릴리스된 앨범/트랙의 메타데이터는 사실상 불변이라 길게 잡아도 된다.
# 그래도 무한은 아니다 — 아트워크 경로가 갈리거나 우리 매핑 로직이 바뀔 수 있다.
CACHE_TTL_DAYS = 30

# "iTunes에 없다"도 캐싱한다(payload NULL). 안 하면 안 풀리는 ID 하나 때문에
# 매 요청마다 iTunes를 다시 두드린다 — 검색은 돌려주는데 lookup으로는 안 풀리는
# 앨범 ID가 실제로 존재한다(1508421225, 754383858 등에서 확인).
# 다만 '없음'은 '있음'보다 뒤집힐 여지가 크므로(재등록 등) TTL을 짧게 둔다.
MISSING_TTL_DAYS = 1


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
        ttl = CACHE_TTL_DAYS if r.payload is not None else MISSING_TTL_DAYS
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

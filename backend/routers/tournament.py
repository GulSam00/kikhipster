from __future__ import annotations

import math
import random
from datetime import datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import distinct, func, or_, select
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.tournament import (
    Tournament,
    TournamentItem,
    TournamentPlay,
    TournamentRound,
)
from models.user import User
from routers.comment import purge_comments
from routers.deps import get_current_user, get_optional_user
from schemas.tournament import (
    MAX_POOL,
    MIN_POOL,
    VALID_PLAY_SIZES,
    PlayCreate,
    PlayResponse,
    PlayRoundResponse,
    TournamentCreate,
    TournamentDetailResponse,
    TournamentRankingItem,
    TournamentRankingResponse,
    TournamentSummaryResponse,
    TournamentUpdate,
)

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])

# 순위 추이를 비교할 기준 시점(며칠 전).
TREND_DAYS = 7

# 대시보드 카드 썸네일에 쓸 미리보기 개수.
PREVIEW_COUNT = 4


# --------------------------------------------------------------------------
# 공통 헬퍼
# --------------------------------------------------------------------------


def _available_sizes(pool_size: int) -> list[int]:
    """풀 크기 이하인 강수만 고를 수 있다. 풀이 5개면 4강만 가능."""
    return [s for s in VALID_PLAY_SIZES if s <= pool_size]


def _get_tournament_or_404(tournament_id: str, db: Session) -> Tournament:
    tournament = db.query(Tournament).filter_by(id=tournament_id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="월드컵을 찾을 수 없습니다")
    return tournament


def _replace_items(tournament: Tournament, item_ids: list[str], db: Session) -> None:
    """풀을 통째로 교체한다. 순서를 지키며 중복만 제거한다."""
    unique = list(dict.fromkeys(item_ids))
    if len(unique) < MIN_POOL:
        raise HTTPException(
            status_code=400,
            detail=f"중복을 제외하면 {len(unique)}개입니다. 최소 {MIN_POOL}개가 필요합니다",
        )
    if len(unique) > MAX_POOL:
        raise HTTPException(status_code=400, detail=f"최대 {MAX_POOL}개까지 담을 수 있습니다")

    db.query(TournamentItem).filter_by(tournament_id=tournament.id).delete()
    for position, item_id in enumerate(unique):
        db.add(TournamentItem(tournament_id=tournament.id, item_id=item_id, position=position))


def _summaries(rows, db: Session) -> list[TournamentSummaryResponse]:
    """(Tournament, 플레이 수) 목록을 카드 응답으로 만든다.

    대시보드·내 목록·유저 목록이 같은 카드를 쓰므로 조립을 한 군데로 모았다.
    썸네일과 후보 수는 월드컵마다 묻지 않고 한 번에 모아 조회한다 — 목록이 30장이면
    각자 묻는 순간 쿼리가 60번이 된다.
    """
    if not rows:
        return []

    tournament_ids = [t.id for t, _ in rows]

    # 카드 썸네일용 미리보기 id — 월드컵 하나당 앞에서 PREVIEW_COUNT개만.
    previews: dict = {}
    for row in (
        db.query(TournamentItem)
        .filter(TournamentItem.tournament_id.in_(tournament_ids))
        .filter(TournamentItem.position < PREVIEW_COUNT)
        .order_by(TournamentItem.tournament_id, TournamentItem.position)
        .all()
    ):
        previews.setdefault(row.tournament_id, []).append(row.item_id)

    counts = dict(
        db.query(TournamentItem.tournament_id, func.count(TournamentItem.id))
        .filter(TournamentItem.tournament_id.in_(tournament_ids))
        .group_by(TournamentItem.tournament_id)
        .all()
    )

    return [
        TournamentSummaryResponse(
            id=str(t.id),
            title=t.title,
            description=t.description,
            item_type=t.item_type,
            item_count=counts.get(t.id, 0),
            play_count=total,
            created_at=t.created_at,
            user=t.user,
            preview_item_ids=previews.get(t.id, []),
        )
        for t, total in rows
    ]


# --------------------------------------------------------------------------
# 월드컵 정의
# --------------------------------------------------------------------------


@router.get("/", response_model=list[TournamentSummaryResponse])
def list_tournaments(
    q: str | None = Query(None, description="제목·설명 부분 일치 검색"),
    sort: str = Query("recent", pattern="^(recent|popular_all|popular_year|popular_month)$"),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    """대시보드 목록. 검색 + 최신순/인기순(전체·년·월) 정렬. 비로그인도 조회 가능.

    인기순은 '플레이 횟수'다. 기간 필터는 플레이가 만들어진 시각(TournamentPlay.created_at)을
    자르는 것이지 월드컵 생성 시각이 아니다 — 오래전에 만든 월드컵도 이번 달에 많이 플레이됐으면
    월간 인기순 상위에 올라온다.
    """
    since = None
    if sort == "popular_year":
        since = datetime.utcnow() - timedelta(days=365)
    elif sort == "popular_month":
        since = datetime.utcnow() - timedelta(days=30)

    # 정렬 기준이 되는 플레이 수. 기간 필터가 있으면 그 기간 안의 플레이만 센다.
    ranked = db.query(
        TournamentPlay.tournament_id.label("tid"),
        func.count(TournamentPlay.id).label("cnt"),
    )
    if since is not None:
        ranked = ranked.filter(TournamentPlay.created_at >= since)
    ranked = ranked.group_by(TournamentPlay.tournament_id).subquery()

    # 카드에 늘 보여주는 '전체' 플레이 수는 기간과 무관하게 따로 센다.
    totals = (
        db.query(
            TournamentPlay.tournament_id.label("tid"),
            func.count(TournamentPlay.id).label("cnt"),
        )
        .group_by(TournamentPlay.tournament_id)
        .subquery()
    )

    query = (
        db.query(
            Tournament,
            func.coalesce(totals.c.cnt, 0).label("total_plays"),
        )
        .outerjoin(ranked, ranked.c.tid == Tournament.id)
        .outerjoin(totals, totals.c.tid == Tournament.id)
        .options(joinedload(Tournament.user))
    )

    if q:
        pattern = f"%{q}%"
        query = query.filter(
            or_(Tournament.title.ilike(pattern), Tournament.description.ilike(pattern))
        )

    if sort == "recent":
        query = query.order_by(Tournament.created_at.desc())
    else:
        # 플레이 수가 같으면 최신순으로 갈라 순서가 요청마다 흔들리지 않게 한다.
        query = query.order_by(
            func.coalesce(ranked.c.cnt, 0).desc(), Tournament.created_at.desc()
        )

    rows = query.offset(offset).limit(limit).all()
    return _summaries(rows, db)


def _detail_response(tournament: Tournament, db: Session) -> TournamentDetailResponse:
    item_ids = [i.item_id for i in tournament.items]
    play_count = (
        db.query(func.count(TournamentPlay.id)).filter_by(tournament_id=tournament.id).scalar() or 0
    )
    return TournamentDetailResponse(
        id=str(tournament.id),
        title=tournament.title,
        description=tournament.description,
        item_type=tournament.item_type,
        item_ids=item_ids,
        item_count=len(item_ids),
        play_count=play_count,
        created_at=tournament.created_at,
        user=tournament.user,
        available_sizes=_available_sizes(len(item_ids)),
    )


@router.post("/", response_model=TournamentDetailResponse, status_code=201)
def create_tournament(
    body: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tournament = Tournament(
        user_id=current_user.id,
        title=body.title.strip(),
        description=body.description.strip(),
        item_type=body.item_type,
    )
    db.add(tournament)
    db.flush()

    _replace_items(tournament, body.item_ids, db)

    db.commit()
    db.refresh(tournament)
    return _detail_response(tournament, db)


@router.get("/{tournament_id}", response_model=TournamentDetailResponse)
def get_tournament(tournament_id: str, db: Session = Depends(get_db)):
    return _detail_response(_get_tournament_or_404(tournament_id, db), db)


@router.put("/{tournament_id}", response_model=TournamentDetailResponse)
def update_tournament(
    tournament_id: str,
    body: TournamentUpdate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tournament = _get_tournament_or_404(tournament_id, db)
    if tournament.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    if body.title is not None:
        tournament.title = body.title.strip()
    if body.description is not None:
        tournament.description = body.description.strip()
    if body.item_ids is not None:
        # item_type은 바꾸지 않는다 — 이미 치러진 플레이의 대진과 종류가 어긋나기 때문.
        _replace_items(tournament, body.item_ids, db)

    db.commit()
    db.refresh(tournament)
    return _detail_response(tournament, db)


@router.delete("/{tournament_id}", status_code=204)
def delete_tournament(
    tournament_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tournament = _get_tournament_or_404(tournament_id, db)
    if tournament.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="권한이 없습니다")

    # 댓글은 FK가 아니라 (target_type, target_id)로 붙어 있어 DB가 대신 지워주지 않는다.
    purge_comments("tournament", tournament.id, db)
    db.delete(tournament)
    db.commit()


def _owned_list(user_id: str, limit: int, offset: int, db: Session):
    """한 사용자의 월드컵을 최신순으로. 플레이 수는 전체 기간 기준이다.

    공개 플래그가 없다 — 만들면 곧 공개다. 그래서 '내 목록'과 '남의 목록'이 같은 결과를
    돌려준다(엔드포인트만 다르다). 탑스터도 2026-08-27에 `is_public` 을 없애 같은 규칙이 됐다.
    """
    totals = (
        db.query(
            TournamentPlay.tournament_id.label("tid"),
            func.count(TournamentPlay.id).label("cnt"),
        )
        .group_by(TournamentPlay.tournament_id)
        .subquery()
    )

    rows = (
        db.query(Tournament, func.coalesce(totals.c.cnt, 0).label("total_plays"))
        .filter(Tournament.user_id == user_id)
        .outerjoin(totals, totals.c.tid == Tournament.id)
        .options(joinedload(Tournament.user))
        .order_by(Tournament.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )
    return _summaries(rows, db)


# `/{tournament_id}` 와 겹치지 않는다 — 아래 둘은 세그먼트가 2개이고 첫 칸이 리터럴이다.
@router.get("/user/{user_id}", response_model=list[TournamentSummaryResponse])
def list_user_tournaments(
    user_id: str,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
):
    return _owned_list(user_id, limit, offset, db)


@router.get("/me/list", response_model=list[TournamentSummaryResponse])
def list_my_tournaments(
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    return _owned_list(str(current_user.id), limit, offset, db)


# --------------------------------------------------------------------------
# 플레이 생성
# --------------------------------------------------------------------------


def _build_first_round(play_id, item_ids: list[str]) -> list[TournamentRound]:
    """1라운드만 만든다. 이후 라운드는 투표가 다 찼을 때 vote에서 생성한다."""
    total_rounds = int(math.log2(len(item_ids)))
    return [
        TournamentRound(
            play_id=play_id,
            round_num=total_rounds,
            match_num=i // 2,
            item_a_id=item_ids[i],
            item_b_id=item_ids[i + 1],
        )
        for i in range(0, len(item_ids), 2)
    ]


def play_response(play: TournamentPlay) -> PlayResponse:
    return PlayResponse(
        id=str(play.id),
        tournament_id=str(play.tournament_id),
        tournament_title=play.tournament.title,
        item_type=play.tournament.item_type,
        size=play.size,
        status=play.status,
        winner_item_id=play.winner_item_id,
        created_at=play.created_at,
        rounds=[PlayRoundResponse.model_validate(r) for r in play.rounds],
    )


@router.post("/{tournament_id}/plays", response_model=PlayResponse, status_code=201)
def create_play(
    tournament_id: str,
    body: PlayCreate,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    """풀에서 size개를 무작위로 뽑아 새 판을 만든다. 비로그인도 가능하다."""
    tournament = _get_tournament_or_404(tournament_id, db)
    pool = [i.item_id for i in tournament.items]

    if body.size not in VALID_PLAY_SIZES:
        allowed = ", ".join(str(s) for s in VALID_PLAY_SIZES)
        raise HTTPException(status_code=400, detail=f"강수는 {allowed} 중 하나여야 합니다")
    if body.size > len(pool):
        raise HTTPException(
            status_code=400,
            detail=f"풀에 {len(pool)}개뿐이라 {body.size}강을 만들 수 없습니다",
        )

    # 매 플레이마다 다르게 뽑는다 — 같은 월드컵을 여러 번 돌리는 게 이 설계의 전제다.
    picked = random.sample(pool, body.size)

    play = TournamentPlay(
        tournament_id=tournament.id,
        user_id=current_user.id if current_user else None,
        size=body.size,
    )
    db.add(play)
    db.flush()

    for r in _build_first_round(play.id, picked):
        db.add(r)

    db.commit()
    db.refresh(play)
    return play_response(play)


# --------------------------------------------------------------------------
# 랭킹
# --------------------------------------------------------------------------


def _aggregate(db: Session, tournament_id, item_ids, cutoff=None):
    """항목별 누적 성적을 **DB에서** 집계한다.

    예전에는 이 월드컵의 플레이·라운드를 전부 파이썬으로 끌어와 두 번(현재/과거) 돌았다.
    플레이가 쌓일수록 전송량과 루프가 같이 늘어서 SQL 쪽으로 내렸다 — 돌려주는 값은 같다.

    `cutoff` 를 주면 그 시각 **이전에 시작된** 플레이만 센다(과거 스냅샷).
    """
    stats = {
        item_id: {"plays": 0, "championships": 0, "matches": 0, "match_wins": 0}
        for item_id in item_ids
    }

    play_where = [TournamentPlay.tournament_id == tournament_id]
    if cutoff is not None:
        play_where.append(TournamentPlay.created_at < cutoff)

    # 한 라운드는 item_a/item_b 두 칸을 쓴다. 항목 기준으로 group by 하려면
    # 두 칸을 한 열로 펼쳐야 한다.
    def _side(column):
        return (
            select(
                TournamentRound.play_id.label("play_id"),
                column.label("item_id"),
                TournamentRound.winner_id.label("winner_id"),
            )
            .join(TournamentPlay, TournamentPlay.id == TournamentRound.play_id)
            .where(*play_where)
        )

    sides = _side(TournamentRound.item_a_id).union_all(_side(TournamentRound.item_b_id)).subquery()

    round_rows = db.execute(
        select(
            sides.c.item_id,
            func.count(distinct(sides.c.play_id)),
            # 아직 투표되지 않은 경기는 1:1 표본에 넣지 않는다.
            func.count().filter(sides.c.winner_id.isnot(None)),
            func.count().filter(sides.c.winner_id == sides.c.item_id),
        ).group_by(sides.c.item_id)
    ).all()

    for item_id, plays, matches, match_wins in round_rows:
        s = stats.get(item_id)
        if s is None:
            continue  # 풀에서 빠진 항목의 과거 기록 — 랭킹에 넣지 않는다
        s["plays"] = plays
        s["matches"] = matches
        s["match_wins"] = match_wins

    champ_rows = db.execute(
        select(TournamentPlay.winner_item_id, func.count())
        .where(*play_where, TournamentPlay.winner_item_id.isnot(None))
        .group_by(TournamentPlay.winner_item_id)
    ).all()

    for item_id, count in champ_rows:
        if item_id in stats:
            stats[item_id]["championships"] = count

    return stats


def _rank(stats) -> dict[str, int]:
    """우승 비율 → 승률 → 참가 횟수 순으로 정렬해 1부터 순위를 매긴다."""
    rows = []
    for item_id, s in stats.items():
        plays = s["plays"]
        rows.append((
            item_id,
            s["championships"] / plays if plays else 0.0,
            s["match_wins"] / s["matches"] if s["matches"] else 0.0,
            plays,
        ))
    # 마지막 item_id는 완전 동률일 때 순위가 매 요청마다 흔들리지 않게 하는 결정적 tie-breaker.
    rows.sort(key=lambda r: (-r[1], -r[2], -r[3], r[0]))
    return {row[0]: i + 1 for i, row in enumerate(rows)}


@router.get("/{tournament_id}/ranking", response_model=TournamentRankingResponse)
def get_tournament_ranking(tournament_id: str, db: Session = Depends(get_db)):
    """이 월드컵의 풀 전체를 누적 플레이 성적으로 줄 세운다.

    플레이마다 풀에서 무작위로 뽑히므로 항목별 참가 횟수가 달라진다 — 그래서
    '우승 횟수'가 아니라 '우승 비율(우승/참가)'이 의미를 갖는다.
    """
    tournament = _get_tournament_or_404(tournament_id, db)
    item_ids = [i.item_id for i in tournament.items]

    total_plays = db.scalar(
        select(func.count())
        .select_from(TournamentPlay)
        .where(TournamentPlay.tournament_id == tournament.id)
    )

    current_stats = _aggregate(db, tournament.id, item_ids)
    current_rank = _rank(current_stats)

    cutoff = datetime.utcnow() - timedelta(days=TREND_DAYS)
    past_stats = _aggregate(db, tournament.id, item_ids, cutoff=cutoff)
    # 기준 시점에 표본이 하나도 없던 항목은 "신규"로 두고 추이를 비운다.
    had_history = {i for i, s in past_stats.items() if s["plays"]}
    past_rank = _rank({i: s for i, s in past_stats.items() if i in had_history})

    items = []
    for item_id in sorted(item_ids, key=lambda i: current_rank[i]):
        s = current_stats[item_id]
        plays = s["plays"]
        previous = past_rank.get(item_id)
        items.append(TournamentRankingItem(
            rank=current_rank[item_id],
            item_id=item_id,
            play_count=plays,
            championship_count=s["championships"],
            championship_rate=s["championships"] / plays if plays else 0.0,
            match_count=s["matches"],
            match_win_count=s["match_wins"],
            match_win_rate=s["match_wins"] / s["matches"] if s["matches"] else 0.0,
            previous_rank=previous,
            rank_delta=(previous - current_rank[item_id]) if previous is not None else None,
        ))

    return TournamentRankingResponse(
        tournament_id=str(tournament.id),
        title=tournament.title,
        item_type=tournament.item_type,
        total_plays=total_plays,
        trend_days=TREND_DAYS,
        items=items,
    )

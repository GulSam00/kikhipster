from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.tournament import TournamentPlay, TournamentRound
from models.user import User
from routers.deps import get_optional_user
from routers.tournament import play_response
from schemas.tournament import PlayResponse, PlayVote

router = APIRouter(prefix="/api/plays", tags=["plays"])


def _get_play_or_404(play_id: str, db: Session) -> TournamentPlay:
    play = db.query(TournamentPlay).filter_by(id=play_id).first()
    if not play:
        raise HTTPException(status_code=404, detail="플레이를 찾을 수 없습니다")
    return play


def _assert_can_vote(play: TournamentPlay, current_user: User | None) -> None:
    """익명 플레이는 누구나(=play_id를 아는 사람만) 진행할 수 있다.

    로그인 유저가 시작한 판은 본인만 이어갈 수 있다 — 남이 남의 결과를 바꾸면
    랭킹 집계가 그 사람 취향이 아니게 된다.
    """
    if play.user_id is None:
        return
    if current_user is None or current_user.id != play.user_id:
        raise HTTPException(status_code=403, detail="이 플레이를 진행할 권한이 없습니다")


@router.get("/{play_id}", response_model=PlayResponse)
def get_play(play_id: str, db: Session = Depends(get_db)):
    """진행 상태 조회. 새로고침해도 이어서 할 수 있는 근거가 이 엔드포인트다."""
    return play_response(_get_play_or_404(play_id, db))


@router.post("/{play_id}/rounds/{round_id}/vote", response_model=PlayResponse)
def vote_round(
    play_id: str,
    round_id: str,
    body: PlayVote,
    current_user: User | None = Depends(get_optional_user),
    db: Session = Depends(get_db),
):
    play = _get_play_or_404(play_id, db)
    _assert_can_vote(play, current_user)

    if play.status == "completed":
        raise HTTPException(status_code=400, detail="이미 완료된 플레이입니다")

    round_ = db.query(TournamentRound).filter_by(id=round_id, play_id=play_id).first()
    if not round_:
        raise HTTPException(status_code=404, detail="경기를 찾을 수 없습니다")
    if round_.winner_id:
        raise HTTPException(status_code=400, detail="이미 투표된 경기입니다")
    if body.winner_id not in (round_.item_a_id, round_.item_b_id):
        raise HTTPException(status_code=400, detail="유효하지 않은 winner_id입니다")

    round_.winner_id = body.winner_id

    current_matches = (
        db.query(TournamentRound)
        .filter_by(play_id=play_id, round_num=round_.round_num)
        .order_by(TournamentRound.match_num)
        .all()
    )
    winners = [r.winner_id for r in current_matches if r.winner_id]

    # 이번 라운드가 다 차야 다음 라운드를 만든다.
    if len(winners) == len(current_matches):
        if len(winners) == 1:
            play.status = "completed"
            play.winner_item_id = winners[0]
        else:
            next_round_num = round_.round_num - 1
            for i in range(0, len(winners), 2):
                db.add(TournamentRound(
                    play_id=play_id,
                    round_num=next_round_num,
                    match_num=i // 2,
                    item_a_id=winners[i],
                    item_b_id=winners[i + 1],
                ))

    db.commit()
    db.refresh(play)
    return play_response(play)

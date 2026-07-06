import math

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.tournament import Tournament, TournamentRound
from models.user import User
from routers.deps import get_current_user
from schemas.tournament import TournamentCreate, TournamentResponse, TournamentVote

router = APIRouter(prefix="/api/tournaments", tags=["tournaments"])

VALID_SIZES = {8, 16, 32}


def _build_rounds(tournament_id, track_ids: list[str]) -> list[TournamentRound]:
    size = len(track_ids)
    total_rounds = int(math.log2(size))
    rounds = []
    for i in range(0, size, 2):
        rounds.append(TournamentRound(
            tournament_id=tournament_id,
            round_num=total_rounds,
            match_num=i // 2,
            track_a_id=track_ids[i],
            track_b_id=track_ids[i + 1],
        ))
    return rounds


@router.post("/", response_model=TournamentResponse, status_code=201)
def create_tournament(
    body: TournamentCreate,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if len(body.track_ids) not in VALID_SIZES:
        raise HTTPException(status_code=400, detail="track_ids는 8, 16, 32개여야 합니다")
    if len(body.track_ids) != len(set(body.track_ids)):
        raise HTTPException(status_code=400, detail="중복된 트랙이 있습니다")

    tournament = Tournament(user_id=current_user.id, size=len(body.track_ids))
    db.add(tournament)
    db.flush()

    for r in _build_rounds(tournament.id, body.track_ids):
        db.add(r)

    db.commit()
    db.refresh(tournament)
    return tournament


@router.get("/{tournament_id}", response_model=TournamentResponse)
def get_tournament(
    tournament_id: str,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter_by(id=tournament_id, user_id=current_user.id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="토너먼트를 찾을 수 없습니다")
    return tournament


@router.post("/{tournament_id}/rounds/{round_id}/vote", response_model=TournamentResponse)
def vote_round(
    tournament_id: str,
    round_id: str,
    body: TournamentVote,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    tournament = db.query(Tournament).filter_by(id=tournament_id, user_id=current_user.id).first()
    if not tournament:
        raise HTTPException(status_code=404, detail="토너먼트를 찾을 수 없습니다")
    if tournament.status == "completed":
        raise HTTPException(status_code=400, detail="이미 완료된 토너먼트입니다")

    round_ = db.query(TournamentRound).filter_by(id=round_id, tournament_id=tournament_id).first()
    if not round_:
        raise HTTPException(status_code=404, detail="라운드를 찾을 수 없습니다")
    if round_.winner_id:
        raise HTTPException(status_code=400, detail="이미 투표된 경기입니다")
    if body.winner_id not in (round_.track_a_id, round_.track_b_id):
        raise HTTPException(status_code=400, detail="유효하지 않은 winner_id입니다")

    round_.winner_id = body.winner_id

    current_round_matches = (
        db.query(TournamentRound)
        .filter_by(tournament_id=tournament_id, round_num=round_.round_num)
        .all()
    )
    winners = [r.winner_id for r in current_round_matches if r.winner_id]

    if len(winners) == len(current_round_matches):
        if len(winners) == 1:
            tournament.status = "completed"
            tournament.winner_track_id = winners[0]
        else:
            next_round_num = round_.round_num - 1
            for i in range(0, len(winners), 2):
                db.add(TournamentRound(
                    tournament_id=tournament_id,
                    round_num=next_round_num,
                    match_num=i // 2,
                    track_a_id=winners[i],
                    track_b_id=winners[i + 1],
                ))

    db.commit()
    db.refresh(tournament)
    return tournament

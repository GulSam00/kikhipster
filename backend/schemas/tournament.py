from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel


class TournamentCreate(BaseModel):
    track_ids: list[str]  # 8 | 16 | 32개


class TournamentRoundResponse(BaseModel):
    id: str
    round_num: int
    match_num: int
    track_a_id: str
    track_b_id: str
    winner_id: str | None

    model_config = {"from_attributes": True}


class TournamentResponse(BaseModel):
    id: str
    size: int
    status: str
    winner_track_id: str | None
    created_at: datetime
    rounds: list[TournamentRoundResponse] = []

    model_config = {"from_attributes": True}


class TournamentVote(BaseModel):
    winner_id: str

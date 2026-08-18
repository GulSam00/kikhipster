from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel

from schemas.common import UUIDStr


class TournamentCreate(BaseModel):
    track_ids: list[str]  # 8 | 16 | 32개


class TournamentRoundResponse(BaseModel):
    # track_a_id / track_b_id / winner_id 는 Spotify 트랙 ID(String 컬럼)라 UUID가 아니다.
    id: UUIDStr
    round_num: int
    match_num: int
    track_a_id: str
    track_b_id: str
    winner_id: str | None

    model_config = {"from_attributes": True}


class TournamentResponse(BaseModel):
    id: UUIDStr
    size: int
    status: str
    winner_track_id: str | None
    created_at: datetime
    rounds: list[TournamentRoundResponse] = []

    model_config = {"from_attributes": True}


class TournamentVote(BaseModel):
    winner_id: str

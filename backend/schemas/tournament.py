from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

from schemas.common import UUIDStr

ItemType = Literal["track", "album"]

# 풀 크기 제한.
MIN_POOL = 4
MAX_POOL = 512

# 플레이에서 고를 수 있는 강수. 128강(127경기)이 한 자리에서 끝낼 수 있는 현실적 상한이다.
VALID_PLAY_SIZES = (4, 8, 16, 32, 64, 128)


class TournamentUserInfo(BaseModel):
    id: UUIDStr
    nickname: str

    model_config = {"from_attributes": True}


# --------------------------------------------------------------------------
# 월드컵 정의
# --------------------------------------------------------------------------


class TournamentCreate(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    description: str = Field(default="", max_length=500)
    item_type: ItemType
    # iTunes trackId / collectionId 문자열.
    item_ids: list[str] = Field(min_length=MIN_POOL, max_length=MAX_POOL)


class TournamentUpdate(BaseModel):
    title: str | None = Field(default=None, min_length=1, max_length=100)
    description: str | None = Field(default=None, max_length=500)
    item_ids: list[str] | None = Field(default=None, min_length=MIN_POOL, max_length=MAX_POOL)


class TournamentSummaryResponse(BaseModel):
    """대시보드 카드용. 풀 전체를 싣지 않고 개수와 미리보기 몇 개만 준다."""

    id: UUIDStr
    title: str
    description: str
    item_type: ItemType
    item_count: int
    play_count: int
    created_at: datetime
    user: TournamentUserInfo
    # 카드 썸네일용 상위 4개 item_id. 클라이언트가 배치 조회로 커버를 채운다.
    preview_item_ids: list[str] = []


class TournamentDetailResponse(BaseModel):
    id: UUIDStr
    title: str
    description: str
    item_type: ItemType
    item_ids: list[str] = []
    item_count: int
    play_count: int
    created_at: datetime
    user: TournamentUserInfo
    # 이 월드컵에서 고를 수 있는 강수 (풀 크기 이하인 2의 거듭제곱)
    available_sizes: list[int] = []


# --------------------------------------------------------------------------
# 플레이
# --------------------------------------------------------------------------


class PlayCreate(BaseModel):
    size: int


class PlayRoundResponse(BaseModel):
    id: UUIDStr
    round_num: int
    match_num: int
    item_a_id: str
    item_b_id: str
    winner_id: str | None

    model_config = {"from_attributes": True}


class PlayResponse(BaseModel):
    id: UUIDStr
    tournament_id: UUIDStr
    tournament_title: str
    item_type: ItemType
    size: int
    status: str
    winner_item_id: str | None
    created_at: datetime
    rounds: list[PlayRoundResponse] = []


class PlayVote(BaseModel):
    winner_id: str


# --------------------------------------------------------------------------
# 랭킹
# --------------------------------------------------------------------------


class TournamentRankingItem(BaseModel):
    """랭킹 표 한 행. 이 월드컵에서 누적된 플레이 전체를 합산한 값이다."""

    rank: int
    item_id: str

    play_count: int          # 이 항목이 뽑혀 나간 플레이 수
    championship_count: int  # 그중 우승한 수
    championship_rate: float

    match_count: int         # 승부가 난 1:1 경기 수
    match_win_count: int
    match_win_rate: float

    previous_rank: int | None = None
    rank_delta: int | None = None


class TournamentRankingResponse(BaseModel):
    tournament_id: UUIDStr
    title: str
    item_type: ItemType
    total_plays: int
    trend_days: int
    items: list[TournamentRankingItem] = []

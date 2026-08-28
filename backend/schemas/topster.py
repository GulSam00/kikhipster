from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field, field_validator

from schemas.common import UUIDStr


class TopsterItemCreate(BaseModel):
    album_spotify_id: str
    position: int


class TopsterItemResponse(BaseModel):
    id: UUIDStr
    album_spotify_id: str
    position: int

    model_config = {"from_attributes": True}


# 격자 칸 개수 한계. 탑스터 전체 크기가 고정이라 칸이 많아질수록 셀이 작아지는데,
# 5를 넘으면 커버가 알아볼 수 없을 만큼 작아진다.
MIN_SIDE = 1
MAX_SIDE = 5
MAX_CELLS = 25

# 배경색은 사용자 콘텐츠라 임의 지정을 허용하되, 캔버스/CSS에 그대로 넣을 값이라
# 형식만은 강제한다(#RGB · #RRGGBB).
HEX_COLOR = r"^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$"


class TopsterOptions(BaseModel):
    """표시 옵션. 만들기 화면 '옵션' 탭과 1:1로 대응한다."""

    width: int = Field(5, ge=MIN_SIDE, le=MAX_SIDE)
    height: int = Field(5, ge=MIN_SIDE, le=MAX_SIDE)
    background_color: str = Field("#18181b", pattern=HEX_COLOR)
    text_color: str = Field("#ffffff", pattern=HEX_COLOR)
    cell_gap: int = Field(4, ge=0, le=40)
    show_title: bool = True
    show_album_info: bool = True
    show_numbering: bool = False


class TopsterCreate(TopsterOptions):
    title: str
    description: str = ""
    items: list[TopsterItemCreate] = []

    @field_validator("items")
    @classmethod
    def _positions_fit(cls, v, info):
        """position 은 row * width + col 로 평탄화한 인덱스라 격자 밖으로 나가면 안 된다."""
        w = info.data.get("width")
        h = info.data.get("height")
        if w is None or h is None:
            return v  # width/height 자체가 이미 검증에 걸렸다
        if w * h > MAX_CELLS:
            raise ValueError(f"칸이 {w * h}개입니다. 최대 {MAX_CELLS}개까지 가능합니다")
        for item in v:
            if not 0 <= item.position < w * h:
                raise ValueError(f"position {item.position} 이 {w}x{h} 격자를 벗어납니다")
        return v


class TopsterUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    width: int | None = Field(None, ge=MIN_SIDE, le=MAX_SIDE)
    height: int | None = Field(None, ge=MIN_SIDE, le=MAX_SIDE)
    background_color: str | None = Field(None, pattern=HEX_COLOR)
    text_color: str | None = Field(None, pattern=HEX_COLOR)
    cell_gap: int | None = Field(None, ge=0, le=40)
    show_title: bool | None = None
    show_album_info: bool | None = None
    show_numbering: bool | None = None
    items: list[TopsterItemCreate] | None = None


class TopsterUserInfo(BaseModel):
    id: UUIDStr
    nickname: str

    model_config = {"from_attributes": True}


class TopsterResponse(BaseModel):
    id: UUIDStr
    title: str
    description: str
    width: int
    height: int
    background_color: str
    text_color: str
    cell_gap: int
    show_title: bool
    show_album_info: bool
    show_numbering: bool
    created_at: datetime
    user: TopsterUserInfo
    items: list[TopsterItemResponse] = []
    # 카드·상세가 함께 쓰는 집계 3종. 목록 경로는 한 번의 group by 로 모아 채운다.
    view_count: int = 0
    like_count: int = 0
    comment_count: int = 0

    model_config = {"from_attributes": True}

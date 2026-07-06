from datetime import datetime

from pydantic import BaseModel


class TopsterItemCreate(BaseModel):
    album_spotify_id: str
    position: int


class TopsterItemResponse(BaseModel):
    id: str
    album_spotify_id: str
    position: int

    model_config = {"from_attributes": True}


class TopsterCreate(BaseModel):
    title: str
    description: str = ""
    grid_size: int = 5
    is_public: bool = True
    items: list[TopsterItemCreate] = []


class TopsterUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    grid_size: int | None = None
    is_public: bool | None = None
    items: list[TopsterItemCreate] | None = None


class TopsterUserInfo(BaseModel):
    id: str
    nickname: str

    model_config = {"from_attributes": True}


class TopsterResponse(BaseModel):
    id: str
    title: str
    description: str
    grid_size: int
    is_public: bool
    created_at: datetime
    user: TopsterUserInfo
    items: list[TopsterItemResponse] = []
    like_count: int = 0

    model_config = {"from_attributes": True}

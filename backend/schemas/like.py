from pydantic import BaseModel


class LikeStatusResponse(BaseModel):
    liked: bool
    like_count: int


class LikeToggleResponse(BaseModel):
    liked: bool
    like_count: int

from datetime import datetime

from pydantic import BaseModel


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentUserInfo(BaseModel):
    id: str
    nickname: str

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: str
    topster_id: str
    content: str
    created_at: datetime
    updated_at: datetime
    user: CommentUserInfo

    model_config = {"from_attributes": True}

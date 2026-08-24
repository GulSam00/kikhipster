from datetime import datetime

from pydantic import BaseModel

from schemas.common import UUIDStr


class CommentCreate(BaseModel):
    content: str


class CommentUpdate(BaseModel):
    content: str


class CommentUserInfo(BaseModel):
    id: UUIDStr
    nickname: str

    model_config = {"from_attributes": True}


class CommentResponse(BaseModel):
    id: UUIDStr
    target_type: str
    target_id: str
    content: str
    created_at: datetime
    updated_at: datetime
    user: CommentUserInfo

    model_config = {"from_attributes": True}

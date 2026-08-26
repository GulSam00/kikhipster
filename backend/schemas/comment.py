from __future__ import annotations

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
    # None 이면 한 번도 수정되지 않은 댓글이다. 화면의 "(수정됨)" 표시는 이 값만 본다.
    edited_at: datetime | None = None
    user: CommentUserInfo

    model_config = {"from_attributes": True}

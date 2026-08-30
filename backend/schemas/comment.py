from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field

from schemas.common import UUIDStr

#: 닉네임을 비우고 보냈을 때 채워 넣는 이름.
DEFAULT_GUEST_NICKNAME = "익명"


class CommentCreate(BaseModel):
    content: str
    # 비로그인 작성자만 쓴다. 로그인 상태면 무시하고 계정 닉네임을 쓴다.
    # 빈 문자열·공백만 들어와도 라우터가 "익명" 으로 채운다.
    nickname: str | None = Field(default=None, max_length=20)


class CommentUpdate(BaseModel):
    content: str


class CommentReportCreate(BaseModel):
    """신고 사유. 관리 화면이 아직 없어 값을 강제하지 않는다 — 비워도 신고는 접수된다."""

    reason: str | None = Field(default=None, max_length=20)


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
    # 비로그인 댓글이면 None 이다.
    user: CommentUserInfo | None = None
    # 화면에 찍을 이름. 로그인·비로그인 어느 쪽이든 항상 채워진다.
    author_nickname: str
    # **소유 판정은 서버가 한다.** 비로그인 댓글의 주인은 작성자 토큰의 해시로만 가릴 수
    # 있는데, 프론트에는 평문 토큰만 있고 서버에는 해시만 있어 프론트가 비교할 수 없다.
    # (예전처럼 `c.user.id === me.id` 로 비교하는 방식은 게스트에 쓸 수 없다.)
    is_mine: bool = False
    reported_by_me: bool = False
    report_count: int = 0

    model_config = {"from_attributes": True}

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    Column,
    DateTime,
    ForeignKey,
    Index,
    String,
    Text,
)
from sqlalchemy import text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import backref, relationship

from database import Base


class Comment(Base):
    """범용 댓글. Like와 같은 (target_type, target_id) 방식을 쓴다.

    처음엔 topster_id 하나로 고정돼 있었으나 토너먼트 랭킹 화면에도 댓글이 필요해지면서
    범용으로 바꿨다(2026-08-22). target_id를 String으로 둔 건 Like와 맞추기 위한 것으로,
    UUID(탑스터·토너먼트)든 iTunes ID든 같은 컬럼에 담기 위함이다.

    FK가 사라졌으므로 **대상이 삭제될 때 댓글도 같이 지우는 건 라우터 책임**이다.
    DB의 ON DELETE CASCADE에 더는 기댈 수 없다.
    """

    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    # 비로그인 댓글이면 NULL 이다. 그 경우 아래 guest_* 두 칸이 대신 주인을 가리킨다.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    # 비로그인 작성자가 적은 이름. 비워서 보내면 라우터가 "익명" 으로 채운다.
    guest_nickname = Column(String(20), nullable=True)
    # 비로그인 작성자의 소유 증명. **평문 토큰은 저장하지 않는다** — 브라우저가 들고 있는
    # 토큰의 SHA-256 hex 만 둔다. 삭제·수정 요청이 같은 해시를 내면 본인으로 본다.
    guest_token_hash = Column(String(64), nullable=True, index=True)
    target_type = Column(String, nullable=False)  # "topster" | "tournament"
    target_id = Column(String, nullable=False)    # UUID 문자열
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    # 화면의 "(수정됨)" 표시용. updated_at 으로는 판정할 수 없다 — created_at/updated_at 의
    # default 가 각각 utcnow() 를 따로 호출해 insert 직후에도 마이크로초가 어긋나고,
    # onupdate 는 content 와 무관한 UPDATE 에도 걸린다. 본문이 실제로 바뀔 때만 찍는다.
    edited_at = Column(DateTime, nullable=True)

    # backref 쪽에도 cascade를 걸어야 한다. 빠뜨리면 부모 삭제 시 SQLAlchemy가 자식의 FK를
    # NULL로 UPDATE하려 들고, 컬럼이 nullable=False라 IntegrityError로 500이 난다.
    # DB에 ON DELETE CASCADE가 있으므로 passive_deletes=True로 삭제는 DB에 위임한다.
    user = relationship(
        "User",
        backref=backref("comments", cascade="all, delete-orphan", passive_deletes=True),
    )

    __table_args__ = (
        Index("ix_comments_target", "target_type", "target_id"),
        # 주인 없는 댓글이 생기지 않게 DB 에서 막는다. 라우터만 믿으면 나중에 다른 경로가
        # 생겼을 때 조용히 새어 나간다.
        CheckConstraint(
            "user_id IS NOT NULL"
            " OR (guest_nickname IS NOT NULL AND guest_token_hash IS NOT NULL)",
            name="comments_author_present",
        ),
    )

    @property
    def author_nickname(self) -> str:
        """화면에 찍을 이름. 로그인 댓글이면 사용자 닉네임, 아니면 게스트 닉네임이다."""
        if self.user is not None:
            return self.user.nickname
        return self.guest_nickname or "익명"


class CommentReport(Base):
    """댓글 신고.

    신고자는 로그인 사용자일 수도(`reporter_user_id`) 비로그인일 수도(`reporter_token_hash`)
    있다. 아직 이걸 보는 관리 화면은 없다 — 쌓아 두기만 한다.
    """

    __tablename__ = "comment_reports"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    comment_id = Column(
        UUID(as_uuid=True), ForeignKey("comments.id", ondelete="CASCADE"), nullable=False, index=True
    )
    reporter_user_id = Column(
        UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True
    )
    reporter_token_hash = Column(String(64), nullable=True)
    reason = Column(String(20), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    # 부모(댓글·유저)가 지워질 때 FK 를 NULL 로 UPDATE 하려 들지 않도록 양쪽 다 걸어 둔다
    # (CLAUDE.md 의 반복된 함정).
    comment = relationship(
        "Comment",
        backref=backref("reports", cascade="all, delete-orphan", passive_deletes=True),
    )
    reporter = relationship(
        "User",
        backref=backref("comment_reports", cascade="all, delete-orphan", passive_deletes=True),
    )

    __table_args__ = (
        # 같은 사람이 같은 댓글을 여러 번 신고하지 못하게 한다. 로그인/비로그인 두 축이라
        # 부분 유니크 인덱스 두 개로 나눈다 — 한쪽은 항상 NULL 이라 합칠 수 없다.
        Index(
            "uq_comment_reports_user",
            "comment_id",
            "reporter_user_id",
            unique=True,
            postgresql_where=text("reporter_user_id IS NOT NULL"),
        ),
        Index(
            "uq_comment_reports_guest",
            "comment_id",
            "reporter_token_hash",
            unique=True,
            postgresql_where=text("reporter_token_hash IS NOT NULL"),
        ),
    )

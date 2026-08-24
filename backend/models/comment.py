import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Index, String, Text
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
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # "topster" | "tournament"
    target_id = Column(String, nullable=False)    # UUID 문자열
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # backref 쪽에도 cascade를 걸어야 한다. 빠뜨리면 부모 삭제 시 SQLAlchemy가 자식의 FK를
    # NULL로 UPDATE하려 들고, 컬럼이 nullable=False라 IntegrityError로 500이 난다.
    # DB에 ON DELETE CASCADE가 있으므로 passive_deletes=True로 삭제는 DB에 위임한다.
    user = relationship(
        "User",
        backref=backref("comments", cascade="all, delete-orphan", passive_deletes=True),
    )

    __table_args__ = (
        Index("ix_comments_target", "target_type", "target_id"),
    )

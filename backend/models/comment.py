import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Text
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import backref, relationship

from database import Base


class Comment(Base):
    __tablename__ = "comments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    topster_id = Column(UUID(as_uuid=True), ForeignKey("topsters.id", ondelete="CASCADE"), nullable=False, index=True)
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
    topster = relationship(
        "Topster",
        backref=backref("comments", cascade="all, delete-orphan", passive_deletes=True),
    )

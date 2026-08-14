import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import backref, relationship

from database import Base


class Like(Base):
    __tablename__ = "likes"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    target_type = Column(String, nullable=False)  # "topster" | "album" | "track" | "artist" | "comment"
    target_id = Column(String, nullable=False)    # Spotify ID or UUID string
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship(
        "User",
        backref=backref("likes", cascade="all, delete-orphan", passive_deletes=True),
    )

    __table_args__ = (
        UniqueConstraint("user_id", "target_type", "target_id", name="uq_like_user_target"),
    )

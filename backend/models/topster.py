import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


class Topster(Base):
    __tablename__ = "topsters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    grid_size = Column(Integer, nullable=False, default=5)  # 3, 4, 5
    is_public = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="topsters")
    items = relationship("TopsterItem", back_populates="topster", cascade="all, delete-orphan")


class TopsterItem(Base):
    __tablename__ = "topster_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topster_id = Column(UUID(as_uuid=True), ForeignKey("topsters.id", ondelete="CASCADE"), nullable=False, index=True)
    album_spotify_id = Column(String, nullable=False)
    position = Column(Integer, nullable=False)  # 0-based grid index

    topster = relationship("Topster", back_populates="items")

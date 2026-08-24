import uuid
from datetime import datetime

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import backref, relationship

from database import Base


class Topster(Base):
    __tablename__ = "topsters"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, default="")
    # 격자의 "칸 개수"다. 셀 픽셀 크기가 아니라 열/행 수 — 1x5, 2x3 같은 비정방형이 된다.
    # position 은 row * width + col 로 평탄화한 인덱스라 width 가 바뀌면 배치가 재해석된다.
    width = Column(Integer, nullable=False, default=5)
    height = Column(Integer, nullable=False, default=5)
    is_public = Column(Boolean, nullable=False, default=True)

    # --- 표시 옵션 (topsters.org의 Options 탭에 대응) ---
    # 배경색은 사용자 콘텐츠라 임의 지정을 허용한다. DESIGN.md의 "임의 색상값 금지"는
    # UI 크롬에 대한 규칙이고, 여기는 앨범 커버와 같은 층위다.
    background_color = Column(String, nullable=False, default="#18181b")
    text_color = Column(String, nullable=False, default="#ffffff")
    cell_gap = Column(Integer, nullable=False, default=4)  # px
    show_title = Column(Boolean, nullable=False, default=True)
    show_album_info = Column(Boolean, nullable=False, default=True)
    show_numbering = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship(
        "User",
        backref=backref("topsters", cascade="all, delete-orphan", passive_deletes=True),
    )
    items = relationship(
        "TopsterItem",
        back_populates="topster",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TopsterItem(Base):
    __tablename__ = "topster_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    topster_id = Column(UUID(as_uuid=True), ForeignKey("topsters.id", ondelete="CASCADE"), nullable=False, index=True)
    album_spotify_id = Column(String, nullable=False)
    position = Column(Integer, nullable=False)  # 0-based grid index

    topster = relationship("Topster", back_populates="items")

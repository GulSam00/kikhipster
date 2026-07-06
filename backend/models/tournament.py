import uuid
from datetime import datetime

from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship

from database import Base


class Tournament(Base):
    __tablename__ = "tournaments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    size = Column(Integer, nullable=False)  # 8, 16, 32
    status = Column(String, nullable=False, default="in_progress")  # "in_progress" | "completed"
    winner_track_id = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    user = relationship("User", backref="tournaments")
    rounds = relationship("TournamentRound", back_populates="tournament", cascade="all, delete-orphan")


class TournamentRound(Base):
    __tablename__ = "tournament_rounds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True)
    round_num = Column(Integer, nullable=False)   # 1=결승, 2=준결승, ...
    match_num = Column(Integer, nullable=False)   # 해당 라운드 내 경기 번호
    track_a_id = Column(String, nullable=False)   # Spotify track ID
    track_b_id = Column(String, nullable=False)
    winner_id = Column(String, nullable=True)     # 선택 전 null

    tournament = relationship("Tournament", back_populates="rounds")

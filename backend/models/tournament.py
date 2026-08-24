import uuid
from datetime import datetime

from sqlalchemy import (
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import backref, relationship

from database import Base


class Tournament(Base):
    """월드컵 '정의'. 한 판이 아니라 재사용되는 후보 풀 그 자체다.

    2026-08-22 재설계: 이전에는 Tournament 하나가 곧 한 판이라 size가 고정이고 대진이
    생성 즉시 확정됐다. 지금은 정의(풀)와 플레이(한 판)를 분리해서, 같은 월드컵을
    4강으로도 128강으로도 몇 번이든 돌릴 수 있다. 플레이가 쌓일수록 랭킹 표본도 늘어난다.
    """

    __tablename__ = "tournaments"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(String, nullable=False, default="")
    # 풀에 담기는 대상 종류. 한 월드컵 안에서는 섞이지 않는다.
    item_type = Column(String, nullable=False)  # "track" | "album"
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship(
        "User",
        backref=backref("tournaments", cascade="all, delete-orphan", passive_deletes=True),
    )
    items = relationship(
        "TournamentItem",
        back_populates="tournament",
        cascade="all, delete-orphan",
        passive_deletes=True,
        order_by="TournamentItem.position",
    )
    plays = relationship(
        "TournamentPlay",
        back_populates="tournament",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TournamentItem(Base):
    """풀에 담긴 후보 하나. item_id는 iTunes trackId 또는 collectionId(숫자 문자열)."""

    __tablename__ = "tournament_items"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String, nullable=False)
    position = Column(Integer, nullable=False)

    tournament = relationship("Tournament", back_populates="items")

    __table_args__ = (
        UniqueConstraint("tournament_id", "item_id", name="uq_tournament_item"),
    )


class TournamentPlay(Base):
    """한 번의 플레이. 풀에서 size개를 무작위로 뽑아 만든 대진을 소유한다."""

    __tablename__ = "tournament_plays"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tournament_id = Column(UUID(as_uuid=True), ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False, index=True)
    # 비로그인 플레이를 허용하므로 nullable이다. 익명 플레이도 랭킹·인기순에 집계된다.
    user_id = Column(UUID(as_uuid=True), ForeignKey("users.id", ondelete="CASCADE"), nullable=True, index=True)
    size = Column(Integer, nullable=False)  # 4 | 8 | 16 | 32 | 64 | 128
    status = Column(String, nullable=False, default="in_progress")  # "in_progress" | "completed"
    winner_item_id = Column(String, nullable=True)
    # 인기순(전체/년/월) 집계가 이 컬럼으로 기간을 자르므로 인덱스가 필요하다.
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False, index=True)

    tournament = relationship("Tournament", back_populates="plays")
    user = relationship(
        "User",
        backref=backref("tournament_plays", cascade="all, delete-orphan", passive_deletes=True),
    )
    rounds = relationship(
        "TournamentRound",
        back_populates="play",
        cascade="all, delete-orphan",
        passive_deletes=True,
    )


class TournamentRound(Base):
    """대진 한 경기. 월드컵이 아니라 '플레이'에 붙는다."""

    __tablename__ = "tournament_rounds"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    play_id = Column(UUID(as_uuid=True), ForeignKey("tournament_plays.id", ondelete="CASCADE"), nullable=False, index=True)
    round_num = Column(Integer, nullable=False)   # 1=결승, 2=준결승, ... (숫자가 클수록 앞 라운드)
    match_num = Column(Integer, nullable=False)   # 해당 라운드 내 경기 번호
    item_a_id = Column(String, nullable=False)
    item_b_id = Column(String, nullable=False)
    winner_id = Column(String, nullable=True)     # 선택 전 null

    play = relationship("TournamentPlay", back_populates="rounds")

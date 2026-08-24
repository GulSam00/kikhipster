"""worldcup pool and plays

토너먼트를 '한 판'에서 '월드컵 정의 + 플레이'로 분리한다.

- tournaments: size/status/winner_track_id 제거, title/description/item_type 추가
- tournament_items 신설 (풀, 4~512개)
- tournament_plays 신설 (한 판, user_id nullable = 비로그인 플레이 허용)
- tournament_rounds: tournament_id -> play_id, track_* -> item_*

기존 행은 새 구조로 옮길 방법이 없다(제목·풀 개념 자체가 없었음). 로컬 검증용
데이터뿐이라 그냥 버린다.

Revision ID: 3c7e2f9a41b8
Revises: 2a5c81d47b90
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "3c7e2f9a41b8"
down_revision = "2a5c81d47b90"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("tournament_rounds")
    op.drop_table("tournaments")

    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=False, server_default=""),
        sa.Column("item_type", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tournaments_user_id", "tournaments", ["user_id"])
    op.create_index("ix_tournaments_created_at", "tournaments", ["created_at"])

    op.create_table(
        "tournament_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("item_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.UniqueConstraint("tournament_id", "item_id", name="uq_tournament_item"),
    )
    op.create_index("ix_tournament_items_tournament_id", "tournament_items", ["tournament_id"])

    op.create_table(
        "tournament_plays",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        # 비로그인 플레이를 허용하므로 nullable.
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=True),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="in_progress"),
        sa.Column("winner_item_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tournament_plays_tournament_id", "tournament_plays", ["tournament_id"])
    op.create_index("ix_tournament_plays_user_id", "tournament_plays", ["user_id"])
    # 인기순(전체/년/월)이 이 컬럼으로 기간을 자른다.
    op.create_index("ix_tournament_plays_created_at", "tournament_plays", ["created_at"])

    op.create_table(
        "tournament_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("play_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tournament_plays.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_num", sa.Integer(), nullable=False),
        sa.Column("match_num", sa.Integer(), nullable=False),
        sa.Column("item_a_id", sa.String(), nullable=False),
        sa.Column("item_b_id", sa.String(), nullable=False),
        sa.Column("winner_id", sa.String(), nullable=True),
    )
    op.create_index("ix_tournament_rounds_play_id", "tournament_rounds", ["play_id"])

    # 옛 구조를 가리키던 토너먼트 댓글도 같이 정리한다.
    op.execute("DELETE FROM comments WHERE target_type = 'tournament'")


def downgrade() -> None:
    op.drop_table("tournament_rounds")
    op.drop_table("tournament_plays")
    op.drop_table("tournament_items")
    op.drop_table("tournaments")

    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False, server_default="in_progress"),
        sa.Column("winner_track_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_tournaments_user_id", "tournaments", ["user_id"])

    op.create_table(
        "tournament_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True),
                  sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_num", sa.Integer(), nullable=False),
        sa.Column("match_num", sa.Integer(), nullable=False),
        sa.Column("track_a_id", sa.String(), nullable=False),
        sa.Column("track_b_id", sa.String(), nullable=False),
        sa.Column("winner_id", sa.String(), nullable=True),
    )
    op.create_index("ix_tournament_rounds_tournament_id", "tournament_rounds", ["tournament_id"])

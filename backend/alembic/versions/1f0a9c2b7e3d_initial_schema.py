"""initial schema

Revision ID: 1f0a9c2b7e3d
Revises:
Create Date: 2026-08-13 00:00:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

# revision identifiers, used by Alembic.
revision: str = "1f0a9c2b7e3d"
down_revision: Union[str, None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("email", sa.String(), nullable=False),
        sa.Column("provider", sa.String(), nullable=False),
        sa.Column("provider_id", sa.String(), nullable=False),
        sa.Column("nickname", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_users_email"), "users", ["email"], unique=True)

    op.create_table(
        "topsters",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("title", sa.String(), nullable=False),
        sa.Column("description", sa.String(), nullable=True),
        sa.Column("grid_size", sa.Integer(), nullable=False),
        sa.Column("is_public", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_topsters_user_id"), "topsters", ["user_id"])

    op.create_table(
        "topster_items",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("topster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topsters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("album_spotify_id", sa.String(), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
    )
    op.create_index(op.f("ix_topster_items_topster_id"), "topster_items", ["topster_id"])

    op.create_table(
        "comments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("topster_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("topsters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.Text(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.Column("updated_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_comments_user_id"), "comments", ["user_id"])
    op.create_index(op.f("ix_comments_topster_id"), "comments", ["topster_id"])

    op.create_table(
        "likes",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_type", sa.String(), nullable=False),
        sa.Column("target_id", sa.String(), nullable=False),
        sa.Column("created_at", sa.DateTime(), nullable=False),
        sa.UniqueConstraint("user_id", "target_type", "target_id", name="uq_like_user_target"),
    )
    op.create_index(op.f("ix_likes_user_id"), "likes", ["user_id"])

    op.create_table(
        "tournaments",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("user_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("size", sa.Integer(), nullable=False),
        sa.Column("status", sa.String(), nullable=False),
        sa.Column("winner_track_id", sa.String(), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index(op.f("ix_tournaments_user_id"), "tournaments", ["user_id"])

    op.create_table(
        "tournament_rounds",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("tournament_id", postgresql.UUID(as_uuid=True), sa.ForeignKey("tournaments.id", ondelete="CASCADE"), nullable=False),
        sa.Column("round_num", sa.Integer(), nullable=False),
        sa.Column("match_num", sa.Integer(), nullable=False),
        sa.Column("track_a_id", sa.String(), nullable=False),
        sa.Column("track_b_id", sa.String(), nullable=False),
        sa.Column("winner_id", sa.String(), nullable=True),
    )
    op.create_index(op.f("ix_tournament_rounds_tournament_id"), "tournament_rounds", ["tournament_id"])


def downgrade() -> None:
    op.drop_table("tournament_rounds")
    op.drop_table("tournaments")
    op.drop_table("likes")
    op.drop_table("comments")
    op.drop_table("topster_items")
    op.drop_table("topsters")
    op.drop_table("users")

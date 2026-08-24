"""generalize comment target

댓글을 topster_id 고정에서 (target_type, target_id) 범용 구조로 옮긴다.
기존 행은 전부 topster 댓글이므로 target_type='topster'로 백필한다.

Revision ID: 2a5c81d47b90
Revises: 1f0a9c2b7e3d
Create Date: 2026-08-22
"""
from alembic import op
import sqlalchemy as sa

revision = "2a5c81d47b90"
down_revision = "1f0a9c2b7e3d"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("comments", sa.Column("target_type", sa.String(), nullable=True))
    op.add_column("comments", sa.Column("target_id", sa.String(), nullable=True))

    op.execute("UPDATE comments SET target_type = 'topster', target_id = topster_id::text")

    op.alter_column("comments", "target_type", nullable=False)
    op.alter_column("comments", "target_id", nullable=False)

    op.drop_index("ix_comments_topster_id", table_name="comments")
    op.drop_column("comments", "topster_id")

    op.create_index("ix_comments_target", "comments", ["target_type", "target_id"])


def downgrade() -> None:
    op.drop_index("ix_comments_target", table_name="comments")

    op.add_column(
        "comments",
        sa.Column("topster_id", sa.dialects.postgresql.UUID(as_uuid=True), nullable=True),
    )
    # topster 대상이 아닌 댓글(토너먼트 등)은 되돌릴 곳이 없어 버린다.
    op.execute("DELETE FROM comments WHERE target_type <> 'topster'")
    op.execute("UPDATE comments SET topster_id = target_id::uuid")
    op.alter_column("comments", "topster_id", nullable=False)

    op.create_foreign_key(
        "comments_topster_id_fkey", "comments", "topsters",
        ["topster_id"], ["id"], ondelete="CASCADE",
    )
    op.create_index("ix_comments_topster_id", "comments", ["topster_id"])

    op.drop_column("comments", "target_id")
    op.drop_column("comments", "target_type")

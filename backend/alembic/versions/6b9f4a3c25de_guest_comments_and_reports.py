"""guest comments and comment reports

비로그인 댓글을 허용하고(닉네임 + 작성자 토큰 해시), 댓글 신고 테이블을 추가한다.

Revision ID: 6b9f4a3c25de
Revises: 4e8b1c60d92a
Create Date: 2026-08-30
"""

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision: str = "6b9f4a3c25de"
down_revision: Union[str, None] = "4e8b1c60d92a"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    # 비로그인 댓글은 주인이 users 행이 아니다.
    op.alter_column("comments", "user_id", existing_type=postgresql.UUID(), nullable=True)
    op.add_column("comments", sa.Column("guest_nickname", sa.String(length=20), nullable=True))
    op.add_column("comments", sa.Column("guest_token_hash", sa.String(length=64), nullable=True))
    op.create_index("ix_comments_guest_token_hash", "comments", ["guest_token_hash"])

    # 주인 없는 댓글을 DB 에서 막는다.
    op.create_check_constraint(
        "comments_author_present",
        "comments",
        "user_id IS NOT NULL"
        " OR (guest_nickname IS NOT NULL AND guest_token_hash IS NOT NULL)",
    )

    op.create_table(
        "comment_reports",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "comment_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("comments.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "reporter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("reporter_token_hash", sa.String(length=64), nullable=True),
        sa.Column("reason", sa.String(length=20), nullable=True),
        sa.Column("created_at", sa.DateTime(), nullable=False),
    )
    op.create_index("ix_comment_reports_comment_id", "comment_reports", ["comment_id"])
    # 같은 사람이 같은 댓글을 두 번 신고하지 못하게. 로그인/비로그인 축이 달라 부분 인덱스 둘로 나눈다.
    op.create_index(
        "uq_comment_reports_user",
        "comment_reports",
        ["comment_id", "reporter_user_id"],
        unique=True,
        postgresql_where=sa.text("reporter_user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_comment_reports_guest",
        "comment_reports",
        ["comment_id", "reporter_token_hash"],
        unique=True,
        postgresql_where=sa.text("reporter_token_hash IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_comment_reports_guest", table_name="comment_reports")
    op.drop_index("uq_comment_reports_user", table_name="comment_reports")
    op.drop_index("ix_comment_reports_comment_id", table_name="comment_reports")
    op.drop_table("comment_reports")

    op.drop_constraint("comments_author_present", "comments", type_="check")
    op.drop_index("ix_comments_guest_token_hash", table_name="comments")
    # 되돌리려면 비로그인 댓글을 먼저 지워야 user_id 를 NOT NULL 로 되돌릴 수 있다.
    op.execute("DELETE FROM comments WHERE user_id IS NULL")
    op.drop_column("comments", "guest_token_hash")
    op.drop_column("comments", "guest_nickname")
    op.alter_column("comments", "user_id", existing_type=postgresql.UUID(), nullable=False)

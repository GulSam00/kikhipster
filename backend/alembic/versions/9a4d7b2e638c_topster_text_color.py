"""topster text color

탑스터 글자색을 사용자가 고를 수 있게 한다. 배경색을 자유롭게 고를 수 있는데
글자색이 흰색으로 고정이면 밝은 배경에서 안 보인다.

Revision ID: 9a4d7b2e638c
Revises: 7f2c9d4e15a3
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa

revision = "9a4d7b2e638c"
down_revision = "7f2c9d4e15a3"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "topsters",
        sa.Column("text_color", sa.String(), nullable=False, server_default="#ffffff"),
    )
    op.alter_column("topsters", "text_color", server_default=None)


def downgrade() -> None:
    op.drop_column("topsters", "text_color")

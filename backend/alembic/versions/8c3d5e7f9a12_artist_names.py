"""artist_names

아티스트 한국어 이름 영구 저장 표. 아티스트 상세를 처음 열 때 채운다.

Revision ID: 8c3d5e7f9a12
Revises: 6b9f4a3c25de
Create Date: 2026-10-22
"""
from alembic import op
import sqlalchemy as sa

revision = "8c3d5e7f9a12"
down_revision = "6b9f4a3c25de"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "artist_names",
        sa.Column("artist_id", sa.String(), primary_key=True),
        sa.Column("name_ko", sa.String(), nullable=True),
        sa.Column("source", sa.String(), nullable=False),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("artist_names")

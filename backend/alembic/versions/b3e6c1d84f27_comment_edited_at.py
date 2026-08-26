"""comment edited_at

댓글 화면의 "(수정됨)" 표시를 위한 컬럼. updated_at 으로는 판정할 수 없다 —
created_at/updated_at 의 default 가 각각 utcnow() 를 따로 호출해 insert 직후에도
마이크로초가 어긋나기 때문이다. 본문이 실제로 바뀔 때만 라우터가 값을 채운다.
기존 행은 NULL(= 수정된 적 없음)로 남는다.

Revision ID: b3e6c1d84f27
Revises: 9a4d7b2e638c
Create Date: 2026-08-26
"""
from alembic import op
import sqlalchemy as sa

revision = "b3e6c1d84f27"
down_revision = "9a4d7b2e638c"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("comments", sa.Column("edited_at", sa.DateTime(), nullable=True))


def downgrade() -> None:
    op.drop_column("comments", "edited_at")

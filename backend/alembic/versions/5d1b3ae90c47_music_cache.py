"""music cache

iTunes 조회 결과(앨범/트랙 메타데이터)를 캐싱하는 테이블을 만든다.

이미지 바이트가 아니라 메타데이터를 담는다. 커버는 mzstatic이 호스팅하는 URL이라
우리가 다시 서빙할 이유가 없고, 매번 부담하는 건 "이 ID의 커버 URL이 뭐냐"를
알아내는 iTunes 왕복이다. 그 답만 저장한다.

Revision ID: 5d1b3ae90c47
Revises: 3c7e2f9a41b8
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "5d1b3ae90c47"
down_revision = "3c7e2f9a41b8"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "music_cache",
        # iTunes id는 전역 고유하지만 트랙과 앨범이 같은 번호를 쓸 수 있어 타입까지 묶어 PK로 둔다.
        sa.Column("item_type", sa.String(), nullable=False),
        sa.Column("item_id", sa.String(), nullable=False),
        # payload NULL = "iTunes에 없다"는 사실 자체를 캐싱한 tombstone.
        sa.Column("payload", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("fetched_at", sa.DateTime(), nullable=False),
        sa.PrimaryKeyConstraint("item_type", "item_id"),
    )
    op.create_index("ix_music_cache_fetched_at", "music_cache", ["fetched_at"])


def downgrade() -> None:
    op.drop_index("ix_music_cache_fetched_at", table_name="music_cache")
    op.drop_table("music_cache")

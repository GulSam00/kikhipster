"""topsters.view_count, tournaments.view_count

메인 화면 카드에 조회수를 보이려고 넣었다 (2026-08-27).

**증가는 상세 GET 이 아니라 전용 `POST /{id}/view` 에서만 한다.** GET 에서 올리면
수정 화면·OG 썸네일 생성·Next 프리페치까지 전부 조회로 세어지고, 캐시가 끼면
반대로 아예 안 오른다.

기존 행이 있으므로 `server_default="0"` 으로 채운 뒤 default 를 뗀다 — 값은
애플리케이션이 채우는 컬럼이라 DB 기본값을 남겨 둘 이유가 없다.

Revision ID: 4e8b1c60d92a
Revises: 272d3ffdf30f
Create Date: 2026-08-27 16:20:00.000000

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '4e8b1c60d92a'
down_revision: Union[str, None] = '272d3ffdf30f'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None

_TABLES = ('topsters', 'tournaments')


def upgrade() -> None:
    for table in _TABLES:
        op.add_column(
            table,
            sa.Column('view_count', sa.Integer(), nullable=False, server_default='0'),
        )
        op.alter_column(table, 'view_count', server_default=None)


def downgrade() -> None:
    for table in _TABLES:
        op.drop_column(table, 'view_count')

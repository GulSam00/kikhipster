"""drop topsters.is_public

탑스터의 공개/비공개 개념을 없앤다 (2026-08-27). 이제 모든 탑스터가 공개다.

이 컬럼에 걸려 있던 것들도 같이 사라졌다: 목록·유저별 목록의 공개 필터,
상세 조회의 403 분기, 댓글 작성 시의 _assert_writable 검사.
즉 **비공개 탑스터에 대한 403 경로 자체가 없어진다.**

마이그레이션 시점에 남아 있던 비공개 탑스터는 그대로 공개된다 — 되돌릴 수 없는
쪽은 그 상태값이지 행이 아니므로, downgrade 는 컬럼만 되살리고 전부 공개(true)로 채운다.

Revision ID: 272d3ffdf30f
Revises: b3e6c1d84f27
Create Date: 2026-08-27 14:03:09.539745

"""
from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op


# revision identifiers, used by Alembic.
revision: str = '272d3ffdf30f'
down_revision: Union[str, None] = 'b3e6c1d84f27'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_column('topsters', 'is_public')


def downgrade() -> None:
    # server_default 없이 NOT NULL 컬럼을 되살리면 기존 행 때문에 실패한다.
    # 되살린 뒤 default 를 떼어 원래 모양(애플리케이션이 값을 채우는 컬럼)으로 되돌린다.
    op.add_column(
        'topsters',
        sa.Column('is_public', sa.BOOLEAN(), nullable=False, server_default=sa.true()),
    )
    op.alter_column('topsters', 'is_public', server_default=None)

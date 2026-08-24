"""topster grid and display options

grid_size(정사각형 전용) 를 width/height 로 쪼개고 표시 옵션을 추가한다.

width/height 는 격자의 "칸 개수"(열 수 / 행 수)다. 셀 픽셀 크기가 아니라서
1x5, 2x3 같은 비정방형 배치가 가능해진다. 기존 행은 정사각형이었으므로
width = height = grid_size 로 백필한 뒤 grid_size 를 지운다.

배경색은 사용자 콘텐츠라 임의 색상값을 허용한다 — DESIGN.md의 "임의 색상값 금지"는
UI 크롬에 대한 규칙이고, 여기는 앨범 커버와 같은 층위다.

Revision ID: 7f2c9d4e15a3
Revises: 5d1b3ae90c47
Create Date: 2026-08-23
"""
from alembic import op
import sqlalchemy as sa

revision = "7f2c9d4e15a3"
down_revision = "5d1b3ae90c47"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # server_default 를 줘야 기존 행에 NOT NULL 을 걸 수 있다. 이후 제거해 모델 기본값만 남긴다.
    op.add_column("topsters", sa.Column("width", sa.Integer(), nullable=False, server_default="5"))
    op.add_column("topsters", sa.Column("height", sa.Integer(), nullable=False, server_default="5"))
    op.add_column(
        "topsters",
        sa.Column("background_color", sa.String(), nullable=False, server_default="#18181b"),
    )
    op.add_column("topsters", sa.Column("cell_gap", sa.Integer(), nullable=False, server_default="4"))
    op.add_column("topsters", sa.Column("show_title", sa.Boolean(), nullable=False, server_default=sa.true()))
    op.add_column(
        "topsters",
        sa.Column("show_album_info", sa.Boolean(), nullable=False, server_default=sa.true()),
    )
    op.add_column(
        "topsters",
        sa.Column("show_numbering", sa.Boolean(), nullable=False, server_default=sa.false()),
    )

    # 기존 탑스터는 전부 정사각형이었다.
    op.execute("UPDATE topsters SET width = grid_size, height = grid_size")
    op.drop_column("topsters", "grid_size")

    for col in ("width", "height", "background_color", "cell_gap",
                "show_title", "show_album_info", "show_numbering"):
        op.alter_column("topsters", col, server_default=None)


def downgrade() -> None:
    op.add_column(
        "topsters", sa.Column("grid_size", sa.Integer(), nullable=False, server_default="5")
    )
    # 비정방형이었던 탑스터는 정사각형으로 되돌릴 수 없다 — 큰 쪽에 맞춘다.
    op.execute("UPDATE topsters SET grid_size = GREATEST(width, height)")
    op.alter_column("topsters", "grid_size", server_default=None)
    for col in ("show_numbering", "show_album_info", "show_title", "cell_gap",
                "background_color", "height", "width"):
        op.drop_column("topsters", col)

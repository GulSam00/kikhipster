from __future__ import annotations

from logging.config import fileConfig

from sqlalchemy import engine_from_config, pool

from alembic import context

# backend/ 를 실행 루트로 고정하는 프로젝트 컨벤션과 동일하게,
# alembic 명령도 반드시 backend/ 디렉토리 안에서 실행한다 (alembic.ini의 prepend_sys_path = . 가 이를 전제한다).
import models  # noqa: F401 — Base.metadata에 전체 테이블을 등록하기 위한 임포트
from config import settings
from database import Base

config = context.config

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# 접속 URL은 alembic.ini가 아니라 여기서 주입한다 — ini에 비밀값을 두지 않기 위함.
# alembic.ini는 ASCII 전용으로 유지할 것. Python 3.9의 alembic은 ini를 인코딩 지정 없이
# 읽어서 OS 로케일 코덱(한국어 Windows면 cp949)으로 디코딩하므로, 한글 주석을 넣으면
# 명령 실행 전에 UnicodeDecodeError가 난다. 한글 설명은 이 파일에 둔다.
config.set_main_option("sqlalchemy.url", settings.database_url)

target_metadata = Base.metadata


def run_migrations_offline() -> None:
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    connectable = engine_from_config(
        config.get_section(config.config_ini_section, {}),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(connection=connection, target_metadata=target_metadata)

        with context.begin_transaction():
            context.run_migrations()


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()

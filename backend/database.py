from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

from config import settings

# sslmode 등 접속 옵션은 코드에서 분기하지 않고 DATABASE_URL 자체에 위임한다.
# 예: RDS 접속 시 ...5432/kikhipster?sslmode=require
engine = create_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

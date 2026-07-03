---
name: kikhipster-backend
description: "kikhipster 프로젝트의 Python FastAPI 백엔드 구현 컨벤션. FastAPI 라우터, SQLAlchemy 모델, Pydantic 스키마, DB 설정, CORS, OpenAPI 플레이스홀더 패턴 등 백엔드 작업 시 따를 것."
---

# kikhipster 백엔드 컨벤션

## 디렉토리 구조

```
backend/
├── main.py
├── database.py
├── models/
│   ├── __init__.py
│   ├── music.py        # Artist, Album, Song
│   ├── topster.py      # Topster, TopsterAlbum
│   ├── tournament.py   # Tournament, TournamentRound
│   └── social.py       # Review, Comment, Like
├── schemas/
│   ├── __init__.py
│   └── (모델과 동일 구조)
├── routers/
│   ├── search.py
│   ├── topster.py
│   ├── tournament.py
│   ├── reviews.py
│   └── social.py
├── services/
│   └── music_api.py    # OpenAPI 플레이스홀더
├── requirements.txt
├── .env.example
└── alembic/
```

## main.py

```python
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers import search, topster, tournament, reviews, social
from database import engine, Base

Base.metadata.create_all(bind=engine)

app = FastAPI(title="kikhipster API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(search.router, prefix="/api/search", tags=["search"])
app.include_router(topster.router, prefix="/api/topsters", tags=["topster"])
app.include_router(tournament.router, prefix="/api/tournaments", tags=["tournament"])
app.include_router(reviews.router, prefix="/api/reviews", tags=["reviews"])
app.include_router(social.router, prefix="/api/social", tags=["social"])
```

## database.py

```python
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "postgresql://user:password@localhost/kikhipster")

engine = create_engine(DATABASE_URL)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
```

## 모델 패턴 (각 기능은 독립 테이블)

```python
# models/social.py
from sqlalchemy import Column, Integer, String, Text, Float, DateTime, Enum
from sqlalchemy.sql import func
from database import Base

class Review(Base):
    __tablename__ = "reviews"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, index=True, nullable=False)
    target_type = Column(Enum("artist", "album", "song", name="target_type_enum"), nullable=False)
    target_id = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    rating = Column(Float, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Comment(Base):
    __tablename__ = "comments"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    review_id = Column(Integer, index=True, nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class Like(Base):
    __tablename__ = "likes"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, nullable=False)
    target_type = Column(Enum("review", "topster", name="like_target_enum"), nullable=False)
    target_id = Column(Integer, nullable=False)
```

## Pydantic 스키마 패턴

프론트엔드 TypeScript 타입과 **필드명·타입·nullable 여부를 1:1 매핑**한다.

```python
# schemas/social.py
from pydantic import BaseModel
from datetime import datetime
from typing import Literal, Optional

class ReviewCreate(BaseModel):
    target_type: Literal["artist", "album", "song"]
    target_id: int
    content: str
    rating: float

class ReviewResponse(BaseModel):
    id: int
    user_id: int
    target_type: str
    target_id: int
    content: str
    rating: float
    created_at: datetime

    model_config = {"from_attributes": True}
```

## OpenAPI 플레이스홀더

```python
# services/music_api.py

# TODO: [OpenAPI] 음악 API 미정. 연동 시 아래 함수들을 교체할 것.

def search_artists(query: str) -> list[dict]:
    """외부 음악 API로 아티스트 검색 (현재 mock)"""
    return [{"id": "mock_1", "name": f"Mock: {query}", "image_url": None}]

def search_albums(query: str) -> list[dict]:
    """외부 음악 API로 앨범 검색 (현재 mock)"""
    return [{"id": "mock_1", "title": f"Mock: {query}", "cover_url": None}]

def get_artist_detail(artist_id: str) -> dict | None:
    """아티스트 상세 정보 (현재 mock)"""
    return {"id": artist_id, "name": "Mock Artist", "genre": "Unknown"}
```

## .env.example

```
DATABASE_URL=postgresql://user:password@localhost:5432/kikhipster
```

## requirements.txt

```
fastapi==0.115.0
uvicorn[standard]==0.30.0
sqlalchemy==2.0.0
psycopg2-binary==2.9.9
pydantic==2.0.0
python-dotenv==1.0.0
alembic==1.13.0
```

## DB 테이블 목록

| 기능 | 테이블 |
|------|-------|
| 사용자 | `users` |
| 음악 데이터 | `artists`, `albums`, `songs` |
| 탑스터 | `topsters`, `topster_albums` |
| 토너먼트 | `tournaments`, `tournament_rounds` |
| 리뷰 | `reviews` |
| 댓글 | `comments` |
| 좋아요 | `likes` |

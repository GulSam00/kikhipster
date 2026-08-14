from __future__ import annotations

from typing import Annotated, Any
from uuid import UUID

from pydantic import BeforeValidator


def _uuid_to_str(value: Any) -> Any:
    return str(value) if isinstance(value, UUID) else value


# 모델 PK/FK는 postgresql.UUID(as_uuid=True) 라서 SQLAlchemy가 UUID 객체를 돌려주는데,
# Pydantic v2는 UUID -> str 자동 변환을 하지 않는다. from_attributes 응답 스키마에서
# 이 컬럼들을 그냥 `str` 로 선언하면 행이 하나라도 있는 순간 ValidationError로 500이 난다.
# 프론트 타입(types/)은 전부 string이므로 문자열로 정규화해서 내보낸다.
UUIDStr = Annotated[str, BeforeValidator(_uuid_to_str)]

# 빌드 컨텍스트는 backend/ 디렉토리여야 한다 (예: docker build -f backend/Dockerfile backend/).
# backend/ 안의 코드가 절대 경로 import(`from config import settings` 등)를 쓰기 때문에,
# 이 디렉토리의 내용이 그대로 워킹 디렉토리 루트(/app)가 되어야 한다.
FROM python:3.9-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

EXPOSE 8000

# 스키마 마이그레이션은 이 컨테이너 기동 로직에 넣지 않는다.
# alembic upgrade head는 배포 단계에서 별도 원샷 태스크(aws ecs run-task)로 1회만 실행한다 —
# 컨테이너가 여러 개로 스케일될 때 동시 실행되는 걸 막기 위함.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

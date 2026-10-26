---
id: 20261027-0008-set-app-env-production-on-deploy
title: 배포 환경변수에 `APP_ENV=production` 설정
status: later
priority: high
created: 2026-10-27
external:
---

## 맥락

`APP_ENV=production` 이면 약한 `JWT_SECRET_KEY`(placeholder 이거나 32자 미만)가 기동 실패로 이어진다.
개발 환경(`development`)은 경고만 한다. 배포 때 이 값을 넣지 않으면 약한 시크릿이 조용히 운영에 올라간다.
T4(AWS 실습)에서 ECS 태스크 정의에 넣어야 한다. 시크릿 값 자체는 이슈나 코드에 적지 않는다.

## 완료 조건

- [ ] ECS 태스크 정의(또는 Terraform)에 `APP_ENV=production` 포함
- [ ] 시크릿은 환경변수/Secrets Manager 로 주입하고 32자 이상인지 확인
- [ ] 배포 후 기동 로그에 JWT 경고가 없는지 확인

## 로그

- 2026-10-27: 10-09 JWT 검증 도입 때 나온 후속

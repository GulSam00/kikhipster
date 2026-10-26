---
id: 20261027-0010-api-fetch-token-auto-refresh
title: `apiFetch` 토큰 만료 시 자동 갱신
status: later
priority: medium
created: 2026-10-27
external:
---

## 맥락

백엔드는 JWT 발급·갱신(`/api/auth/refresh`)을 제공하지만 프론트 `apiFetch` 는 401 을 받아도 갱신하지 않는다.
토큰이 만료되면 사용자는 로그인 화면으로 돌아가야 한다. `lib/api/client.ts` 에서 401 → 갱신 → 원 요청 재시도 흐름이 필요하다.
동시 요청이 여러 개 401 을 받아도 갱신은 한 번만 하도록 묶어야 한다.

## 완료 조건

- [ ] 401 응답 시 refresh 토큰으로 한 번 갱신하고 원 요청을 재시도
- [ ] 동시에 여러 요청이 401 이어도 갱신 호출은 1회
- [ ] 갱신 실패 시 토큰을 지우고 로그인 안내 (`kikhipster:auth-change` 이벤트 발행)
- [ ] 테스트 추가

## 로그

- 2026-10-27: 세션 요약의 미착수 후속 항목에서 옮겨 적음

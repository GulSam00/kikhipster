---
id: 20261027-0013-check-aws-credits-before-t4
title: AWS 실습 착수 전 크레딧·프리 티어 잔여 확인
status: later
priority: medium
created: 2026-10-27
external:
---

## 맥락

TASKS.md T4 에서 '유일한 미결 변수'로 적힌 항목. 1단계(ECR 푸시 + Fargate 태스크 단독 기동) 착수 전에 확인해야 한다.
배포 원칙은 CLAUDE.md: 부품을 우회하지 않고, 상시 구동하지 않는다(apply → 실습 → destroy 사이클).

## 완료 조건

- [ ] AWS 크레딧 잔액과 만료일 확인
- [ ] 프리 티어 잔여 기간 확인
- [ ] 예산 알림(Budgets) 설정
- [ ] 확인 결과를 로그에 한 줄로 기록 (금액·계정 식별 정보는 적지 않는다)

## 로그

- 2026-10-27: TASKS.md T4 에서 옮겨 적음

---
id: 20261113-1630-i18n-ui-strings-next-intl
title: UI 문자열 다국어 기반 도입 (한국어·영어·일본어)
status: doing
priority: medium
summary: next-intl 로 UI 문자열을 ko/en/ja 메시지 파일로 빼고, 언어 선택 방식을 정해 프론트·백엔드에 locale 을 흘린다
created: 2026-11-13
external:
---

## 맥락

상위 이슈 `20261113-0641-i18n-en-ja-zh-support` 의 ① 층. 범위는 **한국어·영어·일본어**(중국어 제외, 2026-11-13 사용자 결정).
지금 UI 문자열은 컴포넌트에 한국어로 하드코딩돼 있고 i18n 라이브러리가 없다. App Router 에서는 `next-intl` 이 사실상 표준이다
(Server Component 에서 `getTranslations`, Client 에서 `useTranslations`).

**이 이슈가 다른 하위 이슈의 전제다** — 사용자의 언어가 무엇인지(locale)를 정하고 백엔드 요청에 실어 보내는 통로를 여기서 만든다.
`20261113-1630-i18n-localized-music-names` 는 그 locale 을 받아 쓴다.

## 결정할 것 (착수 전, 사용자)

- [x] 언어 선택 방식 — **(b) 쿠키 + 언어 전환 UI** (2026-11-13 사용자 결정).
      - 라우트는 그대로 둔다(`app/[locale]/` 로 옮기지 않는다 — next-intl 의 "without i18n routing" 구성).
      - 우선순위: 쿠키 → 쿠키가 없으면 `Accept-Language` 에서 ko/en/ja 중 첫 일치 → 없으면 `ko`.
      - 버린 선택지: (a) URL prefix — 라우트 전체 이전 비용 대비 SEO 이득이 이 프로젝트 목적(AWS 실습)에 작다. (c) 는 사용자가 못 바꾼다.
      - **주의:** 쿠키를 읽으면 그 페이지는 정적 prerender 가 안 되고 동적 렌더가 된다. 홈은 과거 "정적 prerender" 배포 버그가
        났던 자리다(WORKLOG 참조) — `pnpm build` 출력에서 각 라우트가 ○(static)/ƒ(dynamic) 중 무엇이 됐는지 확인하고, 바뀐 것을 로그에 적는다.

## 완료 조건

- [ ] `pnpm add next-intl`(npm install 금지 — CLAUDE.md) 후 ko/en/ja 메시지 파일과 locale 해석 미들웨어
- [ ] 쿠키를 쓰는 언어 전환 UI(Navbar, 모바일 하단 탭 포함 어디서든 닿게) (shadcn 프리미티브 위에서, DESIGN.md 토큰)
- [ ] 기존 하드코딩 문자열을 메시지 키로 이전. 누락 키는 빌드/테스트에서 잡히게(ko 를 기준 스키마로 en·ja 키 일치 검사)
- [ ] 백엔드 `/api/music/*` 호출에 locale 을 싣는 공통 경로(`lib/api/client.ts`) — 값의 형식은 `ko|en|ja`
- [ ] `<html lang>` 이 locale 을 따른다
- [ ] 320px 에서 영어·일본어 라벨이 넘치지 않는지(모바일 하단 탭 `text-xs` 라벨이 가장 위험) — 브라우저 확인은 사람

## 로그

- 2026-11-13: 상위 이슈에서 분할
- 2026-11-13: 언어 선택 방식 (b) 쿠키로 결정
- 2026-11-13: 착수

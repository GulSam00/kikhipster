---
id: 20261113-1630-i18n-artist-names-ja-en
title: 아티스트 이름 현지화를 일본어·영어로 확장 (Wikidata)
status: todo
priority: low
summary: 한국어 전용인 artist_names(Wikidata)를 locale 별 이름으로 넓힌다. iTunes 는 어느 스토어도 아티스트 이름을 현지화하지 않는다
created: 2026-11-13
external:
---

## 맥락

상위 이슈 `20261113-0641-i18n-en-ja-zh-support` 의 ② 층 중 아티스트 부분. 앨범·곡 이름과 따로 둔 이유:
2026-11-13 실측에서 **아티스트 lookup 은 US·JP·TW·HK·CN·KR 전부 원어 그대로**(`BTS`, `IU`, `Taylor Swift`)였다.
스토어를 바꿔도 안 되므로, 한국어 이름을 Wikidata(P2850 = Apple Music 아티스트 ID, `backend/services/artist_names.py`)에서
가져오는 지금 방식을 언어 축으로 넓혀야 한다.

- 영어(`en`): iTunes 원어 이름을 그대로 쓰면 된다 — 대부분 이미 영문/원어. 추가 조회 불필요할 가능성이 높다.
- 일본어(`ja`): Wikidata `ja` 라벨. 표본으로 적중률을 먼저 잰다(한국어는 일반 검색어 표본에서 약 41% — `_workspace/spike_ko_names_README.md`).

`artist_names` 테이블이 한국어 한 칸이면 스키마 변경(언어 컬럼 또는 언어별 행)이 필요하다 — 착수 시 모델부터 확인.

## 완료 조건

- [ ] Wikidata `ja` 라벨 적중률 실측(K-POP·J-POP·서양 아티스트 섞은 표본)과 결과 기록
- [ ] `artist_names` 를 언어별로 저장하도록 모델·마이그레이션(alembic) 변경 — 관계에 `cascade="all, delete-orphan", passive_deletes=True`(CLAUDE.md)
- [ ] 아티스트 상세·검색 카드가 locale 에 맞는 이름(없으면 원어)을 보인다. 레이아웃 규칙은 기존 한국어(현지 이름 제목 + 원어 부제)와 같게
- [ ] 백엔드 테스트(`test_artist_names.py` 확장, 외부 호출은 MockTransport)

## 로그

- 2026-11-13: 상위 이슈에서 분할. 앨범·곡 이름 이슈(`20261113-1630-i18n-localized-music-names`)에 의존하지 않지만 locale 전달 통로는 UI 이슈에 의존

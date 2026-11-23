---
id: 20261123-1433-sibling-edition-tracks-other-storefront
title: KR 판 앨범의 아티스트 목록 폴백(A-2)이 찾은 그 밖 판도 country 없는 lookup 에선 트랙 0 — JP 등 다른 스토어에서만 곡이 옴
status: later
priority: medium
summary: A-2 가 매칭한 판 ID 가 US 에서 collection 만 주는 경우(Breakthrough 는 JP 에서만 곡, Dirty Work 는 어디서도) — 실측 표본에서 A-2 단독 성공 0건
created: 2026-11-23
external:
---

## 맥락

이슈 `20261119-1455-kr-only-album-id-no-tracks` 구현 후 실제 iTunes 로 확인(2026-11-23).
A-2(`backend/services/music_api.py` `_sibling_tracks_from_artist`: 아티스트 `lookup entity=album`(country 없음)에서
같은 artistId + 정규화 이름 + trackCount ±2 판을 찾고 `lookup entity=song`(country 없음))는 매칭 자체는 하지만,
매칭된 판이 country 없는 `entity=song` 에서 **collection 1 + track 0** 을 줬다.

| KR 판 ID | 앨범 | A-2 매칭 판 | country 없음 | `country=US` | `country=JP` |
|----------|------|-------------|--------------|--------------|--------------|
| 1473909749 | TWICE Breakthrough - EP | 1465709258 | 1 + 0 | — | **1 + 4** |
| 1822247873 | aespa Dirty Work (Remixes) - Single | 1822245352 | 1 + 0 | 1 + 0 | 결과 0 |

이슈 1455 실측의 "A-list 만 찾은 것" 3건은 위 2건 + 합작 `K-POP ScreaM 2`(artistId 불일치라 이제 매칭 안 함)였다.
즉 표본 28건 기준 **A-2 가 실제로 트랙을 채우는 경우는 아직 0건**이고, 지금은 그 앨범을 열 때마다
0곡(캐시 안 함) + iTunes 호출 5~6회가 든다.

`entity=song` + `country=KR` 이 트랙 0 인 것은 KR 카탈로그가 비어서이고, JP 는 트랙을 준다(Breakthrough).
CLAUDE.md 의 "entity=song 에 country 를 넘기지 않는다" 함정은 KR 기준이라, JP 를 시도하려면 먼저 실측으로
범위를 확인해야 한다. 판의 스토어를 알려 주는 필드는 목록 레코드에 없다(`country` 가 USA 로 옴).

## 완료 조건

- [ ] A-2 매칭 판이 country 없음에서 트랙 0 일 때 JP 등 다른 스토어프론트로 한 번 더 묻는 것이 효과가 있는지 표본으로 실측(호출 수·403 포함)
- [ ] 효과가 없으면 A-2 를 걷어낼지(호출만 늘리는지), 아티스트 목록을 캐시할지 결정

## 로그

- 2026-11-23: 이슈 20261119-1455 구현 후 실제 iTunes 확인 중 발견, later 로 기록

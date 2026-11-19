---
id: 20261119-1455-kr-only-album-id-no-tracks
title: KR 스토어 전용 collectionId 앨범 상세가 트랙 0개로 열림 — ③ 검색이 그 밖 판 ID 로만 옴
status: later
priority: medium
created: 2026-11-19
external:
---

## 맥락

이슈 20261112-1607 재실측(2026-11-19) 중 발견. aespa 처럼 같은 앨범이 스토어프론트마다 다른
collectionId 를 갖는 경우가 있다(Armageddon: KR 판 `1745285216`, 그 밖 판 `1773694541`).

`backend/services/music_api.py` `get_album_tracks` 에 KR 판 ID 가 들어오면:
- ① `/lookup?entity=song`(country 없음) → 결과 0
- ② `country=KR` → collection 1 + track 0 (`entity=song` + country 는 어느 앨범이든 track 0)
- ③ `_search_album_tracks` → US 검색 결과가 그 밖 판 ID(1773694541)로 와서 `collectionId` 필터에
  하나도 안 걸림(18건 중 1745285216 0건, country 생략도 같음). Whiplash KR 판 1772644600 도 동일.

결과: 404 는 아니지만 트랙 0개인 앨범 상세. KR 판 ID 는 아티스트 lookup(`entity=album&country=KR`)
경로로 들어올 수 있다(aespa 는 KR 69건 중 43건이 KR 전용 ID).

## 완료 조건

- [ ] KR 전용 ID 가 실제 사용자 경로(아티스트 상세 앨범 목록 등)로 들어오는지 확인
- [ ] 트랙을 채울 방법 결정(예: 이름·아티스트로 그 밖 판 collectionId 를 찾아 그 ID 로 lookup) — 실측 근거와 함께
- [ ] `tests/test_music_storefront.py` 에 회귀 테스트

## 로그

- 2026-11-19: 이슈 20261112-1607 재실측 중 발견, later 로 기록

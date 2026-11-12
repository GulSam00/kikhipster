---
id: 20261112-1548-album-detail-warms-track-cache-wrong-shape
title: 앨범 상세가 `track` 배치 캐시에 스키마가 다른 payload 를 덮어쓴다
status: later
priority: low
created: 2026-11-12
external:
---

## 맥락

`backend/routers/music.py` 의 `get_album_tracks` 라우트는 `_warm_item_cache(db, "track", result["tracks"])` 로
트랙을 배치 캐시에 적는다. 그런데 이 트랙들은 `TrackItem` 모양(`track_number` 있음, `album` 없음)이고,
배치 조회(`/api/music/tracks?ids=`)는 캐시를 `TrackSearchItem`(필수 `album`)으로 검증한다.
검증에 실패하면 미스로 취급하므로:

1. 데우기 효과가 없다 — 앨범 상세를 본 직후의 배치 조회도 iTunes 를 부른다.
2. **이미 있던 올바른 `TrackSearchItem` 캐시를 upsert 로 덮어써** 미스로 만든다. 배치 조회가 다시 받아와 고치고,
   상세를 열면 또 덮인다(스스로 낫지만 핑퐁).

이슈 20261027-0008(라우터 테스트)을 하다가 `tests/fake_itunes.py` 대역으로 확인했다 — 배치 조회로 캐시를 채운 뒤
앨범 상세를 열면, 다음 `/api/music/tracks?ids=` 가 `/lookup?country=KR` 을 다시 1회 부른다.

## 완료 조건

- [ ] 상세 트랙을 `TrackSearchItem` 모양(앨범 정보 포함)으로 바꿔 적거나, 이 데우기를 없앤다 — 어느 쪽인지 결정
- [ ] "앨범 상세 → 배치 조회가 iTunes 0회" 테스트를 `tests/test_music_router.py` 에 추가

## 로그

- 2026-11-12: 이슈 20261027-0008 작업 중 발견, later 로 기록

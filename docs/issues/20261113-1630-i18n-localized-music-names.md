---
id: 20261113-1630-i18n-localized-music-names
title: 앨범·곡 이름을 사용자 언어로 (ko→KR, ja→JP, en→US lookup)
status: todo
priority: medium
summary: 이름을 받아 오는 lookup 스토어를 locale 별로 바꾸고(ja=JP, en=US), 캐시 키에 locale 을 넣는다. 검색 스토어는 US 그대로
created: 2026-11-13
external:
---

## 맥락

상위 이슈 `20261113-0641-i18n-en-ja-zh-support` 의 ② 층. 전제: `20261113-1630-i18n-ui-strings-next-intl` 이 locale(`ko|en|ja`)을 백엔드로 보낸다.

지금 구조(`backend/services/music_api.py`): **검색은 US 스토어, 이름은 KR lookup 으로 갈아끼운다**(`_localized_search_items`,
`_lookup_chunked` 의 `LOOKUP_COUNTRY = "KR"` → 못 찾은 것만 country 생략 재조회). 2026-11-13 실측으로
이름 현지화는 **스토어 단위**임이 확인됐다 — 宇多田 앨범의 artistName 이 US `Hikaru Utada` / JP `宇多田ヒカル`.
그래서 `LOOKUP_COUNTRY` 를 locale 에 따라 KR/JP/US 로 고르면 같은 구조가 그대로 확장된다. `lang=ja_jp` 는 효과 없음.

**검색 스토어는 바꾸지 않는다.** 일본어 검색어(`宇多田ヒカル`)는 US 에서도 10건이 찾힌다. 검색 스토어를 넓히면
스토어 전용 ID 문제(CLAUDE.md, TW 사례)를 끌고 들어오므로 이 이슈 범위 밖이다.

## 완료 조건

- [ ] locale → lookup 스토어 매핑(ko=KR, ja=JP, en=US)을 한 곳에 정의. `LOOKUP_COUNTRY` 고정값 제거
- [ ] **폴백 유지**: 그 스토어에 없는 앨범은 country 생략으로 재조회(KR 에 없는 서양 앨범, JP 에 없는 KR 전용 앨범 둘 다).
      이 폴백을 빠뜨리면 저장된 탑스터 커버가 조용히 사라진다 — `tests/test_music_storefront.py` 의 폴백 테스트를 locale 별로 확장
- [ ] `get_album_tracks` 의 `_localize_names` 도 locale 스토어로(`preview_url` 은 덮지 않는다 — 기존 규칙)
- [ ] **`music_cache` 키에 locale 포함** — 지금 키(`{id}:{market}` 등)에 locale 이 없으면 일본어 이름이 한국어 사용자에게 섞인다.
      기존 행 처리(키 형식이 바뀌면 옛 행은 자연 미스 → 30일 TTL 로 소멸하는지) 판단을 로그에 기록
- [ ] 실측 표본 추가: JP lookup 에서 한국 앨범·곡 이름이 어떻게 오는지(원어 유지인지), KR 전용 앨범이 JP 에 없을 때 폴백이 실제로 채우는지
- [ ] 백엔드 테스트(실제 iTunes 호출 금지, `fake_itunes.py` 대역)

## 로그

- 2026-11-13: 상위 이슈에서 분할

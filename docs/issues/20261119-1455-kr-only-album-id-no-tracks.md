---
id: 20261119-1455-kr-only-album-id-no-tracks
title: KR 스토어 전용 collectionId 앨범 상세가 트랙 0개로 열림 — ③ 검색이 그 밖 판 ID 로만 옴
status: doing
priority: high
summary: KR 판 ID 앨범 상세가 트랙 0개 — 이전 1548 수정(③ US 검색)으로도 안 풀린다. 고칠 방향(이름 매칭 vs 그 밖 판 ID 통일) 실측 비교부터
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

## 실측 (2026-11-20)

실제 iTunes, 호출 간격 3.6초, **200 응답만 집계**. 총 225회 호출(200 응답 212, 403 13회 → 대기 후 재시도로 전부 회복).
스크립트·원시 응답은 레포 밖(세션 scratchpad `issue1455/`)에 두었다 — 커밋하지 않음.

### 1. KR 전용 ID 가 들어오는 사용자 경로 (코드 확인)

| 경로 | ID 출처 | KR 전용 ID? |
|------|---------|-------------|
| **아티스트 상세 → 앨범 카드 링크 / 재생 버튼** | `frontend/app/artists/[id]/page.tsx:113` `AlbumCard` → `components/music/AlbumCard.tsx:59` `/albums/{id}`, `:68` `AlbumPlayButton` → `lib/domain/playable.ts:59` `getAlbumWithTracks`. 목록은 `lib/api/music.ts:60` `/artists/{id}/albums`(market 미지정) → `routers/music.py:283` 기본 `market="KR"` → `music_api.py` `get_artist_albums` 의 `lookup entity=album&country=KR` | **예 — 유일한 실경로** |
| 앨범 검색 | `search_albums` → `_search_country` 로 US | 아니오 (표본 28건의 US 앨범 검색 결과 어디에도 KR 전용 ID 없음) |
| 곡 검색 / 월드컵 곡 담기 | `search_tracks`(US). 곡 월드컵의 "앨범 펼치기"는 `use-tournament-draft.ts:122` `searchAlbums` → `:176` `getAlbumWithTracks` | 아니오 |
| 탑스터 저장 | `lib/hooks/use-topster-draft.ts:120` `searchAlbums(q,10)` 만 씀 — 아티스트 페이지에서 담는 경로 없음 | 아니오 |
| 앨범 월드컵 풀 | `use-tournament-draft.ts:122` `searchAlbums` | 아니오 |

- 즉 **지금 코드로는 탑스터·월드컵에 KR 전용 ID 가 저장되지 않는다.** 단 2026-10-05(`a27146f`) 전에는 검색이
  `country=KR` 이었다 — 그때 검색이 결과를 줬다면 KR 판 ID 가 저장됐을 수 있다(09-10 실측은 0건). 로컬·운영 DB 를
  조회하지 못해 **저장된 데이터에 KR 전용 ID 가 있는지는 확인 못 함.**
- `album_tracks` 캐시 키는 `{album_id}:{market}`(`routers/music.py:327`), TTL 30일 — 지금 KR 전용 ID 를 연 적이 있으면
  **트랙 0개 응답이 30일 동안 그대로 나간다.**

### 2. 규모 — 아티스트 lookup `entity=album&limit=200`, KR vs country 생략

| 아티스트 | KR | 생략 | **KR 전용** | 생략 전용 | 앞 50개 중 KR 전용 |
|----------|----|------|-------------|-----------|---------------------|
| aespa | 69 | 79 | **43** | 53 | 33/50 |
| TWICE | 73 | 98 | **69** | 94 | 47/50 |
| Stray Kids | 72 | 125 | **65** | 118 | 46/50 |
| NCT 127 | 40 | 39 | **28** | 27 | 28/40 |
| RIIZE | 30 | 30 | **27** | 27 | 27/30 |
| IVE | 40 | 42 | **21** | 23 | 21/40 |
| LE SSERAFIM | 59 | 156 | **14** | 111 | 12/50 |
| SHINee | 42 | 52 | 10 | 20 | 10/42 |
| Red Velvet | 42 | 42 | 9 | 9 | 9/42 |
| EXO | 47 | 49 | 4 | 6 | 4/47 |
| IU | 55 | 55 | 1 | 1 | 1/50 |
| NewJeans / BTS / ZICO | 16 / 83 / 37 | 16 / 128 / 37 | 0 | 0 / 45 / 0 | 0 |
| **합계** | 705 | | **291 (41%)** | 534 | **238/594 (40%)** |

aespa(SM)만의 문제가 아니다 — TWICE·Stray Kids(JYP)는 아티스트 페이지 앨범이 **거의 전부** KR 전용 ID 다.
("앞 50개"는 limit=200 응답의 앞 50개로 근사. 실제 화면은 limit=50 요청이라 순서가 다를 수 있다.)

### 3. KR 전용 ID 표본 28건 (aespa 13 · TWICE 4 · Stray Kids 4 · NCT 127 3 · IVE 3 · IU 1)

- **28/28 전부** ① `entity=song`(country 없음) 결과 0, ② `country=KR` collection 1 + track 0, 지금의 ③(US 곡 검색 + `collectionId` 필터) 0곡. 이슈 증상이 표본 전체에서 재현된다.
- 매칭 키는 "같은 artistId + 정규화 collectionName"(NFKC·소문자·공백 축약·` - EP`/` - Single` 꼬리 제거).

| 방식 | 추가 호출 | 찾음 | 0개 | 모호 | 트랙 실제로 옴 | 문제 사례 |
|------|-----------|------|-----|------|----------------|-----------|
| **A-song**: 지금 ③ 곡 검색 그대로, 필터만 `collectionId` → artistId+이름 | **0** | 23 | 5 | 0 | 23/23 (preview 전부 있음) | Whiplash (English Version): KR 3곡 판인데 1곡짜리 판으로 매칭 |
| **A-album**: US 앨범 검색(이름) → 매칭 ID 로 `lookup entity=song` | +2 | 23 | 5 | 0 (tiebreak 후) | 23/23 | 위와 같은 1건 |
| **A-list**: 아티스트 lookup `entity=album`(country 생략) 목록에서 이름 매칭 → `lookup entity=song` | +2 (목록은 아티스트 단위 캐시 가능) | 24 | 4 | 0 (trackCount→releaseDate tiebreak) | — (매칭 ID 가 A-album 과 같은 20건은 확인됨) | — |
| A-song ∪ A-list | 0~+2 | **26** | 2 | | | |

- 둘 다 못 찾은 2건: IU `Believe in Love (From "Love Request")`, Stray Kids `TOP (Japanese Ver.) - EP` — 그 밖 판이 아예 없는 KR 전용 콘텐츠로 보인다.
- A-song/A-album 만 찾은 것: aespa iScreaM Vol.26, Drama(아티스트 목록에 그 밖 판이 안 실려 있음). A-list 만 찾은 것: K-POP ScreaM 2(아래 artistId), Dirty Work (Remixes)(US 검색 0건), TWICE Breakthrough(US 검색이 동명 다른 곡만 줌).
- **트랙 수**: 매칭 판 lookup 은 대개 `trackCount-1` 곡을 준다(Armageddon 11→10, LEMONADE 13→12). 기존 그 밖 판의 동작과 같다.
- **artistId**: 단일 아티스트 앨범은 KR·그 밖 판 artistId 가 같다(매칭된 23건 전부). **예외 1건** — 합작 `K-POP ScreaM 2` 는 KR 판 artistId `1235849306`(NCT 127 & aespa), US 판 `1540251304`(aespa & NCT 127): 대표 아티스트 순서가 바뀌어 artistId 가 다르다. 합작은 artistId 를 매칭 키로 못 믿는다.
- **이름 한국어화**: 매칭된 그 밖 판 ID 를 `lookup country=KR` 하면 23건 중 **2건만** 응답(나머지 0건). 앨범 상세의 `_localize_names` 가 곡 제목을 한국어로 못 바꾼다 — 화면에 영문 곡 제목이 남는다.

### 4. 아티스트 목록 전체 대상 이름 매칭 (추가 호출 없음, 아티스트 lookup 두 벌로 계산)

KR 전용 291건 → country 생략 목록에서 artistId 안의 이름 매칭, trackCount→releaseDate 로 tiebreak:

| 결과 | 건수 |
|------|------|
| 정확히 1개 | 244 (84%) — tiebreak 전 후보 여럿이던 35건 포함 |
| 0개 | 43 (15%) — 이 중 일부(iScreaM Vol.26, Drama)는 US 검색으로는 찾힘 |
| tiebreak 후에도 여러 개 | 4 (1%) |
| 1개지만 trackCount 다름 | 26 — 대부분 ±1(TWICE `MORE & MORE` 8↔7 등, KR 판이 1곡 더 많음). **오매칭 의심 1건**: TWICE `ENEMY - Single` 1곡(2025-07-30) ↔ 9곡(2025-08-26) |
| 1개지만 releaseDate 다름 | 28 — 예: TWICE `One More Time - EP` KR 2018-02-07 ↔ 2017-10-18(4곡으로 같음, 같은 EP 로 보임) |

### 5. 후보 B — 그 밖 판(country 생략) ID 로 목록 통일

- 그 밖 판 전용 ID 534건을 `lookup country=KR`(배치) 하면 **0건 해결(0/534)**. 즉 B 로 바꾸면 그 앨범들은 **KR 이름·KR 표기 아티스트명을 받을 길이 없다**(앨범 제목은 원래 같지만 `아이유` 같은 아티스트명·곡 제목 한국어화가 빠진다).
- KR 목록 대비 B 에서 사라지는 앨범: 이름 매칭 0개 43/291(정규화를 느슨히 해도 32). 예: aespa `Drama - The 4th Mini Album`·`Jingle Bell Rock (Sped Up)`, NCT 127 `NCT RESONANCE Pt.1/2`, TWICE `#TWICE2~5`, `I GOT YOU (Voyage Version)`.
- 반대로 생기는 앨범: 생략 목록에만 있는 534건(LE SSERAFIM 59→156, BTS 83→128 — 대부분 일본판·리믹스). limit=50 이라 화면 구성이 크게 바뀐다.
- 이미 저장된 KR 판 ID 는 B 로 해결되지 않는다(1 절 — 지금 코드로는 저장 경로가 없지만 과거 데이터·외부 링크·캐시는 확인 못 함).

## 방향 비교

| | A — 앨범 상세에서 그 밖 판을 찾아 트랙만 빌려 옴 | B — 아티스트 목록을 그 밖 판 ID 로 통일 |
|---|---|---|
| 고치는 자리 | `get_album_tracks` ③ (상세 1곳) | `get_artist_albums` (목록 1곳) |
| 커버 범위 | KR 전용 ID 가 어디서 오든(목록·직접 URL·과거 저장 데이터) | 아티스트 목록 경로만. 과거 저장분·캐시·외부 링크는 그대로 0곡 |
| 표본 성공률 | A-song 23/28, A-song→A-list 2단 26/28 | 해당 없음(목록에서 43/291 앨범이 사라짐) |
| 추가 iTunes 호출 | A-song 0회(기존 ③ 호출의 필터만 바꿈). 폴백 A-list 는 +2회(아티스트 목록 1 — 캐시 가능, 매칭 ID `entity=song` 1). KR 전용 ID 의 첫 조회에만 들고 결과는 `album_tracks` 에 30일 캐시 | 아티스트 목록 1회 그대로(country 만 바꿈) |
| 이름 | 앨범 제목·아티스트명은 ② KR 레코드 그대로. 곡 제목은 그 밖 판이라 KR lookup 이 대부분 0건 → 영문 | 목록·상세 모두 KR lookup 이 0/534 → 한국어 이름 상실 |
| 위험 | 오매칭(trackCount 1 vs 9 같은 사례 1/291, Whiplash English 판 혼동 1/28) — trackCount 차이 상한(예: ±2)·releaseDate 일치를 조건으로 걸어야 함. 합작은 artistId 가 바뀔 수 있음(1/28). 응답의 `album.id` 는 KR ID 로 두고 트랙의 소속 앨범만 그 밖 판이 됨 | KR 전용 콘텐츠 소실, 목록 구성 대폭 변경, 저장 데이터와 ID 불일치 |
| 캐시 | 키 `{kr_id}:KR` 그대로 쓸 수 있음. **배포 시 트랙 0개인 `album_tracks` 행을 지워야** 30일 동안 0곡이 안 남음(또는 0곡 결과를 캐시하지 않거나 짧은 TTL) | `artist_albums` 는 1일 TTL 이라 자연 소멸. 0곡 `album_tracks` 행 문제는 동일하게 남음 |

**권고: A (2단).** ③ 의 기존 US 곡 검색에서 필터를 `collectionId 일치 → 없으면 같은 artistId + 정규화 이름(+ trackCount 차이 ≤2, 여러 판이면 trackCount→releaseDate)` 로 넓히고(추가 호출 0),
그래도 0곡이면 아티스트 lookup(country 생략) 목록에서 같은 규칙으로 찾아 `lookup entity=song` 한다(+2회).
함께 할 것: 0곡 `album_tracks` 캐시 행 정리(또는 0곡은 캐시 안 함), 회귀 테스트(fake_itunes 로 KR 판/그 밖 판 쌍, 합작 artistId 불일치, trackCount 큰 차이 거절).
B 는 권하지 않는다 — 한국어 이름을 잃고(0/534), KR 전용 콘텐츠가 목록에서 빠지며(43/291), 이미 퍼진 ID 를 못 고친다.
선택지로 남길 것: 목록 단계에서 KR 전용 ID 를 매칭된 그 밖 판 ID 로 **바꿔 끼우는** 변형(A 의 매칭을 목록 시점에 수행, 이름은 KR 레코드 유지)도 가능하지만 아티스트 페이지마다 +1회 호출과 링크 ID 변경이 따르고, A 만으로 사용자 증상은 해결된다.

## 완료 조건

- [x] KR 전용 ID 가 실제 사용자 경로(아티스트 상세 앨범 목록 등)로 들어오는지 확인
- [ ] 트랙을 채울 방법 결정(예: 이름·아티스트로 그 밖 판 collectionId 를 찾아 그 ID 로 lookup) — 실측 근거와 함께
- [ ] `tests/test_music_storefront.py` 에 회귀 테스트

## 로그

- 2026-11-19: 이슈 20261112-1607 재실측 중 발견, later 로 기록
- 2026-11-19: todo/high 로 승격(사용자). 1548 의 ③ US 검색 수정은 KR 판 ID 에 효과 없음이 확인됨 — 검색 결과가 그 밖 판 ID 로만 와 collectionId 필터를 못 통과한다(메인 세션 재확인: 1745285216 ①0건 ②collection1+track0, 1773694541 ①1+10 ②0건)
- 2026-11-20: 착수(실측·방향 비교까지)
- 2026-11-20: 실측(225회, 403 13회 회복). KR 전용 ID 의 실경로는 아티스트 상세 앨범 카드뿐(검색·탑스터·월드컵은 US 검색 ID) → 조건 1 체크. 14팀 KR 앨범 705건 중 291건(41%)이 KR 전용, 표본 28/28 트랙 0. A(③ 필터를 artistId+이름으로 넓힘, 추가 호출 0) 23/28, 아티스트 목록 폴백까지 26/28. B 는 KR 이름 0/534·KR 전용 43/291 소실로 비권장. 조건 2 는 후보 비교 완료, 사용자 결정 대기

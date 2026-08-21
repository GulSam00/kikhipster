# kikhipster 과제 보드

> 이 파일이 **할 일의 정본**이다. CLAUDE.md에는 과제를 적지 않는다.
> 완료된 항목은 여기서 지우고 `docs/WORKLOG.md` 에 기록한다.
> 최종 갱신: 2026-08-20

---

## ⛔ 차단됨

### Spotify Web API 403 — 앱 소유 계정의 Premium 구독 요구

무료 계정으로는 어떤 대시보드 설정으로도 뚫리지 않는다. 2026-08-20 확인.

- 토큰 발급(`accounts.spotify.com/api/token`)은 **성공한다.** 여기서 막히지 않으니 자격증명 문제로 오진하지 말 것
- 실제 차단은 다음 단계: `api.spotify.com/v1/*` → **403** + `"Active premium subscription required for the owner of the app."`
- `backend/.env` 의 `SPOTIFY_CLIENT_ID`/`SECRET` 에는 유효한 값이 들어 있다 (앱 자체는 정상 생성됨)

**결정:** 구독하지 않고 **다른 음악 API로 교체**한다 → 아래 T1.

---

## 진행 예정

### T1. 음악 API 교체 (Spotify → iTunes Search API, 결정 완료 2026-08-21)

**결정: iTunes Search API.** Deezer와 실제 쿼리로 직접 비교 검증함 — 상세는 `docs/WORKLOG.md` 세션 기록.

- 결정적 근거: Deezer는 한글+영문 혼합 쿼리(`"아이유 Blueming"`)와 순수 한글 쿼리(`"아이유 블루밍"`) 둘 다 **0건**을 반환함. iTunes는 두 경우 다 정확히 매칭. 케이팝처럼 아티스트명 한글 + 곡명 영문 조합이 흔한 도메인이라 이 차이가 치명적
- 트랙/아티스트 검색 관련도도 iTunes가 전반적으로 더 정확함(일문 "米津玄師 Lemon" 테스트 등)
- 30초 미리듣기(`previewUrl`), 앨범 커버(`artworkUrl100`, URL의 `100x100bb`→`600x600bb` 치환으로 고해상도 획득 가능) 정상 확인
- **iTunes의 제약 2건, 둘 다 처리 완료/합의됨:**
  - `followers`(팔로워 수) 필드 없음 → **기능 자체를 제거함**(`ArtistCard.tsx`, `artists/[id]/page.tsx`, `schemas/music.py`, `music_api.py`, `types/music.ts`에서 전부 삭제, 커밋 대기)
  - 아티스트 엔티티에 **인물 사진 필드가 없음**(앨범/트랙 아트워크는 있음) → 앨범 위주 도메인이라 수용하기로 함. `ArtistCard.tsx`가 이미 `image_url` null일 때 마이크 아이콘 폴백을 갖고 있어 추가 작업 없이 그대로 둠(앨범 커버로 대체하는 우회로는 검토했으나 채택 안 함)
  - `primaryGenreName`이 배열이 아니라 단일 문자열 — `genres: list[str]` 스키마와 안 맞아 매핑 시 `[primaryGenreName]`으로 감싸야 함(착수 시 처리)

- 교체 범위: `backend/services/music_api.py` + `backend/schemas/music.py`
- 저장되는 앨범/트랙 ID 체계가 Spotify ID → iTunes ID(`trackId`/`collectionId`/`artistId`, 전부 숫자)로 바뀐다. **현재 DB가 비어 있어 마이그레이션 부담은 없다** (`topster_items.album_spotify_id`, `tournament_rounds.track_a_id/track_b_id` 컬럼명은 리네이밍 검토)
- 착수 시점 미정

### T2. 백엔드에 있는데 UI가 없는 기능 붙이기 — 가장 값싼 확장

음악 API 없이도 대부분 화면에서 확인 가능하다.

- [ ] 탑스터 **수정/삭제 UI** — `PUT`/`DELETE /api/topsters/{id}` 존재, 프론트 호출부 0
- [ ] 댓글 **수정 UI** — `PUT` 존재, 화면은 삭제만 지원
- [ ] 앨범/트랙/아티스트 **좋아요** — 모델·API는 범용 `target_type` 지원, UI는 탑스터에만
- [ ] 아티스트 상세의 **앨범 목록** — `GET /api/music/artists/{id}/albums` 프론트 미사용 (T1 이후)

### T3. 설계상 구멍

- [ ] **토너먼트 — 기획 변경, T1 이후 착수 (2026-08-20).** 서버에 라운드별 진행 상태를 저장하고 복구 엔드포인트를 두는 기존 접근(`GET /api/tournaments/{id}` 하이드레이션 등)은 폐기. 새 방향:
  - 진행 중 상태는 **프론트 `localStorage`에만** 저장 — 새로고침은 견디지만 다른 기기·브라우저에는 안 감. 서버에 라운드별 저장/복구 API 자체를 안 만듦
  - 완료 시 **최종 결과만 POST**. 이때도 "누가 누구를 이겼다"는 대진 기록이 아니라 **트랙별 선택률/도달 라운드 기반 스코어**를 보냄 — 높은 라운드까지 올라간 트랙일수록 가중치(보정)를 더 받는 방식. 여러 유저의 플레이가 쌓여 트랙 랭킹으로 집계되는 걸 노림. 정확한 스코어 산식·집계 스키마는 미정, 착수 시 다시 설계
  - **Spotify 트랙 ID 기준으로 스키마를 먼저 짜지 않는다** — T1(음악 API 교체)이 끝난 뒤 새 API의 ID 체계로 설계. `Tournament`/`TournamentRound` 모델도 이 개편에 맞춰 다시 그림
  - 대진표 트리 `Dialog` 뷰(`DESIGN.md` § Visual reference)는 위 스코어링 모델이 정해진 뒤 필요 여부부터 재검토
- [ ] **리뷰 기능 — 구현 여부 결정 보류 (2026-08-20).** CLAUDE.md 목표에는 있으나 모델·라우터·페이지·기획(`_workspace/planning.md`) 전부 부재. `Comment`는 `topster_id`에 고정돼 있어 리뷰(앨범/아티스트/트랙 대상 별점+텍스트) 대체 불가 — 진짜 빈 기능임은 확인함. 구현 vs CLAUDE.md 목표에서 제외, 둘 중 하나를 나중에 결정. 그 사이 T3의 다른 항목(토너먼트 소실, 프론트 에러 처리)부터 진행
- [ ] **테스트·CI 전무** — `.github/workflows` 없음, 테스트 파일 0개. AWS 실습 4단계에서 어차피 필요해진다

### T4. AWS 아키텍처 실습 (기능 확장 이후)

- [ ] 1단계: ECR 푸시 + Fargate 태스크 단독 기동 (ALB 없이). **착수 전 AWS 크레딧 잔액·프리 티어 잔여 기간 확인 필요** ← 유일한 미결 변수
- [ ] 2단계: RDS 연결
- [ ] 3단계: ALB + ACM
- [ ] 4단계: GitHub Actions OIDC
- [ ] 5단계: Terraform 코드화

상세 로드맵·비용표는 Notion §11.8. 배포 원칙은 CLAUDE.md 참조.

---

## 현재 구현 범위 (2026-08-20 기준)

무엇이 이미 있는지 모르면 중복 구현하게 되므로 여기 둔다.

| 도메인 | 구현된 것 |
|--------|----------|
| **인증** | Google·Kakao OAuth, JWT 발급/갱신, `/api/auth/me`, 공개 프로필 조회. 토큰은 프론트 `localStorage` |
| **음악** | 아티스트/앨범/곡 검색, 아티스트 상세, 아티스트 앨범 목록, 아티스트 인기 트랙, 앨범 트랙 목록 (전부 Spotify 기반 → T1로 교체 예정) |
| **탑스터** | 생성(3×3/4×4/5×5, 공개·비공개), 목록, 상세, 수정, 삭제, 유저별 목록, 내 목록 |
| **댓글** | 목록/작성/수정/삭제 |
| **좋아요** | `target_type`(topster·album·track·artist·comment) + `target_id` 범용 토글·상태 조회 |
| **토너먼트** | 8/16/32강 생성(대진 자동 생성), 조회, 라운드 투표 → 우승자 확정 |
| **프론트** | 페이지 12개 — `/`, `/search`, `/artists/[id]`, `/albums/[id]`, `/topsters`, `/topsters/new`, `/topsters/[id]`, `/tournament`, `/profile`, `/profile/[userId]`, `/login`, `/auth/callback`. `PlayerContext` + `MiniPlayer` 로 30초 미리듣기 |

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

### T1. 음악 API 교체 (Spotify → 대체 API)

| 후보 | 키 | 30초 미리듣기 | 비고 |
|------|-----|--------------|------|
| **Deezer** (유력) | 불필요 | O | `nb_fan`, 앨범 `genres` 등 필드 구조가 Spotify와 가장 유사해 스키마 변경 최소 |
| iTunes Search | 불필요 | O | 더 확실히 개방적이나 popularity/followers 부재 → UI 일부 표시 제거 필요 |

- 교체 범위: `backend/services/music_api.py` + `backend/schemas/music.py`
- 저장되는 앨범/트랙 ID 체계가 Spotify ID → 대체 API ID로 바뀐다. **현재 DB가 비어 있어 마이그레이션 부담은 없다** (`topster_items.album_spotify_id`, `tournament_rounds.track_a_id/track_b_id` 컬럼명은 리네이밍 검토)
- 착수 시점 미정

### T2. 백엔드에 있는데 UI가 없는 기능 붙이기 — 가장 값싼 확장

음악 API 없이도 대부분 화면에서 확인 가능하다.

- [ ] 탑스터 **수정/삭제 UI** — `PUT`/`DELETE /api/topsters/{id}` 존재, 프론트 호출부 0
- [ ] 댓글 **수정 UI** — `PUT` 존재, 화면은 삭제만 지원
- [ ] 앨범/트랙/아티스트 **좋아요** — 모델·API는 범용 `target_type` 지원, UI는 탑스터에만
- [ ] 아티스트 상세의 **앨범 목록** — `GET /api/music/artists/{id}/albums` 프론트 미사용 (T1 이후)

### T3. 설계상 구멍

- [ ] **토너먼트가 새로고침에 소실된다.** 진행 상태는 React state에만, 트랙 메타는 클라이언트 `selected` 배열에만 있다. 이어하기를 지원하려면 ① 진행 중 토너먼트 목록/복구 엔드포인트 ② 트랙 ID로 메타를 되찾을 `GET /api/music/tracks/{id}` (또는 트랙 정보 DB 저장). `GET /api/tournaments/{id}` 는 이미 있으나 프론트가 안 쓴다
- [ ] **프론트 에러 처리** — `frontend/app/` 내 `catch {}` 18곳이 실패를 삼킨다. `sonner` 가 이미 설치돼 있으니 토스트 기반으로 정리. 기능을 더 얹기 전에 하는 편이 디버깅 비용을 줄인다
- [ ] **리뷰 기능 — 구현 여부 결정 필요.** CLAUDE.md 목표에는 있으나 모델·라우터·페이지·기획(`_workspace/planning.md`) 전부 부재. 구현하거나 목표에서 뺀다
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

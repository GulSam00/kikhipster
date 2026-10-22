# 설계: 대결 승리 애니메이션 · 결과 화면 댓글 · 비로그인 댓글

작성 2026-08-30. 요청 3건을 한 벌로 설계한다.

---

## 1. 대결 승리 애니메이션

**요구**: 이긴 카드가 진 카드를 튕겨 화면 밖으로 보내고, 자기는 가운데로 와서 강조.

**지금**: `justPicked` 이 서면 이긴 쪽에 `border-primary`, 진 쪽에 `scale-95 opacity-40`.
450ms 뒤 다음 경기로 넘어간다.

**설계**: 새 의존성 없이 CSS keyframes 로 한다(`motion` 은 이미 있지만 레이아웃 밖으로
날리는 단순 트윈에 라이브러리를 쓸 이유가 없다).

- 방향을 **CSS 변수 `--battle-dir`** 로 넘긴다(이긴 쪽이 왼쪽이면 `1`, 오른쪽이면 `-1`).
  좌/우 keyframes 를 4벌 만들지 않고 2벌로 끝낸다.
- 가운데로 보내는 거리는 `calc(50% + var(--battle-gap) / 2)`. `translateX` 의 `%` 는
  자기 폭 기준이라 **자기 폭 절반 + 칸 사이 간격 절반**이 정확히 컨테이너 중앙이다.
  간격이 반응형(`gap-4 sm:gap-8`)이자 라운드별(결승은 더 넓다)로 달라지므로 **간격을
  유틸리티가 아니라 변수로 들고** `gap-(--battle-gap)` 으로 쓴다.
- 부딪히는 맛: 이긴 카드가 18% 지점에서 상대 쪽으로 살짝 밀고 들어갔다가 중앙으로 간다.
  진 카드는 그 18%까지 버티다가 그때부터 날아간다 — 맞아서 밀려나는 것처럼 보인다.
- **가로 스크롤 방지(§ Mobile, BLOCK 사안)**: 날아가는 카드가 페이지를 늘리지 않도록
  격자를 감싼 상자에 `overflow-x-clip`. `overflow-x: clip` 은 `overflow-y: visible` 을
  `auto` 로 강등시키지 않아(하나가 `clip` 이면 다른 축의 `visible` 이 유지된다) 세로로
  커지는 `scale` 은 안 잘린다.
- `prefers-reduced-motion` 이면 애니메이션 클래스를 붙이지 않는다(기존 훅 재사용).
- 대기 시간 450ms → 650ms.

**바꾸는 파일**: `app/globals.css`(keyframes 2), `app/play/[playId]/page.tsx`.

---

## 2. 월드컵 결과 화면에 댓글

**설계**: 우승 화면 아래에 기존 `CommentSection` 을 그대로 붙인다.
`targetType="tournament"`, `targetId={play.tournament_id}`.

**월드컵 상세와 같은 실**을 쓴다 — 판(play)마다 따로 두지 않는다. 판은 사람마다 매번
새로 생기므로 판별 댓글은 아무도 다시 안 본다. 대화는 월드컵 단위여야 쌓인다.

**바꾸는 파일**: `app/play/[playId]/page.tsx`.

---

## 3. 비로그인 댓글 (월드컵 · 탑스터 공통)

**요구**: 닉네임(기본 "익명") + 내용으로 작성. 본인 것 삭제. 남의 것 신고.

### 3-1. 본인 확인 방법 — 판단이 필요했던 지점

비로그인 사용자가 "자신이 쓴 댓글"임을 증명할 방법이 필요한데 요청에 명시된 입력란은
**닉네임과 내용 둘뿐**이다. 그래서 한국 게시판의 관행인 **비밀번호 칸은 두지 않는다**.

대신 브라우저가 최초 1회 만들어 `localStorage` 에 보관하는 **작성자 토큰**을 쓴다.
서버는 그 토큰의 **SHA-256 해시만** 저장하고, 삭제 요청의 토큰 해시가 일치하면 본인으로
본다. 입력란이 늘지 않고 사용자가 외울 것도 없다.

**한계(명시해 둔다)**: 브라우저 데이터를 지우거나 다른 기기·시크릿 창에서 보면 자기 댓글을
지울 수 없다. 비밀번호가 없는 이상 이건 피할 수 없고, 익명 댓글의 무게에 비해 감수할 만하다.

### 3-2. 스키마

`comments` 변경:
| 컬럼 | 변경 |
|---|---|
| `user_id` | `nullable=False` → **`nullable=True`** (비로그인 댓글) |
| `guest_nickname` | 추가. `String(20)`, nullable. 로그인 댓글이면 NULL |
| `guest_token_hash` | 추가. `String(64)`, nullable, index. SHA-256 hex |

체크 제약 `comments_author_present`: `user_id IS NOT NULL OR (guest_nickname IS NOT NULL
AND guest_token_hash IS NOT NULL)` — 주인 없는 댓글이 생기지 않게 DB에서 막는다.

새 테이블 `comment_reports`:
| 컬럼 | 비고 |
|---|---|
| `id` | UUID PK |
| `comment_id` | FK `comments.id` **ON DELETE CASCADE** |
| `reporter_user_id` | FK `users.id` ON DELETE CASCADE, nullable |
| `reporter_token_hash` | `String(64)`, nullable |
| `reason` | `String(20)`, nullable |
| `created_at` | |

중복 신고 방지: 부분 유니크 인덱스 2개
- `(comment_id, reporter_user_id)` where `reporter_user_id IS NOT NULL`
- `(comment_id, reporter_token_hash)` where `reporter_token_hash IS NOT NULL`

### 3-3. API

경로는 그대로. **인증만 `get_current_user` → `get_optional_user` 로 바꾼다.**

| 메서드 | 경로 | 변경 |
|---|---|---|
| GET | `/api/comments/{type}/{id}/` | `guest_token` **쿼리 파라미터** 추가 |
| POST | `/api/comments/{type}/{id}/` | 본문에 `nickname?` 추가, `X-Guest-Token` 헤더 |
| PUT | `.../{comment_id}` | `X-Guest-Token` 헤더 |
| DELETE | `.../{comment_id}` | `X-Guest-Token` 헤더 |
| POST | `.../{comment_id}/report` | **신규**. 본문 `{ reason？ }` |

**GET 만 헤더가 아니라 쿼리 파라미터인 이유**: `apiFetch` 는 GET 에 `Content-Type` 조차
일부러 안 붙인다 — 단순 요청 조건이 깨져 URL 마다 CORS 프리플라이트가 한 번씩 더 나가기
때문이다(`lib/api/client.ts` 주석, 2026-08-27). 커스텀 헤더도 똑같이 프리플라이트를
부르므로 목록 조회에는 쓸 수 없다. POST/PUT/DELETE 는 어차피 프리플라이트가 나가므로 헤더로 둔다.

### 3-4. 응답 shape

`is_mine` 을 **서버가 판정해서 내려준다.** 게스트 소유 판정은 토큰 해시 비교라 프론트가
할 수 없다(프론트에는 평문 토큰만 있고 서버에는 해시만 있다). 지금처럼 프론트에서
`c.user.id === me?.id` 로 비교하는 방식은 게스트에 못 쓴다.

```
CommentResponse {
  id, target_type, target_id, content, created_at, updated_at, edited_at
  user: { id, nickname } | null      # 비로그인 댓글이면 null
  author_nickname: str               # 항상 채워진다 (로그인이면 user.nickname, 아니면 guest_nickname)
  is_mine: bool                      # 로그인 id 일치 또는 게스트 토큰 해시 일치
  reported_by_me: bool
  report_count: int
}
```

`from_attributes` 로는 `is_mine` 을 못 만드므로 **`_to_response()` 헬퍼에서 명시적으로 조립**한다.

### 3-5. 프론트

- `lib/guest-token.ts` — `crypto.randomUUID()` 로 1회 생성 후 `localStorage('guest_token')`.
- `CommentSection` — 비로그인이면 **닉네임 칸 + 내용 칸**. 닉네임 비우면 "익명".
- 삭제 버튼 판정을 `c.user.id === me?.id` → **`c.is_mine`** 으로 교체(로그인·게스트 공통).
- 신고 버튼은 `!c.is_mine` 일 때. `useDeleteItem` 과 같은 결의 **토스트 확인**을 거친다
  (`Dialog` 프리미티브가 `components/ui` 에 없다 — 새로 들이지 않는다).
- 이미 신고한 댓글은 버튼 비활성 + "신고됨".

### 3-6. 수정(PUT)도 게스트에게 연다

요청에는 삭제·신고만 있었다. 그런데 소유 판정 헬퍼가 삭제와 수정에서 **같은 함수**라,
수정만 로그인 전용으로 남기려면 오히려 분기를 더 넣어야 한다. 코드가 줄어드는 쪽으로
같이 열되, 이 결정은 보고에 남긴다.

---

## 영향 없는 것

`comment_counts()` · `purge_comments()` 는 그대로 — `user_id` 를 안 본다.
좋아요(`target_type='comment'`)도 그대로.

---
name: kikhipster-frontend
description: "kikhipster 프로젝트의 Next.js + Tailwind 프론트엔드 구현 컨벤션. Next.js App Router 기반 페이지/컴포넌트 작성, Tailwind 스타일링, 백엔드 API 연동, TypeScript 타입 정의 시 따를 것."
---

# kikhipster 프론트엔드 컨벤션

## 디렉토리 구조

```
frontend/
├── app/
│   ├── layout.tsx              # 루트 레이아웃 (Navbar 포함)
│   ├── page.tsx                # 홈 (인기 아티스트, 최신 탑스터)
│   ├── search/page.tsx         # 아티스트/앨범 검색
│   ├── topster/
│   │   ├── page.tsx            # 탑스터 목록 + 생성 버튼
│   │   ├── new/page.tsx        # 탑스터 제작 (드래그앤드롭)
│   │   └── [id]/page.tsx       # 탑스터 상세 + 공유
│   ├── tournament/
│   │   ├── page.tsx            # 토너먼트 목록
│   │   └── [id]/page.tsx       # 토너먼트 진행
│   └── profile/[userId]/page.tsx
├── components/                 # 2026-08-28에 도메인별로 나눴다 (전에는 music/ 한 곳에 24개)
│   ├── ui/                     # shadcn/ui 프리미티브. CLI로 추가하되, 로컬 수정한 파일은
│   │                           #   맨 위에 `// [kikhipster]` 주석으로 표시해 둔다
│   ├── common/                 # 도메인을 안 타는 조각 — DetailHeader, DetailActionBar,
│   │                           #   ItemStats, CoverImage, OwnerMenu, ShareButton, ViewCounter …
│   ├── music/                  # 음악 자체 — AlbumCard, ArtistCard, TrackRow
│   ├── topster/                # TopsterCard, TopsterCanvas, TopsterEditor, TopsterAlbumList
│   ├── tournament/             # TournamentCard/Editor, PoolGrid, PoolItemTile,
│   │                           #   PlayLauncher, BracketBackground, FullBracket
│   ├── social/                 # CommentSection, LikeButton
│   └── layout/                 # Navbar, MiniPlayer
├── hooks/
│   ├── useTopster.ts
│   ├── useTournament.ts
│   └── useReview.ts
├── lib/
│   └── api.ts
└── types/
    ├── music.ts
    ├── topster.ts
    ├── tournament.ts
    └── social.ts
```

## API 클라이언트

```typescript
// lib/api.ts
const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`API Error: ${res.status}`);
  return res.json() as Promise<T>;
}
```

## TypeScript 타입 정의 원칙

백엔드 Pydantic 스키마와 **필드명·타입·nullable 여부를 1:1 매핑**한다.

```typescript
// types/music.ts
export interface Artist {
  id: number;
  name: string;
  genre: string;
  image_url: string | null;
}

export interface Album {
  id: number;
  title: string;
  artist_id: number;
  release_year: number;
  cover_url: string | null;
}

// types/topster.ts
export interface Topster {
  id: number;
  user_id: number;
  title: string;
  albums: Album[];
  is_public: boolean;
  created_at: string; // ISO 8601 (백엔드 datetime → JSON string)
}

// types/social.ts
export interface Review {
  id: number;
  user_id: number;
  target_type: 'artist' | 'album' | 'song';
  target_id: number;
  content: string;
  rating: number;
  created_at: string;
}

export interface Comment {
  id: number;
  user_id: number;
  review_id: number;
  content: string;
  created_at: string;
}

export interface Like {
  id: number;
  user_id: number;
  target_type: 'review' | 'topster';
  target_id: number;
}
```

## 스타일링 원칙 (shadcn/ui + Tailwind)

**컴포넌트를 새로 만들기 전에 `components/common/` 을 먼저 본다.** 커버+폴백은
`CoverImage`, 상세 헤더는 `DetailHeader`, 조회·좋아요·댓글 줄은 `ItemStats` 가 이미 있다.
탑스터와 월드컵이 같은 모양을 두 벌 그리고 있던 것을 2026-08-28에 여기로 모았다.

**UI는 shadcn/ui 프리미티브 위에서 조립한다.** 버튼·카드·인풋·탭 등을 raw `<button>` + Tailwind 클래스로 새로 만들지 말고 `@/components/ui/*` 를 먼저 찾는다. 없으면 `pnpm dlx shadcn@latest add <name>` 으로 추가한다.

- 설정: `frontend/components.json` (style `radix-nova`, baseColor `zinc`, 아이콘 `lucide`)
- 클래스 병합은 `cn()` (`@/lib/utils`) 사용 — 조건부 스타일에 템플릿 리터럴 금지
- 인라인 `className` 사용, 별도 `.css` 파일 금지 (`app/globals.css` 만 예외)
- 모바일 퍼스트: `sm:`, `md:`, `lg:` 순서

### 색상은 하드코딩하지 않고 시맨틱 토큰을 쓴다

`app/globals.css` 에 정의된 CSS 변수 토큰을 사용한다. `bg-zinc-900`, `text-violet-400` 같은 팔레트 직접 지정은 금지.

| 용도 | 토큰 |
|------|------|
| 페이지 배경 | `bg-background` |
| 카드/패널 | `bg-card` |
| 강조 (브랜드 violet) | `bg-primary` / `text-primary` |
| 보조 텍스트 | `text-muted-foreground` |
| hover 배경 | `bg-accent` |
| 구분선/테두리 | `border` (기본값이 `border-border`) |

다크 테마 고정이다. `<html>` 에 `dark` 클래스가 항상 붙어 있으므로 `dark:` 접두사는 쓰지 않는다. 라이트 팔레트도 `:root` 에 정의돼 있어 나중에 토글을 붙일 수 있다.

### 아이콘·상태 컴포넌트

- 아이콘은 `lucide-react`. 이모지(`♥ ♫ ▶ ✕`)를 아이콘으로 쓰지 않는다
- 로딩 → `<Spinner>`, 빈 상태 → `<Empty>` 계열, 알림 → `sonner` 의 `toast()`
- 목록 카드는 `<Card size="sm">` + `<CardContent>` 조합

## OpenAPI 플레이스홀더 패턴

```typescript
// TODO: [OpenAPI] 실제 외부 API 연동 시 이 부분을 교체
const mockArtists: Artist[] = [
  { id: 1, name: 'Mock Artist', genre: 'K-Pop', image_url: null },
];
```

## 기능별 구현 포인트

### 탑스터 (TopsterGrid)
- 그리드 크기: 3x3(9개), 4x4(16개), 5x5(25개) 선택 가능
- 드래그앤드롭: `@hello-pangea/dnd` 사용
- 공유: `navigator.clipboard`로 URL 복사 또는 `html2canvas`로 이미지 다운로드

### 노래 토너먼트 (TournamentBracket)
- 대진표 구조: `{ round: number, matches: Match[] }`
- 상태: `useState`로 현재 라운드·대진표 관리
- 투표 결과: `PATCH /api/tournaments/{id}/vote` 호출

### 리뷰/댓글/좋아요
- 좋아요: 낙관적 업데이트 (UI 즉각 반영 → API 동기화)
- 댓글: 낙관적 추가 후 서버 응답으로 id 교체

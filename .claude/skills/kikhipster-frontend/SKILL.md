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
├── components/
│   ├── ui/                     # 공용 (Button, Card, Modal, Badge)
│   ├── music/
│   │   ├── ArtistCard.tsx
│   │   ├── AlbumCard.tsx
│   │   ├── TopsterGrid.tsx     # 앨범 커버 그리드 (3x3, 5x5)
│   │   └── TournamentBracket.tsx
│   └── layout/
│       └── Navbar.tsx
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

## Tailwind 스타일링 원칙

- 인라인 `className` 사용, 별도 `.css` 파일 금지
- 모바일 퍼스트: `sm:`, `md:`, `lg:` 순서
- 다크모드: `dark:` 접두사 (루트에 `dark` 클래스 토글)
- 음악 테마: 짙은 배경 `bg-zinc-900`, 강조 `text-violet-400`

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

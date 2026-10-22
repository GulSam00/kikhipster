import { apiFetch } from '@/lib/api/client';

import type { LikeStatus, LikeTargetType } from '@/types/social';

/** 좋아요 엔드포인트. `/api/likes` 문자열은 이 파일에만 있다. */
const BASE = '/api/likes';

/** 백엔드 `routers/like.py` 의 `MAX_BATCH_IDS` 와 같은 값이어야 한다. */
export const LIKE_BATCH_LIMIT = 200;

export const getLikeBatch = (type: LikeTargetType, ids: string[]) =>
  apiFetch<Record<string, LikeStatus>>(
    `${BASE}/batch/${type}?ids=${ids.map(encodeURIComponent).join(',')}`,
  );

export const toggleLike = (type: LikeTargetType, id: string) =>
  apiFetch<LikeStatus>(`${BASE}/${type}/${id}`, { method: 'POST' });

'use client';

import { useCallback, useEffect, useReducer } from 'react';
import { getLikeBatch, LIKE_BATCH_LIMIT, toggleLike } from '@/lib/api/likes';
import type { LikeStatus, LikeTargetType } from '@/types/social';

/**
 * 좋아요 상태 배치 로더.
 *
 * 왜 버튼마다 부르지 않나: 앨범 상세의 트랙 목록이 수십 행이라 행마다 GET을 부르면 화면
 * 하나에 수십 번이 나간다. `album-covers` 와 같은 방식으로, 버튼은 필요한 ID를 등록만 하고
 * 한 틱 뒤에 `/api/likes/batch/{type}?ids=` 한 번으로 합쳐 부른다.
 */

/** `${type}:${id}` → 상태. 값이 없으면 "아직 안 물어봤다"는 뜻이다. */
const statuses = new Map<string, LikeStatus>();
const listeners = new Set<() => void>();

const BATCH_LIMIT = LIKE_BATCH_LIMIT;

let queue = new Map<LikeTargetType, Set<string>>();
let scheduled = false;

// 로그인 여부에 따라 liked 가 통째로 달라진다. 토큰이 바뀌면 캐시를 통째로 버린다.
let cachedToken: string | null = null;

function key(type: LikeTargetType, id: string): string {
  return `${type}:${id}`;
}

function syncToken(): void {
  const token = localStorage.getItem('access_token');
  if (token !== cachedToken) {
    cachedToken = token;
    statuses.clear();
  }
}

function wakeAll(): void {
  listeners.forEach((l) => l());
}

async function runBatch(type: LikeTargetType, ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    try {
      const res = await getLikeBatch(type, chunk);
      // 응답에 없는 ID도 0으로 적어둬야 매 렌더마다 다시 묻지 않는다.
      chunk.forEach((id) => {
        statuses.set(key(type, id), res[id] ?? { liked: false, like_count: 0 });
      });
    } catch {
      // 좋아요 수는 부가 정보다. 실패해도 화면은 그려지고, 다음 마운트에 다시 시도한다.
    }
    wakeAll();
  }
}

function request(type: LikeTargetType, ids: string[]): void {
  syncToken();
  const need = ids.filter((id) => id && !statuses.has(key(type, id)));
  if (need.length === 0) return;

  const pending = queue.get(type) ?? new Set<string>();
  need.forEach((id) => pending.add(id));
  queue.set(type, pending);
  if (scheduled) return;

  scheduled = true;
  // setTimeout 0 — 같은 렌더 패스에서 마운트된 버튼들이 전부 등록을 마친 뒤에 모아 보낸다.
  setTimeout(async () => {
    while (queue.size > 0) {
      const batch = queue;
      queue = new Map();
      for (const [type_, ids_] of batch) {
        await runBatch(type_, [...ids_]);
      }
    }
    scheduled = false;
  }, 0);
}

export interface UseLikeStatus {
  /** 아직 조회 전이면 null. 버튼은 그 동안 수를 감춘다. */
  status: LikeStatus | null;
  /** 낙관적으로 뒤집고 서버 응답으로 확정한다. 실패하면 되돌리고 throw 한다. */
  toggle: () => Promise<void>;
}

export function useLikeStatus(type: LikeTargetType, id: string): UseLikeStatus {
  const [, rerender] = useReducer((n: number) => n + 1, 0);

  useEffect(() => {
    if (!id) return;
    const wake = () => rerender();
    listeners.add(wake);
    request(type, [id]);
    return () => {
      listeners.delete(wake);
    };
  }, [type, id]);

  const toggle = useCallback(async () => {
    const k = key(type, id);
    const prev = statuses.get(k) ?? { liked: false, like_count: 0 };
    statuses.set(k, {
      liked: !prev.liked,
      like_count: prev.like_count + (prev.liked ? -1 : 1),
    });
    wakeAll();
    try {
      statuses.set(k, await toggleLike(type, id));
    } catch (err) {
      statuses.set(k, prev);
      throw err;
    } finally {
      wakeAll();
    }
  }, [type, id]);

  return { status: statuses.get(key(type, id)) ?? null, toggle };
}

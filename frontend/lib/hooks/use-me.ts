'use client';

import { useEffect, useState } from 'react';
import { getMe } from '@/lib/api/auth';
import type { Me } from '@/types/user';

export type { Me };

/**
 * 로그인한 사용자를 `/api/auth/me` 로 확인한다.
 *
 * localStorage 의 `user_id` 를 읽지 않는 이유: 그 값은 `/profile` 을 방문해야만 저장돼서,
 * 프로필을 안 거친 세션에서는 늘 null 이었다. 실제로 탑스터 상세의 '내 댓글' 판정이
 * 그래서 거의 항상 실패했다(2026-08-26). 토큰 유효성까지 같이 확인되는 이점도 있다.
 *
 * 한 화면에서 페이지와 댓글 영역이 동시에 물어보므로 결과를 모듈에 캐시해 요청을 한 번으로 줄인다.
 */
let cache: { token: string; promise: Promise<Me | null> } | null = null;

function loadMe(): Promise<Me | null> {
  const token = localStorage.getItem('access_token') ?? '';
  if (!token) {
    cache = null;
    return Promise.resolve(null);
  }
  // 토큰이 바뀌면(재로그인·계정 전환) 이전 사용자 정보를 그대로 쓰면 안 된다.
  if (cache?.token !== token) {
    cache = { token, promise: getMe().catch(() => null) };
  }
  return cache.promise;
}

/** 로그아웃처럼 토큰을 지우는 쪽에서 불러준다. */
export function clearMeCache(): void {
  cache = null;
}

/**
 * 확인 전에는 `undefined`, 비로그인은 `null`, 로그인은 사용자다.
 * 셋을 구분해야 "확인 중"에 로그인 폼이 깜빡였다가 사라지는 걸 막을 수 있다.
 */
export function useMe(): Me | null | undefined {
  const [me, setMe] = useState<Me | null | undefined>(undefined);

  useEffect(() => {
    let alive = true;
    loadMe().then((m) => {
      if (alive) setMe(m);
    });
    return () => {
      alive = false;
    };
  }, []);

  return me;
}

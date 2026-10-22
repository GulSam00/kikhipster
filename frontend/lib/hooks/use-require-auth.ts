'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

/**
 * 로그인하지 않은 사용자를 `/login` 으로 보낸다.
 *
 * 만들기·수정 화면처럼 로그인이 필수인 화면에서 쓴다. 2026-08-28 이전에는
 * `TopsterEditor`·`TournamentEditor` 에 토씨 하나 안 틀리고 같은 effect가 중복돼 있었다.
 */
export function useRequireAuth(): void {
  const router = useRouter();

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.push('/login');
    }
  }, [router]);
}

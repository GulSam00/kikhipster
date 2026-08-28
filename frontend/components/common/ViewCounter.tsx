'use client';

import { useEffect } from 'react';
import { markTopsterViewed } from '@/lib/api/topsters';
import { markTournamentViewed } from '@/lib/api/tournaments';

/** 조회수를 세는 대상. 값마다 부를 엔드포인트가 정해져 있다. */
export type ViewTarget = 'topster' | 'tournament';

const MARK_VIEWED: Record<ViewTarget, (id: string) => Promise<unknown>> = {
  topster: markTopsterViewed,
  tournament: markTournamentViewed,
};

interface Props {
  target: ViewTarget;
  id: string;
}

/**
 * 상세 화면을 열었다는 사실만 서버에 알린다. 아무것도 그리지 않는다.
 *
 * 왜 상세 GET 이 아니라 이 컴포넌트인가: GET 에서 올리면 수정 화면, OG 썸네일 생성,
 * Next 프리페치까지 전부 조회로 세어진다. 실제로 사람이 화면을 연 순간만 센다.
 *
 * **`onView` 같은 함수 prop 을 받지 않는다.** 월드컵 상세는 Server Component 라
 * 함수를 클라이언트 컴포넌트로 넘길 수 없다("Event handlers cannot be passed to
 * Client Component props" 로 500). 그래서 직렬화되는 값만 받고, 어느 엔드포인트를
 * 부를지는 이 안에서 고른다 — 2026-08-28에 실제로 이걸로 터뜨렸다.
 *
 * `sessionStorage` 로 한 번 거르는 건 중복 방지이자 **개발 모드 방어**다 —
 * StrictMode 는 effect 를 두 번 실행해서, 없으면 로컬에서 조회수가 매번 2씩 오른다.
 * 탭을 닫으면 비므로 다시 방문하면 또 센다.
 */
export default function ViewCounter({ target, id }: Props) {
  useEffect(() => {
    const key = `viewed:${target}:${id}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, '1');
    } catch {
      // 프라이빗 모드 등에서 sessionStorage 가 막히면 중복 방지 없이 그냥 센다.
    }
    // 조회 기록은 부가 정보라 실패해도 화면에 알리지 않는다.
    MARK_VIEWED[target](id).catch(() => undefined);
  }, [target, id]);

  return null;
}

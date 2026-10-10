'use client';

import { useSyncExternalStore } from 'react';

const QUERY = '(prefers-reduced-motion: reduce)';

function subscribe(onChange: () => void) {
  const mql = window.matchMedia(QUERY);
  mql.addEventListener('change', onChange);
  return () => mql.removeEventListener('change', onChange);
}

/**
 * `prefers-reduced-motion: reduce` 여부.
 *
 * **React Bits 컴포넌트는 이 설정을 어디서도 보지 않는다** — 받아서 그대로 쓰면 설정을
 * 켠 사용자에게도 광택·블러·테두리가 계속 움직인다. 그래서 사용처에서 이 훅으로 직접
 * 끈다(`disabled` prop 을 주거나 아예 정적인 마크업으로 갈아끼운다).
 *
 * `useState` + `useEffect` 가 아니라 `useSyncExternalStore` 인 이유는 두 가지다.
 * ① 이 프로젝트는 `react-hooks/set-state-in-effect` 가 error 라 effect 안에서 초기값을
 * 넣을 수 없다. ② 서버에는 `matchMedia` 가 없어 SSR 스냅샷을 따로 줘야 하는데,
 * `useSyncExternalStore` 는 hydration 시점에 서버 스냅샷을 쓰고 그 직후 클라이언트 값으로
 * 다시 맞춰 주므로 hydration mismatch 없이 이걸 처리할 수 있다.
 */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(QUERY).matches,
    () => false,
  );
}

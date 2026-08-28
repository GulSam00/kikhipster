'use client';

import { useEffect, useRef, useState } from 'react';

export interface BoxSize {
  width: number;
  height: number;
}

/**
 * 엘리먼트의 실측 크기를 잰다. 도메인에 묶이지 않은 범용 훅이다 —
 * 탑스터 격자(`use-topster-grid.ts`)와 대진표 연결선(`FullBracket`)이 함께 쓴다.
 */
export function useBoxSize<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [box, setBox] = useState<BoxSize>({ width: 0, height: 0 });

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    // setState 는 옵저버 콜백 안에서만 일어난다 — effect 본문에서 부르면 연쇄 렌더가 된다.
    const ro = new ResizeObserver(([entry]) => {
      const r = entry.contentRect;
      setBox({ width: Math.floor(r.width), height: Math.floor(r.height) });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return [ref, box] as const;
}

'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import { apiFetch } from '@/lib/api/client';

const DEFAULT_LIMIT = 30;

interface Options {
  /** 값이 바뀌면 목록을 처음부터 다시 받는다. 정렬·검색어처럼 결과 전체를 갈아엎는 것만 넣는다. */
  key: string;
  buildUrl: (params: { limit: number; offset: number }) => string;
  errorMessage: string;
  limit?: number;
  /**
   * false 면 아무 요청도 보내지 않고 로딩 상태로 남는다(기본 true).
   * 프로필처럼 **사용자 정보를 먼저 확인해야 목록을 부를 수 있는** 화면에서 쓴다 —
   * 비로그인 상태로 목록을 먼저 때리면 401 토스트가 뜬 뒤에야 로그인으로 넘어간다.
   */
  enabled?: boolean;
}

interface Result<T> {
  items: T[];
  /** 첫 페이지 로딩. 이때는 목록 대신 스켈레톤을 그린다. */
  loading: boolean;
  /** 이어붙이는 중. 이미 있는 목록은 그대로 두고 아래에만 표시한다. */
  loadingMore: boolean;
  /** 마지막 페이지까지 받았다. 실패로 멈춘 것과는 구분된다. */
  reachedEnd: boolean;
  /** 요청이 실패해 자동 로딩을 멈춘 상태. retry() 로만 다시 시작한다. */
  failed: boolean;
  retry: () => void;
  /** 목록 끝에 두는 빈 div 에 붙인다. 화면에 들어오면 다음 페이지를 부른다. */
  sentinelRef: React.RefObject<HTMLDivElement | null>;
  limit: number;
  /** 서버에서 이미 지운 항목을 목록에서 뺀다. 다시 불러오지 않는다. */
  removeItem: (id: string) => void;
}

/**
 * offset 기반 무한 스크롤.
 *
 * 백엔드 목록 엔드포인트는 이미 `limit`/`offset` 을 받는다(topster·tournament 모두).
 * 없는 건 총 개수라서, **응답이 limit 보다 적게 오면 마지막 페이지**로 판정한다.
 * 페이지 번호 UI 를 안 만드는 대신 `{items, total}` 래핑도 필요 없다 — 백엔드 변경 0 (2026-08-27).
 */
export function useInfiniteList<T extends { id: string }>({
  key,
  buildUrl,
  errorMessage,
  limit = DEFAULT_LIMIT,
  enabled = true,
}: Options): Result<T> {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [reachedEnd, setReachedEnd] = useState(false);
  const [failed, setFailed] = useState(false);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // key 가 바뀐 뒤 뒤늦게 도착한 이전 필터의 응답을 버리기 위한 세대 번호.
  const genRef = useRef(0);
  const offsetRef = useRef(0);
  const inFlightRef = useRef(false);
  // 더 부를 게 없거나(끝) 실패로 멈춘 상태. sentinel 이 계속 보이는 동안 재요청이 쏟아지는 걸 막는다.
  const stoppedRef = useRef(false);

  // buildUrl 은 렌더마다 새 함수라 의존성 배열에 넣으면 매 렌더 재구독이 된다. 최신 것만 ref 로 들고 쓴다.
  // **이 effect 는 아래 로딩 effect 보다 먼저 선언돼야 한다** — effect 는 선언 순서로 실행되므로,
  // key 와 buildUrl 이 같은 렌더에서 함께 바뀌어도 로딩이 새 URL 을 쓰게 된다.
  const buildUrlRef = useRef(buildUrl);
  useEffect(() => {
    buildUrlRef.current = buildUrl;
  }, [buildUrl]);

  // key 가 바뀌면 목록을 비우고 스켈레톤으로 되돌린다. effect 가 아니라 렌더 중에 조정하는 이유는
  // effect 본문의 동기 setState 가 연쇄 렌더를 만들기 때문이다(코드베이스의 다른 목록 화면과 같은 규약).
  const [prevKey, setPrevKey] = useState(key);
  if (key !== prevKey) {
    setPrevKey(key);
    setItems([]);
    setReachedEnd(false);
    setFailed(false);
    setLoading(true);
    setLoadingMore(false);
  }

  /**
   * `reset` 이면 첫 페이지부터, 아니면 다음 페이지를 이어붙인다.
   *
   * **동기 구간에서는 ref 만 건드리고 setState 는 전부 await 뒤에서 한다.** 이 함수는 effect 에서
   * 직접 불리므로, 앞쪽에 동기 setState 가 하나라도 있으면 그게 곧 effect 의 연쇄 렌더가 된다.
   */
  const load = useCallback(
    async (reset: boolean) => {
      if (reset) {
        genRef.current += 1;
        offsetRef.current = 0;
        stoppedRef.current = false;
      }

      inFlightRef.current = true;
      const gen = genRef.current;
      const offset = offsetRef.current;

      try {
        const data = await apiFetch<T[]>(buildUrlRef.current({ limit, offset }));
        if (gen !== genRef.current) return;

        offsetRef.current = offset + data.length;
        if (data.length < limit) {
          stoppedRef.current = true;
          setReachedEnd(true);
        }
        setItems((prev) => {
          if (reset) return data;
          // offset 페이지네이션이라, 보는 사이에 새 항목이 앞에 끼면 같은 행이 두 번 올 수 있다.
          const seen = new Set(prev.map((i) => i.id));
          return [...prev, ...data.filter((i) => !seen.has(i.id))];
        });
      } catch {
        if (gen !== genRef.current) return;
        stoppedRef.current = true;
        setFailed(true);
        toast.error(errorMessage);
      } finally {
        // 세대가 바뀌었다면 이 요청은 이미 버려진 것이다 — 새 세대의 플래그를 건드리면 안 된다.
        if (gen === genRef.current) {
          inFlightRef.current = false;
          setLoading(false);
          setLoadingMore(false);
        }
      }
    },
    [limit, errorMessage],
  );

  useEffect(() => {
    if (!enabled) return;
    // 코드베이스의 다른 목록 화면과 같은 형태 — setState 가 전부 await 뒤에서만 일어나게 감싼다.
    (async () => {
      await load(true);
    })();
  }, [key, enabled, load]);

  /** 다음 페이지. 진행 중이거나 멈춘 상태를 여기서 걸러 내고, 로딩 표시도 여기서 켠다. */
  const loadMore = useCallback(() => {
    if (inFlightRef.current || stoppedRef.current) return;
    setLoadingMore(true);
    load(false);
  }, [load]);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;

    // 스크롤 컨테이너가 body 가 아니라 main 이다(app/layout.tsx 의 overflow 배치).
    // root 를 안 주면 rootMargin 이 뷰포트 기준이 돼 미리 불러오기가 걸리지 않는다.
    const root = el.closest('main');
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) loadMore();
      },
      // 화면에 닿기 전에 미리 받아 스크롤이 끊기지 않게 한다.
      { root, rootMargin: '400px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [loadMore]);

  const retry = useCallback(() => {
    if (!failed) return;
    stoppedRef.current = false;
    setFailed(false);
    loadMore();
  }, [failed, loadMore]);

  const removeItem = useCallback((id: string) => {
    setItems((prev) => prev.filter((i) => i.id !== id));
    // 서버 목록도 한 건 줄었다. offset 을 같이 당기지 않으면 다음 페이지에서 한 건을 건너뛴다.
    offsetRef.current = Math.max(0, offsetRef.current - 1);
  }, []);

  return { items, loading, loadingMore, reachedEnd, failed, retry, sentinelRef, limit, removeItem };
}

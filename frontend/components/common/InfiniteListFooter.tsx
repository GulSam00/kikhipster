'use client';

import type { ReactNode, RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

interface Props {
  /** `useInfiniteList` 가 준 ref. 이 div 가 화면에 들어오면 다음 페이지를 부른다. */
  sentinelRef: RefObject<HTMLDivElement | null>;
  loadingMore: boolean;
  failed: boolean;
  retry: () => void;
  reachedEnd: boolean;
  /** 지금까지 그린 개수. 첫 페이지도 안 채웠으면 "모두 불러왔습니다"를 띄우지 않는다. */
  loadedCount: number;
  limit: number;
  /** 이어붙이는 동안 보여줄 자리표시자. 그리드 모양이 화면마다 달라 바깥에서 받는다. */
  skeleton?: ReactNode;
}

/** 무한 스크롤 목록의 하단 — sentinel, 추가 로딩 표시, 실패 시 재시도, 끝 안내. */
export default function InfiniteListFooter({
  sentinelRef,
  loadingMore,
  failed,
  retry,
  reachedEnd,
  loadedCount,
  limit,
  skeleton,
}: Props) {
  return (
    <>
      {/* 첫 로딩 중에도 DOM 에 있어야 관찰이 제때 시작된다. */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loadingMore &&
        (skeleton ?? (
          <div
            role="status"
            aria-label="더 불러오는 중"
            className="text-muted-foreground mt-4 flex justify-center"
          >
            <Spinner />
          </div>
        ))}

      {failed && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={retry}>
            다시 불러오기
          </Button>
        </div>
      )}

      {reachedEnd && loadedCount >= limit && (
        <p className="text-muted-foreground mt-6 text-center text-sm">모두 불러왔습니다</p>
      )}
    </>
  );
}

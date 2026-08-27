'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trophy } from 'lucide-react';
import { useInfiniteList } from '@/lib/use-infinite-list';
import TournamentCard from '@/components/music/TournamentCard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { TournamentSort, TournamentSummary } from '@/types/tournament';

const SORTS: { value: TournamentSort; label: string }[] = [
  { value: 'recent', label: '최신순' },
  { value: 'popular_all', label: '인기 전체' },
  { value: 'popular_year', label: '인기 올해' },
  { value: 'popular_month', label: '인기 이번 달' },
];

export default function TournamentDashboardPage() {
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<TournamentSort>('recent');

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  const buildUrl = useCallback(
    ({ limit, offset }: { limit: number; offset: number }) => {
      const params = new URLSearchParams({ sort, limit: String(limit), offset: String(offset) });
      if (debouncedQ) params.set('q', debouncedQ);
      return `/api/tournaments/?${params}`;
    },
    [sort, debouncedQ],
  );

  const { items, loading, loadingMore, reachedEnd, failed, retry, sentinelRef, limit } =
    useInfiniteList<TournamentSummary>({
      key: `${sort}|${debouncedQ}`,
      buildUrl,
      errorMessage: '월드컵 목록을 불러오지 못했습니다',
    });

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-3">
        <h1 className="font-heading text-2xl font-bold">음악 월드컵</h1>
        <Button asChild size="lg">
          <Link href="/tournament/new">
            <Plus />
            만들기
          </Link>
        </Button>
      </div>

      <div className="mb-3 relative">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="월드컵 제목·설명 검색..."
          className="h-10 pl-9"
        />
      </div>

      <ToggleGroup
        type="single"
        variant="outline"
        value={sort}
        onValueChange={(v) => v && setSort(v as TournamentSort)}
        className="mb-6"
      >
        {SORTS.map((s) => (
          <ToggleGroupItem key={s.value} value={s.value}>
            {s.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      {loading ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <Trophy />
            </EmptyMedia>
            <EmptyTitle>{debouncedQ ? '검색 결과가 없습니다' : '아직 월드컵이 없습니다'}</EmptyTitle>
            <EmptyDescription>
              {debouncedQ
                ? '다른 검색어로 찾아보세요.'
                : '좋아하는 곡이나 앨범을 모아 첫 월드컵을 만들어보세요.'}
            </EmptyDescription>
          </EmptyHeader>
          {!debouncedQ && (
            <EmptyContent>
              <Button asChild>
                <Link href="/tournament/new">첫 월드컵 만들기</Link>
              </Button>
            </EmptyContent>
          )}
        </Empty>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((t) => (
            <TournamentCard key={t.id} tournament={t} />
          ))}
        </div>
      )}

      {/* 화면에 들어오면 다음 페이지를 부른다. 첫 로딩 중에도 DOM 에 있어야 관찰이 시작된다. */}
      <div ref={sentinelRef} aria-hidden className="h-px" />

      {loadingMore && (
        <div
          role="status"
          aria-label="더 불러오는 중"
          className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
        >
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}

      {failed && (
        <div className="mt-6 flex justify-center">
          <Button variant="outline" onClick={retry}>
            다시 불러오기
          </Button>
        </div>
      )}

      {reachedEnd && items.length >= limit && (
        <p className="mt-6 text-center text-sm text-muted-foreground">모두 불러왔습니다</p>
      )}
    </div>
  );
}

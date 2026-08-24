'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Search, Trophy } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
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
  const [items, setItems] = useState<TournamentSummary[]>([]);
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [sort, setSort] = useState<TournamentSort>('recent');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  useEffect(() => {
    let alive = true;
    const params = new URLSearchParams({ sort, limit: '30', offset: '0' });
    if (debouncedQ) params.set('q', debouncedQ);

    // setState는 전부 await 뒤에서만 일어난다 — effect 본문에서 동기로 부르면 연쇄 렌더가 생긴다.
    (async () => {
      try {
        const data = await apiFetch<TournamentSummary[]>(`/api/tournaments/?${params}`);
        if (alive) setItems(data);
      } catch {
        if (alive) toast.error('월드컵 목록을 불러오지 못했습니다');
      } finally {
        if (alive) setLoading(false);
      }
    })();

    return () => {
      alive = false;
    };
  }, [debouncedQ, sort]);

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
    </div>
  );
}

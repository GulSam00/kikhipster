import Link from 'next/link';
import { LayoutGrid, Trophy } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TopsterCard from '@/components/music/TopsterCard';
import TournamentCard from '@/components/music/TournamentCard';
import { Button } from '@/components/ui/button';
import { Empty, EmptyContent, EmptyDescription, EmptyHeader, EmptyMedia, EmptyTitle } from '@/components/ui/empty';
import type { Topster } from '@/types/topster';
import type { TournamentSummary } from '@/types/tournament';

/** 공개 탑스터 전체를 최신순으로 (백엔드가 created_at desc 로 정렬). */
async function getTopsters(): Promise<Topster[]> {
  return apiFetch<Topster[]>('/api/topsters/?limit=12&offset=0');
}

/** 모든 사용자의 월드컵을 최신순으로. */
async function getTournaments(): Promise<TournamentSummary[]> {
  return apiFetch<TournamentSummary[]>('/api/tournaments/?sort=recent&limit=6&offset=0');
}

export default async function HomePage() {
  const [topsters, tournaments] = await Promise.all([getTopsters(), getTournaments()]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">최근 탑스터</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/topsters">더보기</Link>
          </Button>
        </div>

        {topsters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>아직 탑스터가 없습니다</EmptyTitle>
              <EmptyDescription>좋아하는 앨범으로 첫 차트를 만들어보세요.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/topsters/new">첫 탑스터 만들기</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {topsters.map((t) => (
              <TopsterCard key={t.id} topster={t} />
            ))}
          </div>
        )}
      </section>

      <section>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">최근 월드컵</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/tournament">더보기</Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>아직 월드컵이 없습니다</EmptyTitle>
              <EmptyDescription>좋아하는 곡이나 앨범을 모아 최애를 가려보세요.</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/tournament/new">첫 월드컵 만들기</Link>
              </Button>
            </EmptyContent>
          </Empty>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {tournaments.map((t) => (
              <TournamentCard key={t.id} tournament={t} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

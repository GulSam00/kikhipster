import { LayoutGrid, Trophy } from 'lucide-react';
import { getTranslations } from 'next-intl/server';
import Link from 'next/link';

import TopsterCard from '@/components/topster/TopsterCard';
import TournamentCard from '@/components/tournament/TournamentCard';
import { Button } from '@/components/ui/button';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';

import { listTopsters } from '@/lib/api/topsters';
import { listTournaments } from '@/lib/api/tournaments';

/** 홈에 깔 개수. 탑스터는 6열 그리드 두 줄, 월드컵은 3열 두 줄이다. */
const TOPSTER_COUNT = 12;
const TOURNAMENT_COUNT = 6;

/**
 * 최근 탑스터·월드컵은 요청 시점의 목록이다 — 빌드 때 한 번 굽는 정적 페이지로 두면 ① 배포 후에도
 * 빌드 시점의 목록이 계속 나오고 ② **빌드 환경에 백엔드가 없으면 prerender 에서 `fetch failed` 로
 * 빌드가 죽는다**(CI 첫 실행에서 실제로 겪음 — 로컬은 백엔드가 떠 있어 통과했다).
 */
export const dynamic = 'force-dynamic';

export default async function HomePage() {
  const [topsters, tournaments, t] = await Promise.all([
    listTopsters(TOPSTER_COUNT),
    listTournaments('recent', TOURNAMENT_COUNT),
    getTranslations('Home'),
  ]);

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-heading text-lg font-bold">{t('recentTopsters')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/topsters">{t('more')}</Link>
          </Button>
        </div>

        {topsters.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <LayoutGrid />
              </EmptyMedia>
              <EmptyTitle>{t('noTopsters')}</EmptyTitle>
              <EmptyDescription>{t('noTopstersDescription')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/topsters/new">{t('firstTopster')}</Link>
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
          <h2 className="font-heading text-lg font-bold">{t('recentTournaments')}</h2>
          <Button asChild variant="link" size="sm">
            <Link href="/tournament">{t('more')}</Link>
          </Button>
        </div>

        {tournaments.length === 0 ? (
          <Empty className="border">
            <EmptyHeader>
              <EmptyMedia variant="icon">
                <Trophy />
              </EmptyMedia>
              <EmptyTitle>{t('noTournaments')}</EmptyTitle>
              <EmptyDescription>{t('noTournamentsDescription')}</EmptyDescription>
            </EmptyHeader>
            <EmptyContent>
              <Button asChild>
                <Link href="/tournament/new">{t('firstTournament')}</Link>
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

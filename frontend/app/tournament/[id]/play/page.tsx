import type { Metadata } from 'next';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import PlayStarter from '@/components/music/PlayStarter';
import PoolItemTile from '@/components/music/PoolItemTile';
import { Button } from '@/components/ui/button';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/pool-item';
import type { TournamentDetail } from '@/types/tournament';

/** 미리보기로 깔 후보 수. 어떤 판을 시작하는지 알아볼 정도면 된다. */
const PREVIEW = 6;

export const metadata: Metadata = { title: '강수 고르기' };

/**
 * 강수를 고르고 판을 시작하는 화면.
 *
 * **`playId` 는 강수를 정해야 서버가 만들어준다**(`POST /plays` 본문에 `size`).
 * 그래서 이 화면은 `/play/{playId}` 를 쓸 수 없고 월드컵 하위 주소를 쓴다 —
 * 주소에 어느 월드컵인지가 들어 있어 새로고침에 견디고, 뒤로가기가 상세로 떨어진다.
 * 강수를 고르면 `PlayStarter` 가 판을 만들고 `/play/{playId}` 로 넘어간다.
 */
export default async function PlaySetupPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);
  const items = await fetchPoolItems(tournament.item_type, tournament.item_ids.slice(0, PREVIEW));

  return (
    <div className="mx-auto w-full max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href={`/tournament/${tournament.id}`}>
          <ChevronLeft />
          월드컵으로
        </Link>
      </Button>

      <h1 className="mb-1 font-heading text-2xl font-bold">{tournament.title}</h1>
      <p className="mb-6 text-sm text-muted-foreground tabular-nums">
        {ITEM_TYPE_LABEL[tournament.item_type]} {tournament.item_count}개 · 플레이{' '}
        {tournament.play_count}회
      </p>

      {items.length > 0 && (
        <div className="mb-8 grid grid-cols-3 gap-3 sm:grid-cols-6">
          {items.map((item) => (
            <PoolItemTile key={item.id} item={item} itemType={tournament.item_type} />
          ))}
        </div>
      )}

      <h2 className="mb-3 font-heading text-lg font-bold">몇 강으로 할까요?</h2>
      <PlayStarter tournamentId={tournament.id} availableSizes={tournament.available_sizes} />
    </div>
  );
}

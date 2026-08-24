import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import PlayStarter from '@/components/music/PlayStarter';
import PoolItemTile from '@/components/music/PoolItemTile';
import ShareButton from '@/components/music/ShareButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/pool-item';
import { formatDate } from '@/lib/utils';
import type { TournamentDetail } from '@/types/tournament';

/**
 * 풀이 최대 512개라 전부 타일로 깔면 이미지 요청이 그만큼 나간다.
 * 앞의 일부만 보여주고 나머지는 개수로 안내한다.
 */
const POOL_PREVIEW_LIMIT = 24;

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);

  const shownIds = tournament.item_ids.slice(0, POOL_PREVIEW_LIMIT);
  const items = await fetchPoolItems(tournament.item_type, shownIds);
  const hidden = tournament.item_count - shownIds.length;

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <div className="mb-2 flex items-center gap-1.5">
        <Badge variant="secondary" className="px-1.5 text-[10px]">
          {ITEM_TYPE_LABEL[tournament.item_type]} {tournament.item_count}
        </Badge>
        <Badge variant="outline" className="px-1.5 text-[10px]">
          플레이 {tournament.play_count}
        </Badge>
      </div>

      <h1 className="mb-1 font-heading text-2xl font-bold">{tournament.title}</h1>
      <p className="mb-3 text-sm text-muted-foreground">
        {tournament.user.nickname} · {formatDate(tournament.created_at)}
      </p>
      {tournament.description && (
        <p className="mb-6 text-sm whitespace-pre-wrap">{tournament.description}</p>
      )}

      <div className="mb-4">
        <PlayStarter tournamentId={tournament.id} availableSizes={tournament.available_sizes} />
      </div>

      <div className="mb-8 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="lg">
          <Link href={`/tournament/${tournament.id}/ranking`}>
            <BarChart3 />
            랭킹보기
          </Link>
        </Button>
        <ShareButton path={`/tournament/${tournament.id}`} />
      </div>

      <Separator className="mb-6" />

      <h2 className="mb-4 font-heading text-lg font-bold">
        후보 {tournament.item_count}
      </h2>
      {items.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">
          후보 정보를 불러오지 못했습니다.
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
            {items.map((item) => (
              <PoolItemTile key={item.id} item={item} itemType={tournament.item_type} />
            ))}
          </div>
          {hidden > 0 && (
            <p className="mt-3 text-center text-sm text-muted-foreground tabular-nums">
              외 {hidden}개
            </p>
          )}
        </>
      )}
    </div>
  );
}

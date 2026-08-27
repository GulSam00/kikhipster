import type { Metadata } from 'next';
import Link from 'next/link';
import { BarChart3 } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import CommentSection from '@/components/music/CommentSection';
import OwnerActions from '@/components/music/OwnerActions';
import PlayStarter from '@/components/music/PlayStarter';
import PoolGrid from '@/components/music/PoolGrid';
import ShareButton from '@/components/music/ShareButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/pool-item';
import { formatDate } from '@/lib/utils';
import type { TournamentDetail } from '@/types/tournament';

/**
 * 첫 화면에서 서버가 미리 받아 두는 개수. 풀이 최대 512개라 전부 그리면
 * 메타데이터 배치 조회가 그만큼 나가므로 앞부분만 SSR로 내려보내고,
 * 나머지는 `PoolGrid` 의 "더 보기"로 사용자가 원할 때 이어 받는다.
 */
const POOL_PREVIEW_LIMIT = 24;

/**
 * 공유했을 때 보이는 제목·설명. 썸네일은 같은 폴더의 `opengraph-image.tsx` 가 그린다
 * (Next가 파일 이름만으로 `og:image` 를 붙여준다 — 여기서 images를 지정할 필요가 없다).
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const { id } = await params;
  try {
    const t = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);
    const summary =
      t.description ||
      `${ITEM_TYPE_LABEL[t.item_type]} ${t.item_count}개로 겨루는 월드컵 · 플레이 ${t.play_count}회`;
    return {
      title: t.title,
      description: summary,
      openGraph: { title: t.title, description: summary, type: 'article' },
    };
  } catch {
    // 없는 월드컵이면 페이지 렌더에서 어차피 에러 경계로 간다 — 메타에서 터뜨리지 않는다.
    return { title: '월드컵' };
  }
}

export default async function TournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const tournament = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);

  const shownIds = tournament.item_ids.slice(0, POOL_PREVIEW_LIMIT);
  const items = await fetchPoolItems(tournament.item_type, shownIds);

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
        {/* 이 페이지는 Server Component라 로그인 사용자를 모른다 — 버튼만 클라이언트로 뺐다. */}
        <OwnerActions
          ownerId={tournament.user.id}
          editHref={`/tournament/${tournament.id}/edit`}
          deletePath={`/api/tournaments/${tournament.id}`}
          name={tournament.title}
          losesOnDelete="플레이 기록·랭킹·댓글이 함께 지워집니다."
          redirectTo="/tournament"
        />
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
        <PoolGrid
          itemType={tournament.item_type}
          allIds={tournament.item_ids}
          initialItems={items}
          initialRequested={shownIds.length}
        />
      )}

      <Separator className="my-6" />

      <CommentSection targetType="tournament" targetId={tournament.id} />
    </div>
  );
}

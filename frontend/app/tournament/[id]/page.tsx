import { BarChart3 } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';

import DetailActionBar from '@/components/common/DetailActionBar';
import DetailHeader from '@/components/common/DetailHeader';
import OwnerMenu from '@/components/common/OwnerMenu';
import ShareButton from '@/components/common/ShareButton';
import ViewCounter from '@/components/common/ViewCounter';
import CommentSection from '@/components/social/CommentSection';
import LikeButton from '@/components/social/LikeButton';
import PlayLauncher from '@/components/tournament/PlayLauncher';
import PoolGrid from '@/components/tournament/PoolGrid';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { getTournament, tournamentPath } from '@/lib/api/tournaments';
import { fetchPoolItems, ITEM_TYPE_LABEL } from '@/lib/domain/pool-item';

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
    const t = await getTournament(id);
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
  const tournament = await getTournament(id);

  const shownIds = tournament.item_ids.slice(0, POOL_PREVIEW_LIMIT);
  const items = await fetchPoolItems(tournament.item_type, shownIds);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* 이 페이지는 Server Component라 조회 기록만 클라이언트로 뺐다. */}
      <ViewCounter target="tournament" id={tournament.id} />

      <DetailHeader
        /*
          곡 월드컵인지 앨범 월드컵인지 화면에 없었다 — `ITEM_TYPE_LABEL` 은 OG 설명에만
          쓰이고 있었다(2026-09-01). 썸네일과 후보 그리드는 둘 다 앨범 아트라 그림만으로는
          구분되지 않는다. 탑스터가 격자 크기를 넣는 자리를 월드컵은 비워 두고 있었다.
        */
        badges={
          <Badge variant="outline" className="text-muted-foreground">
            {ITEM_TYPE_LABEL[tournament.item_type]} 월드컵
          </Badge>
        }
        title={tournament.title}
        authorId={tournament.user.id}
        authorNickname={tournament.user.nickname}
        createdAt={tournament.created_at}
        viewCount={tournament.view_count}
        likeCount={tournament.like_count}
        commentCount={tournament.comment_count}
        description={tournament.description}
        ownerMenu={
          /* 이 페이지는 Server Component라 로그인 사용자를 모른다 — 메뉴만 클라이언트다. */
          <OwnerMenu
            ownerId={tournament.user.id}
            editHref={`/tournament/${tournament.id}/edit`}
            deletePath={tournamentPath(tournament.id)}
            name={tournament.title}
            losesOnDelete="플레이 기록·랭킹·댓글이 함께 지워집니다."
            redirectTo="/tournament"
          />
        }
      />

      <h2 className="font-heading mb-4 text-lg font-bold">후보 {tournament.item_count}</h2>
      {items.length === 0 ? (
        <p className="text-muted-foreground py-6 text-center text-sm">
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

      <div className="mt-6">
        <DetailActionBar
          primary={
            <>
              {/* 강수를 고르면 그 자리에서 판이 만들어지고 /play/{playId} 로 넘어간다. */}
              <PlayLauncher
                tournamentId={tournament.id}
                availableSizes={tournament.available_sizes}
              />
              <Button asChild variant="outline" size="lg" className="h-12 px-6">
                <Link href={`/tournament/${tournament.id}/ranking`}>
                  <BarChart3 />
                  랭킹보기
                </Link>
              </Button>
            </>
          }
          engage={
            <>
              <LikeButton
                targetType="tournament"
                targetId={tournament.id}
                name={tournament.title}
              />
              <ShareButton path={`/tournament/${tournament.id}`} className="rounded-full" />
            </>
          }
        />
      </div>

      <Separator className="mb-6" />

      <CommentSection targetType="tournament" targetId={tournament.id} />
    </div>
  );
}

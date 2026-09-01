'use client';

import { Download } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import DetailActionBar from '@/components/common/DetailActionBar';
import DetailHeader from '@/components/common/DetailHeader';
import OwnerMenu from '@/components/common/OwnerMenu';
import ShareButton from '@/components/common/ShareButton';
import ViewCounter from '@/components/common/ViewCounter';
import CommentSection from '@/components/social/CommentSection';
import LikeButton from '@/components/social/LikeButton';
import TopsterCanvas from '@/components/topster/TopsterCanvas';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';

import { useAlbumItems } from '@/lib/hooks/use-album-covers';

import { ApiError } from '@/lib/api/client';
import { getTopster, topsterPath } from '@/lib/api/topsters';
import { downloadTopsterImage } from '@/lib/render/topster-image';

import type { Topster } from '@/types/topster';

/**
 * 탑스터 상세의 본문. 페이지가 Server Component 가 되면서(OG 메타 때문) 이쪽으로 나눴다.
 *
 * 데이터를 서버에서 받아 props 로 넣지 않고 여전히 클라이언트에서 불러오는 이유:
 * 좋아요·댓글·소유자 판정이 전부 클라이언트 상태라 어차피 하이드레이션 뒤에 한 번 더 동기화된다.
 * 서버 fetch 는 메타데이터와 OG 이미지용이다.
 */
export default function TopsterDetail({ id }: { id: string }) {
  const [topster, setTopster] = useState<Topster | null>(null);
  const [loading, setLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);
  const albumIds = useMemo(() => topster?.items.map((it) => it.album_spotify_id) ?? [], [topster]);
  const albums = useAlbumItems(albumIds);

  useEffect(() => {
    getTopster(id)
      .then(setTopster)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error('탑스터를 불러오지 못했습니다');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  async function handleDownload() {
    if (!topster) return;
    setDownloading(true);
    try {
      // 편집기와 같은 함수다. 남의 탑스터를 보다가도 저장할 수 있어야 해서 이쪽에도 붙였다
      // (2026-08-27 이전에는 만들기·수정 화면에서만 저장할 수 있었다).
      await downloadTopsterImage({
        options: topster,
        title: topster.title,
        items: topster.items,
        albums,
      });
    } catch {
      toast.error('이미지를 만들지 못했습니다');
    } finally {
      setDownloading(false);
    }
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
        <Spinner />
        불러오는 중...
      </div>
    );
  }

  if (!topster) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">탑스터를 찾을 수 없습니다.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      {/* 실제로 탑스터를 찾은 뒤에만 센다 — 위의 404 분기가 먼저 걸러진다. */}
      <ViewCounter target="topster" id={topster.id} />

      <DetailHeader
        title={topster.title}
        authorId={topster.user.id}
        authorNickname={topster.user.nickname}
        createdAt={topster.created_at}
        viewCount={topster.view_count}
        likeCount={topster.like_count}
        commentCount={topster.comment_count}
        description={topster.description}
        badges={
          <Badge variant="secondary" className="px-1.5 text-[10px]">
            {topster.width}×{topster.height}
          </Badge>
        }
        ownerMenu={
          /* 격자·배경색·넘버링은 수정 화면에서 고친다. */
          <OwnerMenu
            ownerId={topster.user.id}
            editHref={`/topsters/${topster.id}/edit`}
            deletePath={topsterPath(topster.id)}
            name={topster.title}
            losesOnDelete="댓글도 함께 지워집니다."
            redirectTo="/topsters"
          />
        }
      />

      <TopsterCanvas
        options={topster}
        title={topster.title}
        items={topster.items}
        albums={albums}
        className="mb-6"
      />

      <DetailActionBar
        primary={
          <Button
            onClick={handleDownload}
            disabled={downloading || topster.items.length === 0}
            size="lg"
            /* 주요 동작이라 기본 lg(h-11)보다 한 단계 키운다. 좁은 화면에서는 폭을 채운다. */
            className="h-12 w-full px-6 sm:w-auto"
          >
            <Download />
            {downloading ? '만드는 중...' : '이미지 저장'}
          </Button>
        }
        engage={
          <>
            <LikeButton targetType="topster" targetId={topster.id} name={topster.title} />
            <ShareButton path={`/topsters/${topster.id}`} className="rounded-full" />
          </>
        }
      />

      <Separator className="mb-6" />

      <CommentSection targetType="topster" targetId={topster.id} />
    </div>
  );
}

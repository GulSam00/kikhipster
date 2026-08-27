'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import CommentSection from '@/components/music/CommentSection';
import LikeButton from '@/components/music/LikeButton';
import OwnerActions from '@/components/music/OwnerActions';
import ShareButton from '@/components/music/ShareButton';
import TopsterCanvas from '@/components/music/TopsterCanvas';
import { Separator } from '@/components/ui/separator';
import { Spinner } from '@/components/ui/spinner';
import { useAlbumItems } from '@/lib/album-covers';
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
  const albumIds = useMemo(
    () => topster?.items.map((it) => it.album_spotify_id) ?? [],
    [topster],
  );
  const albums = useAlbumItems(albumIds);

  useEffect(() => {
    apiFetch<Topster>(`/api/topsters/${id}`)
      .then(setTopster)
      .catch((err) => {
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error('탑스터를 불러오지 못했습니다');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
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
    <div className="mx-auto w-full max-w-5xl px-4 py-8">
      <div className="mb-6">
        <h1 className="mb-1 font-heading text-2xl font-bold">{topster.title}</h1>
        {topster.description && (
          <p className="mb-2 text-sm text-muted-foreground">{topster.description}</p>
        )}
        <p className="text-xs text-muted-foreground">
          by{' '}
          <Link href={`/profile/${topster.user.id}`} className="transition-colors hover:text-primary">
            {topster.user.nickname}
          </Link>
        </p>
      </div>

      <TopsterCanvas
        options={topster}
        title={topster.title}
        items={topster.items}
        albums={albums}
        className="mb-6"
      />

      <div className="mb-8 flex items-center gap-2">
        <LikeButton targetType="topster" targetId={topster.id} name={topster.title} />
        <ShareButton path={`/topsters/${topster.id}`} label="링크 복사" className="rounded-full" />
        {/* 격자·배경색·넘버링은 수정 화면에서 고친다. 삭제는 2026-08-27부터 여기에 있다. */}
        <OwnerActions
          ownerId={topster.user.id}
          editHref={`/topsters/${topster.id}/edit`}
          deletePath={`/api/topsters/${topster.id}`}
          name={topster.title}
          losesOnDelete="댓글도 함께 지워집니다."
          redirectTo="/topsters"
          buttonClassName="rounded-full"
        />
      </div>

      <Separator className="mb-6" />

      <CommentSection targetType="topster" targetId={topster.id} />
    </div>
  );
}

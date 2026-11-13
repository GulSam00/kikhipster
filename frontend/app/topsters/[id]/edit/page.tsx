'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import TopsterEditor, { type TopsterEditorInitial } from '@/components/topster/TopsterEditor';
import { Spinner } from '@/components/ui/spinner';

import { useAlbumItems } from '@/lib/hooks/use-album-covers';
import { useMe } from '@/lib/hooks/use-me';

import { ApiError } from '@/lib/api/client';
import { getTopster, updateTopster } from '@/lib/api/topsters';
import type { PoolItem } from '@/lib/domain/pool-item';

import type { Topster, TopsterCreateBody } from '@/types/topster';

export default function EditTopsterPage() {
  const t = useTranslations('TopsterDetail');
  const te = useTranslations('TopsterEditor');
  const tc = useTranslations('Common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const [topster, setTopster] = useState<Topster | null>(null);
  const [loading, setLoading] = useState(true);

  const albumIds = useMemo(() => topster?.items.map((it) => it.album_spotify_id) ?? [], [topster]);
  const albums = useAlbumItems(albumIds);

  useEffect(() => {
    getTopster(id)
      .then(setTopster)
      .catch((err) => {
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
          toast.error(t('loadFailed'));
        }
      })
      .finally(() => setLoading(false));
  }, [id, t]);

  // 커버·제목이 다 도착해야 에디터를 띄운다. 먼저 띄우면 에디터가 빈 배치로 state를
  // 잡아버려 나중에 온 앨범이 반영되지 않는다.
  const ready = topster !== null && albumIds.every((aid) => albums.has(aid));

  const initial: TopsterEditorInitial | null = useMemo(() => {
    if (!topster || !ready) return null;

    // 격자 밖 position 이 남아 있어도 잘라내지 않는다 — 저장 전에는 원본을 보존한다.
    const maxPos = topster.items.reduce((m, it) => Math.max(m, it.position), -1);
    const size = Math.max(topster.width * topster.height, maxPos + 1);
    const placements: (PoolItem | null)[] = Array.from({ length: size }, () => null);

    topster.items.forEach((it) => {
      // iTunes에서 사라진 앨범이라도 id는 살려 둔다. null로 두면 저장할 때 그 칸이
      // 통째로 빠져 사용자가 모르는 사이에 앨범이 지워진다.
      placements[it.position] = albums.get(it.album_spotify_id) ?? {
        id: it.album_spotify_id,
        title: te('missingInfoPlaceholder'),
        subtitle: '',
        coverUrl: null,
      };
    });

    return {
      title: topster.title,
      description: topster.description,
      options: {
        width: topster.width,
        height: topster.height,
        background_color: topster.background_color,
        text_color: topster.text_color,
        cell_gap: topster.cell_gap,
        show_title: topster.show_title,
        show_album_info: topster.show_album_info,
        show_numbering: topster.show_numbering,
      },
      placements,
    };
  }, [topster, ready, albums, te]);

  async function save(body: TopsterCreateBody) {
    await updateTopster(id, body);
    toast.success(t('updated'));
    router.push(`/topsters/${id}`);
  }

  if (loading || (topster && !ready)) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
        <Spinner />
        {tc('loading')}
      </div>
    );
  }

  if (!topster) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  // me 가 undefined 인 동안은 아직 확인 중이라 판정하지 않는다.
  if (me !== undefined && me?.id !== topster.user.id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">{t('notOwner')}</p>
      </div>
    );
  }

  if (!initial) return null;

  return (
    <TopsterEditor
      heading={t('editHeading')}
      submitLabel={t('editSubmit')}
      savingLabel={t('saving')}
      initial={initial}
      onSubmit={save}
    />
  );
}

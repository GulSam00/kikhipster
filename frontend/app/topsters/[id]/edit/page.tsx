'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import TopsterEditor, { type TopsterEditorInitial } from '@/components/music/TopsterEditor';
import { Spinner } from '@/components/ui/spinner';
import { useAlbumItems } from '@/lib/album-covers';
import type { PoolItem } from '@/lib/pool-item';
import { useMe } from '@/lib/use-me';
import type { Topster, TopsterCreateBody } from '@/types/topster';

export default function EditTopsterPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
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
        if (!(err instanceof ApiError && (err.status === 404 || err.status === 403))) {
          toast.error('탑스터를 불러오지 못했습니다');
        }
      })
      .finally(() => setLoading(false));
  }, [id]);

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
        title: '(정보 없음)',
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
  }, [topster, ready, albums]);

  async function save(body: TopsterCreateBody) {
    await apiFetch(`/api/topsters/${id}`, { method: 'PUT', body: JSON.stringify(body) });
    toast.success('탑스터를 수정했습니다');
    router.push(`/topsters/${id}`);
  }


  if (loading || (topster && !ready)) {
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

  // me 가 undefined 인 동안은 아직 확인 중이라 판정하지 않는다.
  if (me !== undefined && me?.id !== topster.user.id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">내가 만든 탑스터만 수정할 수 있습니다.</p>
      </div>
    );
  }

  if (!initial) return null;

  return (
    <TopsterEditor
      heading="탑스터 수정"
      submitLabel="수정 저장"
      savingLabel="저장 중..."
      initial={initial}
      onSubmit={save}
    />
  );
}

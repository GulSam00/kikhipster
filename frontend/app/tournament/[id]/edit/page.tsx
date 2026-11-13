'use client';

import { useTranslations } from 'next-intl';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import TournamentEditor, {
  type TournamentEditorInitial,
} from '@/components/tournament/TournamentEditor';
import { Spinner } from '@/components/ui/spinner';

import { useMe } from '@/lib/hooks/use-me';

import { ApiError } from '@/lib/api/client';
import { getTournament, updateTournament } from '@/lib/api/tournaments';
import { fetchPoolItems } from '@/lib/domain/pool-item';

import type { TournamentCreateBody, TournamentDetail } from '@/types/tournament';

export default function EditTournamentPage() {
  const t = useTranslations('TournamentDetail');
  const te = useTranslations('TopsterEditor');
  const tc = useTranslations('Common');
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [initial, setInitial] = useState<TournamentEditorInitial | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const tour = await getTournament(id);
        if (!alive) return;
        setTournament(tour);

        // 풀은 id만 오므로 제목·커버를 채워야 위저드에 그대로 얹을 수 있다.
        // iTunes에서 사라진 항목도 id는 살려 둔다 — 빠뜨리면 저장할 때 풀에서 조용히 지워진다.
        const items = await fetchPoolItems(tour.item_type, tour.item_ids);
        const found = new Map(items.map((it) => [it.id, it]));
        if (!alive) return;
        setInitial({
          itemType: tour.item_type,
          title: tour.title,
          description: tour.description,
          pool: tour.item_ids.map(
            (itemId) =>
              found.get(itemId) ?? {
                id: itemId,
                title: te('missingInfoPlaceholder'),
                subtitle: '',
                coverUrl: null,
              },
          ),
        });
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error(t('loadFailed'));
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id, t, te]);

  async function save(body: TournamentCreateBody) {
    // item_type 은 보내지 않는다 — 백엔드가 무시하기도 하고, 바뀔 수 있다는 인상을 주면 안 된다.
    await updateTournament(id, {
      title: body.title,
      description: body.description,
      item_ids: body.item_ids,
    });
    toast.success(t('updated'));
    router.push(`/tournament/${id}`);
  }

  if (loading) {
    return (
      <div className="text-muted-foreground flex flex-1 items-center justify-center gap-2">
        <Spinner />
        {tc('loading')}
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">{t('notFound')}</p>
      </div>
    );
  }

  // me 가 undefined 인 동안은 아직 확인 중이라 판정하지 않는다.
  if (me !== undefined && me?.id !== tournament.user.id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">{t('notOwner')}</p>
      </div>
    );
  }

  if (!initial) return null;

  return <TournamentEditor initial={initial} onSubmit={save} backHref={`/tournament/${id}`} />;
}

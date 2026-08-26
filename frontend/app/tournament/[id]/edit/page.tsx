'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch, ApiError } from '@/lib/api';
import TournamentEditor, {
  type TournamentEditorInitial,
} from '@/components/music/TournamentEditor';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { fetchPoolItems } from '@/lib/pool-item';
import { useMe } from '@/lib/use-me';
import type { TournamentCreateBody, TournamentDetail } from '@/types/tournament';

export default function EditTournamentPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const me = useMe();
  const [tournament, setTournament] = useState<TournamentDetail | null>(null);
  const [initial, setInitial] = useState<TournamentEditorInitial | null>(null);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const t = await apiFetch<TournamentDetail>(`/api/tournaments/${id}`);
        if (!alive) return;
        setTournament(t);

        // 풀은 id만 오므로 제목·커버를 채워야 위저드에 그대로 얹을 수 있다.
        // iTunes에서 사라진 항목도 id는 살려 둔다 — 빠뜨리면 저장할 때 풀에서 조용히 지워진다.
        const items = await fetchPoolItems(t.item_type, t.item_ids);
        const found = new Map(items.map((it) => [it.id, it]));
        if (!alive) return;
        setInitial({
          itemType: t.item_type,
          title: t.title,
          description: t.description,
          pool: t.item_ids.map(
            (itemId) =>
              found.get(itemId) ?? {
                id: itemId,
                title: '(정보 없음)',
                subtitle: '',
                coverUrl: null,
              },
          ),
        });
      } catch (err) {
        if (!(err instanceof ApiError && err.status === 404)) {
          toast.error('월드컵을 불러오지 못했습니다');
        }
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [id]);

  async function save(body: TournamentCreateBody) {
    // item_type 은 보내지 않는다 — 백엔드가 무시하기도 하고, 바뀔 수 있다는 인상을 주면 안 된다.
    await apiFetch(`/api/tournaments/${id}`, {
      method: 'PUT',
      body: JSON.stringify({
        title: body.title,
        description: body.description,
        item_ids: body.item_ids,
      }),
    });
    toast.success('월드컵을 수정했습니다');
    router.push(`/tournament/${id}`);
  }

  async function doDelete() {
    setDeleting(true);
    try {
      await apiFetch(`/api/tournaments/${id}`, { method: 'DELETE' });
      toast.success('월드컵을 삭제했습니다');
      router.push('/tournament');
    } catch {
      toast.error('삭제에 실패했습니다');
      setDeleting(false);
    }
  }

  function confirmDelete() {
    toast.warning('이 월드컵을 삭제할까요?', {
      id: 'tournament-delete-confirm',
      description: '플레이 기록·랭킹·댓글이 함께 지워지고 되돌릴 수 없습니다.',
      duration: 10000,
      action: { label: '삭제', onClick: () => void doDelete() },
      cancel: { label: '취소', onClick: () => toast.dismiss('tournament-delete-confirm') },
    });
  }

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-muted-foreground">
        <Spinner />
        불러오는 중...
      </div>
    );
  }

  if (!tournament) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">월드컵을 찾을 수 없습니다.</p>
      </div>
    );
  }

  // me 가 undefined 인 동안은 아직 확인 중이라 판정하지 않는다.
  if (me !== undefined && me?.id !== tournament.user.id) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-muted-foreground">내가 만든 월드컵만 수정할 수 있습니다.</p>
      </div>
    );
  }

  if (!initial) return null;

  return (
    <TournamentEditor
      initial={initial}
      onSubmit={save}
      backHref={`/tournament/${id}`}
      extraActions={
        <Button onClick={confirmDelete} disabled={deleting} variant="destructive" size="lg" className="h-11">
          <Trash2 />
          {deleting ? '삭제 중...' : '삭제'}
        </Button>
      }
    />
  );
}

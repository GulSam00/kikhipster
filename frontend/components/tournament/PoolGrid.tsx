'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import PoolItemTile from '@/components/tournament/PoolItemTile';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePoolPlayer } from '@/lib/hooks/use-pool-player';
import { fetchPoolItems, type PoolItem } from '@/lib/domain/pool-item';
import type { TournamentItemType } from '@/types/tournament';

/**
 * 한 번 "더 보기"를 누를 때 받아오는 개수.
 *
 * 첫 화면(서버에서 받아 오는 분량)보다 크게 잡았다. 풀은 최대 512개라 24개씩 늘리면
 * 끝까지 20번을 눌러야 한다. 타일 이미지는 `next/image` 기본값(lazy)이라 뷰포트에
 * 들어와야 받지만, **메타데이터 배치 조회는 그리는 만큼 전부 나간다** — 원래 앞부분만
 * 보여주던 이유가 그것이라 한 번에 다 받지는 않는다.
 */
const LOAD_MORE_SIZE = 48;

interface Props {
  itemType: TournamentItemType;
  /** 풀 전체의 item_id. 서버가 상세 응답으로 이미 다 내려준다. */
  allIds: string[];
  /** 서버에서 미리 받아 둔 앞부분. 첫 화면은 이걸 그대로 쓴다(SSR 유지). */
  initialItems: PoolItem[];
  /**
   * 서버가 **요청한** id 개수. `initialItems.length` 로 대신할 수 없다 —
   * iTunes에서 사라진 항목은 응답에 안 실려 오므로 받은 개수가 더 적을 수 있고,
   * 그 차이만큼 다음 구간의 시작이 밀려 같은 id를 다시 요청하게 된다.
   */
  initialRequested: number;
}

export default function PoolGrid({ itemType, allIds, initialItems, initialRequested }: Props) {
  const [items, setItems] = useState<PoolItem[]>(initialItems);
  const [loading, setLoading] = useState(false);
  const [requested, setRequested] = useState(initialRequested);
  // 후보를 눌러 바로 들어볼 수 있게 한다 — 곡이면 그 곡, 앨범이면 수록곡 전체가 큐로 간다.
  const { playItem, pendingId, currentId, isPlaying } = usePoolPlayer(itemType);

  const remaining = allIds.length - requested;

  const loadMore = async () => {
    if (loading || remaining <= 0) return;
    setLoading(true);
    const next = allIds.slice(requested, requested + LOAD_MORE_SIZE);
    try {
      const fetched = await fetchPoolItems(itemType, next);
      setItems((prev) => [...prev, ...fetched]);
      setRequested((n) => n + next.length);
    } catch {
      toast.error('후보를 더 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((item) => (
          <PoolItemTile
            key={item.id}
            item={item}
            itemType={itemType}
            onPlay={() => void playItem(item)}
            playing={currentId === item.id && isPlaying}
            loading={pendingId === item.id}
          />
        ))}
      </div>

      {remaining > 0 && (
        <div className="mt-4 flex justify-center">
          <Button variant="outline" onClick={loadMore} disabled={loading}>
            {loading ? <Spinner /> : null}
            {loading ? '불러오는 중' : `더 보기 (남은 ${remaining}개)`}
          </Button>
        </div>
      )}
    </>
  );
}

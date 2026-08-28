'use client';

import { Pause, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePoolPlayer } from '@/lib/hooks/use-pool-player';
import type { PoolItem } from '@/lib/domain/pool-item';
import type { TournamentItemType } from '@/types/tournament';

interface Props {
  item: PoolItem;
  itemType: TournamentItemType;
  className?: string;
}

/**
 * 월드컵 항목 하나짜리 재생 버튼. **Server Component 안에서 쓰라고 있는 것**이다
 * (랭킹표처럼 서버에서 그리는 목록) — `PoolGrid` 는 이미 클라이언트라 훅을 직접 쓴다.
 *
 * 목록에 여러 개가 깔리므로 중립색이다(DESIGN.md § Color budget).
 */
export default function PoolItemPlayButton({ item, itemType, className }: Props) {
  const { playItem, pendingId, currentId, isPlaying } = usePoolPlayer(itemType);
  const playing = currentId === item.id && isPlaying;

  // 미리듣기가 없는 곡은 버튼 자체를 내지 않는다. 앨범은 눌러 봐야 알 수 있어 항상 낸다.
  if (itemType === 'track' && !item.previewUrl) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      className={className}
      onClick={() => void playItem(item)}
      disabled={pendingId === item.id}
      aria-label={`${item.title} 재생`}
    >
      {pendingId === item.id ? <Spinner /> : playing ? <Pause /> : <Play />}
    </Button>
  );
}

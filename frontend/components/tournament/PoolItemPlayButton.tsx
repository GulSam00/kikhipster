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
  /**
   * 목록에 깔릴 때는 중립색(`ghost`)이 기본이다(DESIGN.md § Color budget).
   * 커버 위에 얹을 때만 `secondary` 로 배경을 줘서 앨범 아트와 분리한다.
   */
  variant?: React.ComponentProps<typeof Button>['variant'];
  className?: string;
  /** Button 기본 아이콘은 `size-4` 다 — 크게 놓을 땐 여기서 올린다. */
  iconClassName?: string;
}

/**
 * 월드컵 항목 하나짜리 재생 버튼.
 *
 * 랭킹표처럼 서버에서 그리는 목록(Server Component)에서도, 대결·우승 화면처럼 이미
 * 클라이언트인 곳에서도 같은 것을 쓴다 — `PoolGrid` 만 예외로 훅을 직접 쓴다(타일마다
 * 다른 상태를 한 훅으로 관리한다).
 */
export default function PoolItemPlayButton({
  item,
  itemType,
  variant = 'ghost',
  className,
  iconClassName,
}: Props) {
  const { playItem, pendingId, currentId, isPlaying } = usePoolPlayer(itemType);
  const playing = currentId === item.id && isPlaying;

  // 미리듣기가 없는 곡은 버튼 자체를 내지 않는다. 앨범은 눌러 봐야 알 수 있어 항상 낸다.
  if (itemType === 'track' && !item.previewUrl) return null;

  return (
    <Button
      variant={variant}
      size="icon"
      className={className}
      onClick={() => void playItem(item)}
      disabled={pendingId === item.id}
      aria-label={`${item.title} ${playing ? '일시정지' : '미리듣기'}`}
    >
      {pendingId === item.id ? (
        <Spinner className={iconClassName} />
      ) : playing ? (
        <Pause className={iconClassName} />
      ) : (
        <Play className={iconClassName} />
      )}
    </Button>
  );
}

'use client';

import { useState, type ComponentProps, type MouseEvent } from 'react';
import { Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { usePlayer } from '@/contexts/PlayerContext';
import { albumQueueTracks } from '@/lib/domain/playable';
import { cn } from '@/lib/utils';
import type { QueueTrack } from '@/types/player';
import { toast } from 'sonner';

interface Props {
  albumId: string;
  /** 접근성 라벨에 쓴다. */
  albumTitle: string;
  /**
   * 이미 받아 둔 수록곡. 앨범 상세처럼 트랙이 화면에 이미 있는 곳은 넘겨서
   * 같은 요청을 다시 하지 않는다. 없으면 누를 때 받아 온다.
   */
  tracks?: QueueTrack[];
  /** 주면 아이콘 옆에 글자가 붙는다(앨범 상세의 '전체 재생'). 없으면 아이콘만. */
  label?: string;
  /**
   * 목록에 깔리는 자리는 `secondary` 로 준다. 카드 그리드에 primary 버튼이 수십 개
   * 뜨면 DESIGN.md § Color budget 의 BLOCK(한 화면 4개 초과)이다 — 앨범 상세처럼
   * 화면에 하나뿐인 1차 CTA 에서만 기본값(primary)을 쓴다.
   */
  variant?: ComponentProps<typeof Button>['variant'];
  className?: string;
}

/**
 * 앨범을 눌러 수록곡 전체를 재생목록에 넣고 첫 곡부터 트는 버튼.
 *
 * 앨범 자체에는 미리듣기가 없다 — iTunes 는 곡 단위로만 `previewUrl` 을 준다. 그래서
 * "앨범 재생"은 수록곡을 받아 큐에 붙이는 일이 된다. 트랙을 미리 받아 두지 않는 이유는
 * 목록 화면에서 앨범 카드가 수십 개씩 깔리기 때문이다 — 누른 것만 받는다.
 */
export default function AlbumPlayButton({
  albumId,
  albumTitle,
  tracks,
  label,
  variant,
  className,
}: Props) {
  const { enqueueAndPlay } = usePlayer();
  const [loading, setLoading] = useState(false);

  async function handleClick(e: MouseEvent) {
    // 카드 전체를 덮는 링크 위에 얹히는 자리가 있다 — 눌러도 상세로 가지 않게 막는다.
    e.preventDefault();
    e.stopPropagation();
    if (loading) return;

    setLoading(true);
    try {
      const queue = tracks ?? (await albumQueueTracks(albumId));
      if (queue.length === 0) {
        toast.error('이 앨범은 미리듣기를 제공하지 않습니다');
        return;
      }
      enqueueAndPlay(queue);
    } catch {
      toast.error('앨범 수록곡을 불러오지 못했습니다');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      variant={variant}
      size={label ? 'default' : 'icon'}
      className={cn(label ? undefined : 'size-9 rounded-full', className)}
      onClick={handleClick}
      disabled={loading}
      aria-label={label ? undefined : `${albumTitle} 재생`}
    >
      {loading ? <Spinner /> : <Play />}
      {label}
    </Button>
  );
}

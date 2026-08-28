'use client';

import { Pause, Play } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import LikeButton from '@/components/social/LikeButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface Props {
  track: {
    id: string;
    name: string;
    duration_ms: number;
    explicit: boolean;
    preview_url: string | null;
    track_number?: number;
  };
  artist: string;
  albumCover: string | null;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function TrackRow({ track, artist, albumCover }: Props) {
  const { enqueueAndPlay, toggle, currentTrack, isPlaying } = usePlayer();
  const isActive = currentTrack?.id === track.id;

  function handlePlay() {
    if (!track.preview_url) return;
    // 지금 이 곡이 재생 중이면 큐를 건드리지 않고 멈추기만 한다.
    if (isActive) {
      toggle();
      return;
    }
    enqueueAndPlay([
      {
        id: track.id,
        name: track.name,
        artist,
        albumCover,
        previewUrl: track.preview_url,
      },
    ]);
  }

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-lg px-3 py-2 transition-colors hover:bg-accent',
        isActive && 'bg-accent',
      )}
    >
      <span className="w-6 shrink-0 text-right text-xs text-muted-foreground">
        {track.track_number ?? ''}
      </span>

      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 truncate text-sm', isActive && 'text-primary')}>
          <span className="truncate">{track.name}</span>
          {track.explicit && (
            <Badge variant="outline" className="shrink-0 px-1 text-[10px]">
              E
            </Badge>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">{artist}</p>
      </div>

      <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
        {formatMs(track.duration_ms)}
      </span>

      {/*
        여러 행에 나란히 놓이므로 tone="inline" — DESIGN.md § Color budget 상 primary
        강조가 한 화면에 4개를 넘으면 BLOCK 이라 여기서는 색 대신 채움으로 상태를 보인다.
      */}
      <LikeButton targetType="track" targetId={track.id} name={track.name} tone="inline" />

      {track.preview_url ? (
        /*
          좋아요와 같은 이유로 ghost — 한 앨범에 트랙이 12행이면 primary 로 칠한 재생
          버튼이 화면에 12개가 된다(DESIGN.md § Color budget 상 4개 초과는 BLOCK).
          재생 중인 행은 배경 bg-accent 와 곡명 text-primary 로 이미 구분되므로
          버튼은 색이 아니라 밝기 단계로만 상태를 보인다.
        */
        <Button
          size="icon-xs"
          variant="ghost"
          className={cn(
            'shrink-0 rounded-full text-muted-foreground hover:text-foreground',
            isActive && 'text-foreground',
          )}
          onClick={handlePlay}
          aria-label={`${track.name} 미리듣기`}
        >
          {isActive && isPlaying ? <Pause /> : <Play />}
        </Button>
      ) : (
        <div className="size-6 shrink-0" />
      )}
    </div>
  );
}

'use client';

import { Music2, Pause, Play } from 'lucide-react';
import Image from 'next/image';

import LikeButton from '@/components/social/LikeButton';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

import { cn } from '@/lib/utils';

import { usePlayer } from '@/contexts/PlayerContext';

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
  /**
   * 앨범 커버를 행에 그릴지. 앨범 상세는 **전곡이 같은 커버**라 켜지 않는다 —
   * 같은 그림이 세로로 반복될 뿐이다. 검색 곡 탭처럼 곡마다 앨범이 다른 자리에서만 켠다.
   */
  showCover?: boolean;
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function TrackRow({ track, artist, albumCover, showCover = false }: Props) {
  const { enqueueAndPlay, toggle, currentTrack, isPlaying } = usePlayer();
  const isActive = currentTrack?.id === track.id;
  const playable = !!track.preview_url;

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
        'hover:bg-accent relative flex items-center gap-3 rounded-lg px-3 py-2 transition-colors',
        isActive && 'bg-accent',
      )}
    >
      {/*
        **행 전체가 재생 버튼이다** (2026-09-01). 곡 이름을 눌렀는데 아무 일도 안 일어나는
        게 이상해서 넣었다.

        `<div onClick>` 대신 `absolute inset-0` 로 덮는 진짜 `<button>` 을 쓴다 —
        `AlbumCard` 가 링크로 같은 일을 하는 패턴이다. 버튼 안에 버튼을 넣는 것은 무효
        마크업이라 하트·재생 버튼을 자식으로 둘 수 없고, `<div onClick>` 은 키보드 접근과
        focus ring 을 직접 붙여야 한다(§ Component states — 없으면 BLOCK). 형제로 깔면
        둘 다 공짜로 온다.

        미리듣기가 없는 곡은 이 덮개를 아예 렌더하지 않는다 — 눌러도 안 되는 자리를
        누를 수 있게 보이면 안 된다.
      */}
      {playable && (
        <button
          type="button"
          onClick={handlePlay}
          aria-label={`${track.name} 미리듣기`}
          className="focus-visible:ring-ring/50 absolute inset-0 cursor-pointer rounded-lg outline-none focus-visible:ring-3"
        />
      )}

      {/*
        재생 버튼이 행 맨 앞이다. 덮개 위(`z-10`)에 있어야 자기 클릭을 받는다 —
        지금은 같은 동작이라 어느 쪽이 받아도 결과가 같지만, 겹친 채로 두면 나중에
        동작이 갈릴 때 조용히 어긋난다.
      */}
      {playable ? (
        <Button
          size="icon-xs"
          variant="ghost"
          className={cn(
            'text-muted-foreground hover:text-foreground z-10 shrink-0 rounded-full',
            isActive && 'text-foreground',
          )}
          onClick={handlePlay}
          tabIndex={-1}
          aria-hidden
        >
          {isActive && isPlaying ? <Pause /> : <Play />}
        </Button>
      ) : (
        <div className="size-6 shrink-0" />
      )}

      <span className="text-muted-foreground w-6 shrink-0 text-right text-xs">
        {track.track_number ?? ''}
      </span>

      {showCover &&
        (albumCover ? (
          <Image
            src={albumCover}
            alt=""
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="bg-muted text-muted-foreground flex size-10 shrink-0 items-center justify-center rounded-md">
            <Music2 className="size-4" />
          </div>
        ))}

      <div className="min-w-0 flex-1">
        <p className={cn('flex items-center gap-1.5 truncate text-sm', isActive && 'text-primary')}>
          <span className="truncate">{track.name}</span>
          {track.explicit && (
            <Badge variant="outline" className="shrink-0 px-1 text-[10px]">
              E
            </Badge>
          )}
        </p>
        <p className="text-muted-foreground truncate text-xs">{artist}</p>
      </div>

      <span className="text-muted-foreground shrink-0 text-xs tabular-nums">
        {formatMs(track.duration_ms)}
      </span>

      {/*
        여러 행에 나란히 놓이므로 tone="inline" — DESIGN.md § Color budget 상 primary
        강조가 한 화면에 4개를 넘으면 BLOCK 이라 여기서는 색 대신 채움으로 상태를 보인다.
        덮개 위에 있어야 좋아요가 재생으로 새지 않는다.
      */}
      <LikeButton
        targetType="track"
        targetId={track.id}
        name={track.name}
        tone="inline"
        className="z-10"
      />
    </div>
  );
}

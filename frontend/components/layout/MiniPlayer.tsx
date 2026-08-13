'use client';

import Image from 'next/image';
import { Pause, Play, X, Music2 } from 'lucide-react';
import { usePlayer } from '@/contexts/PlayerContext';
import { Button } from '@/components/ui/button';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, toggle, pause } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed inset-x-0 bottom-16 z-40 border-t bg-card px-4 py-2 sm:bottom-0">
      <div className="mx-auto flex max-w-6xl items-center gap-3">
        {currentTrack.albumCover ? (
          <Image
            src={currentTrack.albumCover}
            alt={currentTrack.name}
            width={40}
            height={40}
            className="size-10 shrink-0 rounded-md object-cover"
          />
        ) : (
          <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
            <Music2 className="size-4" />
          </div>
        )}

        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{currentTrack.name}</p>
          <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="icon-sm"
            className="rounded-full"
            onClick={toggle}
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? <Pause /> : <Play />}
          </Button>
          <Button size="icon-sm" variant="ghost" onClick={pause} aria-label="플레이어 닫기">
            <X />
          </Button>
        </div>
      </div>
    </div>
  );
}

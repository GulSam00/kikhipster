'use client';

import Image from 'next/image';
import { usePlayer } from '@/contexts/PlayerContext';

export default function MiniPlayer() {
  const { currentTrack, isPlaying, toggle, pause } = usePlayer();

  if (!currentTrack) return null;

  return (
    <div className="fixed bottom-16 sm:bottom-0 left-0 right-0 z-40 bg-zinc-900 border-t border-zinc-800 px-4 py-2">
      <div className="mx-auto max-w-6xl flex items-center gap-3">
        {currentTrack.albumCover ? (
          <Image
            src={currentTrack.albumCover}
            alt={currentTrack.name}
            width={40}
            height={40}
            className="rounded"
          />
        ) : (
          <div className="w-10 h-10 rounded bg-zinc-700 shrink-0" />
        )}

        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-white truncate">{currentTrack.name}</p>
          <p className="text-xs text-zinc-400 truncate">{currentTrack.artist}</p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={toggle}
            className="w-8 h-8 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 text-white text-sm transition-colors"
            aria-label={isPlaying ? '일시정지' : '재생'}
          >
            {isPlaying ? '⏸' : '▶'}
          </button>
          <button
            onClick={pause}
            className="w-8 h-8 flex items-center justify-center rounded-full text-zinc-400 hover:text-white transition-colors"
            aria-label="닫기"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

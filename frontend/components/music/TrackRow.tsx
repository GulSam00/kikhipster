'use client';

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
}

function formatMs(ms: number) {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export default function TrackRow({ track, artist, albumCover }: Props) {
  const { play, currentTrack, isPlaying } = usePlayer();
  const isActive = currentTrack?.id === track.id;

  function handlePlay() {
    if (!track.preview_url) return;
    play({
      id: track.id,
      name: track.name,
      artist,
      albumCover,
      previewUrl: track.preview_url,
    });
  }

  return (
    <div
      className={`flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800 transition-colors ${isActive ? 'bg-zinc-800' : ''}`}
    >
      <span className="w-6 text-xs text-zinc-500 text-right shrink-0">
        {track.track_number ?? ''}
      </span>
      <div className="flex-1 min-w-0">
        <p className={`text-sm truncate ${isActive ? 'text-violet-400' : 'text-white'}`}>
          {track.name}
          {track.explicit && <span className="ml-1 text-xs text-zinc-500">E</span>}
        </p>
        <p className="text-xs text-zinc-400 truncate">{artist}</p>
      </div>
      <span className="text-xs text-zinc-500 shrink-0">{formatMs(track.duration_ms)}</span>
      {track.preview_url ? (
        <button
          onClick={handlePlay}
          className="w-7 h-7 flex items-center justify-center rounded-full bg-violet-600 hover:bg-violet-500 text-white text-xs shrink-0 transition-colors"
          aria-label="미리듣기"
        >
          {isActive && isPlaying ? '⏸' : '▶'}
        </button>
      ) : (
        <div className="w-7 h-7 shrink-0" />
      )}
    </div>
  );
}

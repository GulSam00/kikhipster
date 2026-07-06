'use client';

import { useCallback, useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api';
import ArtistCard from '@/components/music/ArtistCard';
import AlbumCard from '@/components/music/AlbumCard';
import TrackRow from '@/components/music/TrackRow';
import type { ArtistSummary, AlbumSummary, TrackSearchItem } from '@/types/music';

type Tab = 'artists' | 'albums' | 'tracks';

function useDebounce<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('artists');
  const [artists, setArtists] = useState<ArtistSummary[]>([]);
  const [albums, setAlbums] = useState<AlbumSummary[]>([]);
  const [tracks, setTracks] = useState<TrackSearchItem[]>([]);
  const [loading, setLoading] = useState(false);

  const debouncedQuery = useDebounce(query, 300);

  const search = useCallback(async (q: string, t: Tab) => {
    if (!q.trim()) {
      setArtists([]); setAlbums([]); setTracks([]);
      return;
    }
    setLoading(true);
    try {
      if (t === 'artists') {
        const res = await apiFetch<{ items: ArtistSummary[] }>(`/api/music/search/artists?q=${encodeURIComponent(q)}&limit=20`);
        setArtists(res.items);
      } else if (t === 'albums') {
        const res = await apiFetch<{ items: AlbumSummary[] }>(`/api/music/search/albums?q=${encodeURIComponent(q)}&limit=20`);
        setAlbums(res.items);
      } else {
        const res = await apiFetch<{ items: TrackSearchItem[] }>(`/api/music/search/tracks?q=${encodeURIComponent(q)}&limit=20`);
        setTracks(res.items);
      }
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery, tab);
  }, [debouncedQuery, tab, search]);

  const tabs: { key: Tab; label: string }[] = [
    { key: 'artists', label: '아티스트' },
    { key: 'albums', label: '앨범' },
    { key: 'tracks', label: '곡' },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-8">
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="아티스트, 앨범, 곡 검색..."
        className="w-full px-4 py-3 rounded-xl bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500 mb-4"
        autoFocus
      />

      <div className="flex gap-1 mb-6 border-b border-zinc-800">
        {tabs.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === key
                ? 'border-violet-500 text-violet-400'
                : 'border-transparent text-zinc-400 hover:text-white'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading && <p className="text-zinc-500 text-sm">검색 중...</p>}

      {!loading && tab === 'artists' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {artists.map((a) => <ArtistCard key={a.id} artist={a} />)}
        </div>
      )}

      {!loading && tab === 'albums' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3">
          {albums.map((a) => <AlbumCard key={a.id} album={a} />)}
        </div>
      )}

      {!loading && tab === 'tracks' && (
        <div className="flex flex-col">
          {tracks.map((t) => (
            <TrackRow
              key={t.id}
              track={{ ...t, explicit: t.explicit }}
              artist={t.artists.join(', ')}
              albumCover={t.album.cover_url}
            />
          ))}
        </div>
      )}

      {!loading && query && artists.length === 0 && albums.length === 0 && tracks.length === 0 && (
        <p className="text-zinc-500 text-sm">검색 결과가 없습니다.</p>
      )}
    </div>
  );
}

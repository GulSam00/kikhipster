'use client';

import { SearchIcon } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';

import AlbumCard from '@/components/music/AlbumCard';
import ArtistCard from '@/components/music/ArtistCard';
import TrackRow from '@/components/music/TrackRow';
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty';
import { Input } from '@/components/ui/input';
import { Spinner } from '@/components/ui/spinner';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

import { searchAlbums, searchArtists, searchTracks } from '@/lib/api/music';

import type { AlbumSummary, ArtistSummary, TrackSearchItem } from '@/types/music';

type Tab = 'artists' | 'albums' | 'tracks';

const tabs: { key: Tab; label: string }[] = [
  { key: 'artists', label: '아티스트' },
  { key: 'albums', label: '앨범' },
  { key: 'tracks', label: '곡' },
];

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
      setArtists([]);
      setAlbums([]);
      setTracks([]);
      return;
    }
    setLoading(true);
    try {
      if (t === 'artists') {
        const res = { items: await searchArtists(q) };
        setArtists(res.items);
      } else if (t === 'albums') {
        const res = { items: await searchAlbums(q) };
        setAlbums(res.items);
      } else {
        const res = { items: await searchTracks(q) };
        setTracks(res.items);
      }
    } catch {
      toast.error('검색에 실패했습니다');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    search(debouncedQuery, tab);
  }, [debouncedQuery, tab, search]);

  const isEmpty =
    !loading && !!query && artists.length === 0 && albums.length === 0 && tracks.length === 0;

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="relative mb-4">
        <SearchIcon className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="아티스트, 앨범, 곡 검색..."
          className="h-11 pl-9"
          autoFocus
        />
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList variant="line" className="mb-2 border-b">
          {tabs.map(({ key, label }) => (
            <TabsTrigger key={key} value={key}>
              {label}
            </TabsTrigger>
          ))}
        </TabsList>

        {loading && (
          <div className="text-muted-foreground flex items-center gap-2 py-8 text-sm">
            <Spinner />
            검색 중...
          </div>
        )}

        {!loading && (
          <>
            <TabsContent value="artists">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {artists.map((a) => (
                  <ArtistCard key={a.id} artist={a} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="albums">
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5">
                {albums.map((a) => (
                  <AlbumCard key={a.id} album={a} />
                ))}
              </div>
            </TabsContent>

            <TabsContent value="tracks">
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
            </TabsContent>
          </>
        )}
      </Tabs>

      {isEmpty && (
        <Empty className="border">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <SearchIcon />
            </EmptyMedia>
            <EmptyTitle>검색 결과가 없습니다</EmptyTitle>
            <EmptyDescription>다른 키워드로 검색해보세요.</EmptyDescription>
          </EmptyHeader>
        </Empty>
      )}
    </div>
  );
}

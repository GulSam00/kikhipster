'use client';

import { SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
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

/** 어떤 검색어의 결과인지 같이 들고 있어야 "아직 안 받아 온 것"과 "받았는데 0건"을 가를 수 있다. */
interface Done<T> {
  query: string;
  items: T[];
}

interface Results {
  artists?: Done<ArtistSummary>;
  albums?: Done<AlbumSummary>;
  tracks?: Done<TrackSearchItem>;
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [tab, setTab] = useState<Tab>('artists');
  const [results, setResults] = useState<Results>({});

  const debouncedQuery = useDebounce(query, 300);
  const q = debouncedQuery.trim();

  /*
    **로딩은 상태가 아니라 파생값이다.** 예전엔 effect 안에서 `setLoading(true)` 를 불러
    `react-hooks/set-state-in-effect` 에 걸렸다. 지금은 "현재 탭의 결과가 현재 검색어의 것이
    아니면 로딩 중"으로 계산하므로 effect 는 요청이 끝난 뒤에만 setState 한다.

    탭별로 결과를 따로 들고 있어서, 탭을 오갈 때 이미 받은 검색어의 결과는 다시 묻지 않는다.
    검색어가 바뀌면 `query` 가 어긋나므로 자동으로 다시 로딩된다.
  */
  const current = results[tab];
  const loading = !!q && current?.query !== q;
  const itemsOf = <T,>(done?: Done<T>): T[] => (q && done?.query === q ? done.items : []);
  const artists = itemsOf(results.artists);
  const albums = itemsOf(results.albums);
  const tracks = itemsOf(results.tracks);

  useEffect(() => {
    if (!q || results[tab]?.query === q) return;

    // 검색어·탭이 빨리 바뀌면 늦게 온 이전 응답이 최신 결과를 덮으면 안 된다.
    let cancelled = false;
    const done = (patch: Results) => {
      if (!cancelled) setResults((prev) => ({ ...prev, ...patch }));
    };
    const fail = () => {
      if (cancelled) return;
      toast.error('검색에 실패했습니다');
      // 실패해도 로딩은 멈춰야 하므로 빈 결과로 마감한다.
      setResults((prev) => ({ ...prev, [tab]: { query: q, items: [] } }));
    };

    if (tab === 'artists') {
      searchArtists(q).then((items) => done({ artists: { query: q, items } }), fail);
    } else if (tab === 'albums') {
      searchAlbums(q).then((items) => done({ albums: { query: q, items } }), fail);
    } else {
      searchTracks(q).then((items) => done({ tracks: { query: q, items } }), fail);
    }
    return () => {
      cancelled = true;
    };
    // `results` 는 "이미 받았나" 확인용으로만 읽는다 — 넣으면 결과가 들어올 때마다 다시 돈다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, tab]);

  const isEmpty = !loading && !!q && { artists, albums, tracks }[tab].length === 0;

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
                    /* 곡마다 앨범이 다르므로 켠다. 앨범 상세는 전곡이 같은 커버라 끈다. */
                    showCover
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

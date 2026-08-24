'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  Disc3,
  Music2,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { ItemFallbackIcon } from '@/components/music/PoolItemTile';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { albumToPoolItem, trackToPoolItem, type PoolItem } from '@/lib/pool-item';
import { cn } from '@/lib/utils';
import type { AlbumSummary, AlbumWithTracks, TrackSearchItem } from '@/types/music';
import type { TournamentDetail, TournamentItemType } from '@/types/tournament';

const MIN_POOL = 4;
const MAX_POOL = 512;

type Step = 'type' | 'meta' | 'pool';
/** 곡 월드컵에서는 곡으로도, 앨범을 펼쳐서도 담을 수 있다. */
type SearchMode = 'track' | 'album';

export default function NewTournamentPage() {
  const router = useRouter();

  const [step, setStep] = useState<Step>('type');
  const [itemType, setItemType] = useState<TournamentItemType>('track');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');

  const [searchMode, setSearchMode] = useState<SearchMode>('track');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [trackResults, setTrackResults] = useState<TrackSearchItem[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumSummary[]>([]);

  /** 펼쳐놓은 앨범의 수록곡 캐시. 같은 앨범을 다시 펼칠 때 재요청하지 않는다. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [albumTracks, setAlbumTracks] = useState<Record<string, TrackSearchItem[]>>({});

  const [pool, setPool] = useState<PoolItem[]>([]);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) router.push('/login');
  }, [router]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedQ(q.trim()), 300);
    return () => clearTimeout(t);
  }, [q]);

  // 앨범 월드컵이면 앨범 검색만 쓴다.
  const effectiveMode: SearchMode = itemType === 'album' ? 'album' : searchMode;

  useEffect(() => {
    // 검색어가 비면 결과를 state에서 지우는 대신 렌더 단계에서 걸러낸다.
    // effect 본문에서 동기 setState를 하면 연쇄 렌더가 생긴다.
    if (!debouncedQ) return;
    let alive = true;
    (async () => {
      try {
        if (effectiveMode === 'track') {
          const res = await apiFetch<{ items: TrackSearchItem[] }>(
            `/api/music/search/tracks?q=${encodeURIComponent(debouncedQ)}&limit=50`,
          );
          if (alive) setTrackResults(res.items);
        } else {
          const res = await apiFetch<{ items: AlbumSummary[] }>(
            `/api/music/search/albums?q=${encodeURIComponent(debouncedQ)}&limit=50`,
          );
          if (alive) setAlbumResults(res.items);
        }
      } catch {
        toast.error('검색에 실패했습니다');
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedQ, effectiveMode]);

  const inPool = (id: string) => pool.some((p) => p.id === id);

  // 검색어를 지우면 직전 결과가 남아 있으므로 렌더 시점에 비운다.
  const shownTracks = debouncedQ ? trackResults : [];
  const shownAlbums = debouncedQ ? albumResults : [];

  function addItems(items: PoolItem[]) {
    setPool((prev) => {
      const existing = new Set(prev.map((p) => p.id));
      const fresh = items.filter((i) => !existing.has(i.id));
      if (fresh.length === 0) return prev;

      const room = MAX_POOL - prev.length;
      if (room <= 0) {
        toast.error(`최대 ${MAX_POOL}개까지만 담을 수 있습니다`);
        return prev;
      }
      if (fresh.length > room) {
        toast.warning(`${room}개만 추가했습니다 (최대 ${MAX_POOL}개)`);
        return [...prev, ...fresh.slice(0, room)];
      }
      return [...prev, ...fresh];
    });
  }

  function toggleItem(item: PoolItem) {
    if (inPool(item.id)) {
      setPool((prev) => prev.filter((p) => p.id !== item.id));
    } else {
      addItems([item]);
    }
  }

  async function expandAlbum(album: AlbumSummary) {
    if (expanded === album.id) {
      setExpanded(null);
      return;
    }
    setExpanded(album.id);
    if (albumTracks[album.id]) return;

    try {
      const res = await apiFetch<AlbumWithTracks>(`/api/music/albums/${album.id}/tracks`);
      // 앨범 트랙 응답에는 커버가 없다 — 앨범 커버를 물려준다.
      const withCover: TrackSearchItem[] = res.tracks.map((t) => ({
        id: t.id,
        name: t.name,
        artists: t.artists.length > 0 ? t.artists : [album.artist_name],
        album: { id: album.id, name: album.title, cover_url: album.cover_url },
        duration_ms: t.duration_ms,
        popularity: 0,
        explicit: false,
        preview_url: t.preview_url,
      }));
      setAlbumTracks((prev) => ({ ...prev, [album.id]: withCover }));
    } catch {
      toast.error('앨범 수록곡을 불러오지 못했습니다');
      setExpanded(null);
    }
  }

  async function submit() {
    if (pool.length < MIN_POOL) return;
    setSubmitting(true);
    try {
      const created = await apiFetch<TournamentDetail>('/api/tournaments/', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          item_type: itemType,
          item_ids: pool.map((p) => p.id),
        }),
      });
      toast.success('월드컵을 만들었습니다');
      router.push(`/tournament/${created.id}`);
    } catch {
      toast.error('월드컵 생성에 실패했습니다');
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------- step 1
  if (step === 'type') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <StepHeader step={1} title="무엇으로 겨룰까요?" onBack={() => router.push('/tournament')} />

        <div className="grid grid-cols-2 gap-3">
          {(
            [
              { value: 'track', label: '곡', desc: '노래 하나하나로 대결', Icon: Music2 },
              { value: 'album', label: '앨범', desc: '앨범 단위로 대결', Icon: Disc3 },
            ] as const
          ).map(({ value, label, desc, Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setItemType(value);
                setPool([]);
                setStep('meta');
              }}
              className="rounded-xl text-left outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              <Card className="h-full transition-colors hover:bg-accent">
                <CardContent className="flex flex-col gap-1">
                  <Icon className="mb-1 size-6 text-muted-foreground" />
                  <p className="text-lg font-bold">{label}</p>
                  <p className="text-xs text-muted-foreground">{desc}</p>
                </CardContent>
              </Card>
            </button>
          ))}
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 2
  if (step === 'meta') {
    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <StepHeader step={2} title="월드컵 정보" onBack={() => setStep('type')} />

        <div className="mb-6 flex flex-col gap-4">
          <div className="grid gap-2">
            <Label htmlFor="wc-title">이름</Label>
            <Input
              id="wc-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={itemType === 'album' ? '내 인생 앨범 월드컵' : '내 최애곡 월드컵'}
              maxLength={100}
              className="h-10"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="wc-desc">설명</Label>
            <Textarea
              id="wc-desc"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="어떤 기준으로 모았는지 적어주세요 (선택)"
              maxLength={500}
              rows={4}
            />
            <p className="text-xs text-muted-foreground tabular-nums">{description.length}/500</p>
          </div>
        </div>

        <Button size="lg" className="h-11 w-full" disabled={!title.trim()} onClick={() => setStep('pool')}>
          다음
        </Button>
      </div>
    );
  }

  // ---------------------------------------------------------------- step 3
  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-8">
      <StepHeader
        step={3}
        title={`${itemType === 'album' ? '앨범' : '곡'} 담기`}
        onBack={() => setStep('meta')}
      />

      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground tabular-nums">
          {pool.length}개 담김 · 최소 {MIN_POOL} / 최대 {MAX_POOL}
        </p>
        {itemType === 'track' && (
          <Tabs value={searchMode} onValueChange={(v) => setSearchMode(v as SearchMode)}>
            <TabsList>
              <TabsTrigger value="track">곡 검색</TabsTrigger>
              <TabsTrigger value="album">앨범에서 찾기</TabsTrigger>
            </TabsList>
          </Tabs>
        )}
      </div>

      <div className="relative mb-3">
        <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={effectiveMode === 'album' ? '앨범 검색...' : '곡 검색...'}
          className="h-10 pl-9"
        />
      </div>

      {/* 곡 검색 결과 */}
      {effectiveMode === 'track' && shownTracks.length > 0 && (
        <ScrollArea className="mb-4 h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-1">
            {shownTracks.map((t) => (
              <ResultRow
                key={t.id}
                item={trackToPoolItem(t)}
                itemType="track"
                picked={inPool(t.id)}
                onToggle={() => toggleItem(trackToPoolItem(t))}
              />
            ))}
          </div>
        </ScrollArea>
      )}

      {/* 앨범 검색 결과 — 곡 모드에서는 펼쳐서 수록곡을 담는다 */}
      {effectiveMode === 'album' && shownAlbums.length > 0 && (
        <ScrollArea className="mb-4 h-72 rounded-lg border">
          <div className="flex flex-col gap-1 p-1">
            {shownAlbums.map((a) => {
              const item = albumToPoolItem(a);
              const isOpen = expanded === a.id;
              const tracks = albumTracks[a.id];

              return (
                <div key={a.id}>
                  {itemType === 'album' ? (
                    <ResultRow
                      item={item}
                      itemType="album"
                      picked={inPool(a.id)}
                      onToggle={() => toggleItem(item)}
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => expandAlbum(a)}
                      aria-expanded={isOpen}
                      className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
                    >
                      <Cover item={item} itemType="album" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm">{a.title}</span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {a.artist_name} · {a.total_tracks}곡
                        </span>
                      </span>
                      <ChevronDown
                        className={cn(
                          'size-4 shrink-0 text-muted-foreground transition-transform',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  )}

                  {itemType === 'track' && isOpen && (
                    <div className="mb-1 ml-4 border-l pl-2">
                      {!tracks ? (
                        <p className="py-3 text-center text-xs text-muted-foreground">
                          수록곡 불러오는 중...
                        </p>
                      ) : (
                        <>
                          <div className="flex justify-end p-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => addItems(tracks.map(trackToPoolItem))}
                            >
                              <Plus />
                              {tracks.length}곡 전체 추가
                            </Button>
                          </div>
                          {tracks.map((t) => (
                            <ResultRow
                              key={t.id}
                              item={trackToPoolItem(t)}
                              itemType="track"
                              picked={inPool(t.id)}
                              onToggle={() => toggleItem(trackToPoolItem(t))}
                            />
                          ))}
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
      )}

      {pool.length > 0 && (
        <>
          <Separator className="mb-3" />
          <p className="mb-2 text-sm font-medium">담긴 목록</p>
          <div className="mb-4 flex flex-wrap gap-1.5">
            {pool.map((p) => (
              <Badge
                key={p.id}
                variant="secondary"
                asChild
                className="max-w-52 cursor-pointer transition-colors hover:bg-destructive/20 hover:text-destructive"
              >
                <button type="button" onClick={() => toggleItem(p)}>
                  <span className="truncate">{p.title}</span>
                  <X className="size-3 shrink-0" />
                </button>
              </Badge>
            ))}
          </div>
        </>
      )}

      <Button
        size="lg"
        className="h-11 w-full"
        disabled={pool.length < MIN_POOL || submitting}
        onClick={submit}
      >
        {submitting
          ? '만드는 중...'
          : pool.length < MIN_POOL
            ? `${MIN_POOL - pool.length}개 더 담아주세요`
            : `${pool.length}개로 월드컵 만들기`}
      </Button>
    </div>
  );
}

function StepHeader({ step, title, onBack }: { step: number; title: string; onBack: () => void }) {
  return (
    <>
      <Button variant="ghost" size="sm" className="mb-3 -ml-2" onClick={onBack}>
        <ArrowLeft />
        이전
      </Button>
      <p className="mb-1 text-xs text-muted-foreground tabular-nums">{step} / 3</p>
      <h1 className="mb-6 font-heading text-2xl font-bold">{title}</h1>
    </>
  );
}

function Cover({ item, itemType }: { item: PoolItem; itemType: TournamentItemType }) {
  return (
    <span className="relative size-9 shrink-0 overflow-hidden rounded-md bg-muted">
      {item.coverUrl ? (
        <Image src={item.coverUrl} alt="" fill className="object-cover" />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ItemFallbackIcon itemType={itemType} className="size-4" />
        </span>
      )}
    </span>
  );
}

function ResultRow({
  item,
  itemType,
  picked,
  onToggle,
}: {
  item: PoolItem;
  itemType: TournamentItemType;
  picked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={picked}
      className={cn(
        'flex w-full items-center gap-2 rounded-md px-2 py-2 text-left transition-colors focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        picked ? 'bg-primary/15 ring-1 ring-primary ring-inset' : 'hover:bg-accent',
      )}
    >
      <Cover item={item} itemType={itemType} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm">{item.title}</span>
        <span className="block truncate text-xs text-muted-foreground">{item.subtitle}</span>
      </span>
      {picked ? (
        <Check className="size-4 shrink-0 text-primary" />
      ) : (
        <Plus className="size-4 shrink-0 text-muted-foreground" />
      )}
    </button>
  );
}

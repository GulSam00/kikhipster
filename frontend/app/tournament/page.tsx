'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Music2, Trophy, X } from 'lucide-react';
import { apiFetch } from '@/lib/api';
import TrackRow from '@/components/music/TrackRow';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { TrackSearchItem } from '@/types/music';
import type { Tournament, TournamentRound } from '@/types/tournament';

type Phase = 'setup' | 'playing' | 'done';
type Size = 8 | 16 | 32;

const SIZES: Size[] = [8, 16, 32];

export default function TournamentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [size, setSize] = useState<Size>(8);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<TrackSearchItem[]>([]);
  const [selected, setSelected] = useState<TrackSearchItem[]>([]);
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [currentRound, setCurrentRound] = useState<TournamentRound | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) router.push('/login');
  }, [router]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ items: TrackSearchItem[] }>(`/api/music/search/tracks?q=${encodeURIComponent(searchQ)}&limit=20`);
        setSearchResults(res.items);
      } catch { /* ignore */ }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  function toggleTrack(track: TrackSearchItem) {
    setSelected((prev) =>
      prev.find((t) => t.id === track.id)
        ? prev.filter((t) => t.id !== track.id)
        : prev.length < size ? [...prev, track] : prev
    );
  }

  async function startTournament() {
    if (selected.length !== size) return;
    setLoading(true);
    try {
      const t = await apiFetch<Tournament>('/api/tournaments/', {
        method: 'POST',
        body: JSON.stringify({ track_ids: selected.map((t) => t.id) }),
      });
      setTournament(t);
      const maxRound = Math.max(...t.rounds.map((r) => r.round_num));
      const firstMatch = t.rounds.find((r) => r.round_num === maxRound && r.match_num === 0) ?? null;
      setCurrentRound(firstMatch);
      setPhase('playing');
    } catch { /* ignore */ } finally {
      setLoading(false);
    }
  }

  async function vote(winnerId: string) {
    if (!tournament || !currentRound) return;
    try {
      const updated = await apiFetch<Tournament>(
        `/api/tournaments/${tournament.id}/rounds/${currentRound.id}/vote`,
        { method: 'POST', body: JSON.stringify({ winner_id: winnerId }) }
      );
      setTournament(updated);
      if (updated.status === 'completed') { setPhase('done'); return; }
      const nextMatch = updated.rounds.find((r) => !r.winner_id) ?? null;
      setCurrentRound(nextMatch);
    } catch { /* ignore */ }
  }

  const trackMap = Object.fromEntries(selected.map((t) => [t.id, t]));

  if (phase === 'setup') {
    return (
      <div className="mx-auto w-full max-w-4xl px-4 py-8">
        <h1 className="mb-6 font-heading text-2xl font-bold">노래 토너먼트</h1>

        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div className="grid gap-2">
            <Label>규모</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(size)}
              onValueChange={(v) => {
                if (!v) return;
                setSize(Number(v) as Size);
                setSelected([]);
              }}
            >
              {SIZES.map((s) => (
                <ToggleGroupItem key={s} value={String(s)}>
                  {s}강
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>
          <p className="text-sm text-muted-foreground tabular-nums">
            {selected.length}/{size} 선택
          </p>
        </div>

        <Input
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="곡 검색..."
          className="mb-3 h-10"
        />

        {searchResults.length > 0 && (
          <ScrollArea className="mb-4 h-64 rounded-lg border">
            <div className="flex flex-col gap-1 p-1">
              {searchResults.map((t) => {
                const picked = !!selected.find((s) => s.id === t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTrack(t)}
                    aria-pressed={picked}
                    className={cn(
                      'flex items-center gap-2 rounded-md px-3 py-2 text-left transition-colors',
                      picked ? 'bg-primary/15 ring-1 ring-primary ring-inset' : 'hover:bg-accent',
                    )}
                  >
                    <span className="flex-1 truncate text-sm">{t.name}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">{t.artists[0]}</span>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {selected.map((t) => (
              <Badge
                key={t.id}
                variant="secondary"
                asChild
                className="cursor-pointer transition-colors hover:bg-destructive/20 hover:text-destructive"
              >
                <button type="button" onClick={() => toggleTrack(t)}>
                  {t.name}
                  <X className="size-3" />
                </button>
              </Badge>
            ))}
          </div>
        )}

        <Button
          onClick={startTournament}
          disabled={selected.length !== size || loading}
          size="lg"
          className="h-11 w-full"
        >
          {loading ? '생성 중...' : `${size}강 토너먼트 시작`}
        </Button>
      </div>
    );
  }

  if (phase === 'playing' && currentRound) {
    const trackA = trackMap[currentRound.track_a_id];
    const trackB = trackMap[currentRound.track_b_id];
    const remaining = tournament!.rounds.filter((r) => !r.winner_id).length;

    return (
      <div className="mx-auto w-full max-w-2xl px-4 py-8">
        <p className="mb-2 text-center text-sm text-muted-foreground">남은 경기 {remaining}개</p>
        <h2 className="mb-8 text-center font-heading text-xl font-bold">어느 곡이 더 좋으신가요?</h2>

        <div className="grid grid-cols-2 gap-4">
          {[trackA, trackB].map((t) => t ? (
            <Card
              key={t.id}
              className="transition-colors hover:bg-accent has-focus-visible:ring-2 has-focus-visible:ring-ring"
            >
              <CardContent className="flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => vote(t.id)}
                  className="flex flex-col items-center gap-3 rounded-lg outline-none"
                >
                  <div className="relative size-24 overflow-hidden rounded-lg bg-muted">
                    {t.album.cover_url ? (
                      <Image src={t.album.cover_url} alt={t.name} fill className="object-cover" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-muted-foreground">
                        <Music2 className="size-6" />
                      </div>
                    )}
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">{t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.artists[0]}</p>
                  </div>
                </button>

                {t.preview_url && (
                  <div className="w-full">
                    <TrackRow
                      track={{ id: t.id, name: t.name, duration_ms: t.duration_ms, explicit: t.explicit, preview_url: t.preview_url }}
                      artist={t.artists[0]}
                      albumCover={t.album.cover_url}
                    />
                  </div>
                )}
              </CardContent>
            </Card>
          ) : null)}
        </div>
      </div>
    );
  }

  if (phase === 'done' && tournament) {
    const winner = trackMap[tournament.winner_track_id ?? ''];
    return (
      <div className="mx-auto w-full max-w-md px-4 py-16 text-center">
        <Trophy className="mx-auto mb-3 size-10 text-primary" />
        <p className="mb-2 text-sm text-primary">최종 우승</p>
        <h2 className="mb-1 font-heading text-2xl font-bold">{winner?.name ?? '알 수 없음'}</h2>
        <p className="mb-8 text-muted-foreground">{winner?.artists[0]}</p>
        <Button
          size="lg"
          className="h-11 rounded-full"
          onClick={() => { setPhase('setup'); setTournament(null); setSelected([]); }}
        >
          다시 하기
        </Button>
      </div>
    );
  }

  return null;
}

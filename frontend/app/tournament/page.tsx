'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api';
import type { TrackSearchItem } from '@/types/music';
import type { Tournament, TournamentRound } from '@/types/tournament';
import TrackRow from '@/components/music/TrackRow';

type Phase = 'setup' | 'playing' | 'done';

export default function TournamentPage() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('setup');
  const [size, setSize] = useState<8 | 16 | 32>(8);
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
      <div className="mx-auto max-w-4xl px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">노래 토너먼트</h1>
        <div className="flex gap-2 items-center mb-4">
          <span className="text-sm text-zinc-400">규모:</span>
          {([8, 16, 32] as const).map((s) => (
            <button key={s} onClick={() => { setSize(s); setSelected([]); }}
              className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${size === s ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}>
              {s}강
            </button>
          ))}
          <span className="ml-auto text-sm text-zinc-400">{selected.length}/{size} 선택</span>
        </div>
        <input value={searchQ} onChange={(e) => setSearchQ(e.target.value)}
          placeholder="곡 검색..."
          className="w-full px-4 py-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500 mb-3" />
        <div className="flex flex-col gap-1 max-h-64 overflow-y-auto mb-4">
          {searchResults.map((t) => (
            <button key={t.id} onClick={() => toggleTrack(t)}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${selected.find((s) => s.id === t.id) ? 'bg-violet-900/50 border border-violet-500' : 'bg-zinc-800 hover:bg-zinc-700'}`}>
              <span className="text-sm text-white truncate flex-1">{t.name}</span>
              <span className="text-xs text-zinc-400 shrink-0">{t.artists[0]}</span>
            </button>
          ))}
        </div>
        {selected.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1">
            {selected.map((t) => (
              <span key={t.id} onClick={() => toggleTrack(t)}
                className="px-2 py-0.5 rounded-full bg-violet-900/50 border border-violet-700 text-xs text-violet-300 cursor-pointer hover:bg-red-900/50 hover:border-red-700 hover:text-red-300 transition-colors">
                {t.name}
              </span>
            ))}
          </div>
        )}
        <button onClick={startTournament} disabled={selected.length !== size || loading}
          className="w-full py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-40 transition-colors">
          {loading ? '생성 중...' : `${size}강 토너먼트 시작`}
        </button>
      </div>
    );
  }

  if (phase === 'playing' && currentRound) {
    const trackA = trackMap[currentRound.track_a_id];
    const trackB = trackMap[currentRound.track_b_id];
    const remaining = tournament!.rounds.filter((r) => !r.winner_id).length;

    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <p className="text-center text-sm text-zinc-400 mb-2">남은 경기 {remaining}개</p>
        <h2 className="text-center text-xl font-bold text-white mb-8">어느 곡이 더 좋으신가요?</h2>
        <div className="grid grid-cols-2 gap-4">
          {[trackA, trackB].map((t) => t ? (
            <button key={t.id} onClick={() => vote(t.id)}
              className="flex flex-col items-center gap-3 p-6 rounded-2xl bg-zinc-900 hover:bg-violet-900/30 border border-transparent hover:border-violet-500 transition-all">
              <div className="w-24 h-24 rounded-lg bg-zinc-700 overflow-hidden">
                {t.album.cover_url && <img src={t.album.cover_url} alt={t.name} className="w-full h-full object-cover" />}
              </div>
              <div className="text-center">
                <p className="text-white font-medium text-sm">{t.name}</p>
                <p className="text-zinc-400 text-xs">{t.artists[0]}</p>
              </div>
              {t.preview_url && (
                <div onClick={(e) => e.stopPropagation()}>
                  <TrackRow
                    track={{ id: t.id, name: t.name, duration_ms: t.duration_ms, explicit: t.explicit, preview_url: t.preview_url }}
                    artist={t.artists[0]}
                    albumCover={t.album.cover_url}
                  />
                </div>
              )}
            </button>
          ) : null)}
        </div>
      </div>
    );
  }

  if (phase === 'done' && tournament) {
    const winner = trackMap[tournament.winner_track_id ?? ''];
    return (
      <div className="mx-auto max-w-md px-4 py-16 text-center">
        <p className="text-violet-400 text-sm mb-2">최종 우승</p>
        <h2 className="text-2xl font-bold text-white mb-1">{winner?.name ?? '알 수 없음'}</h2>
        <p className="text-zinc-400 mb-8">{winner?.artists[0]}</p>
        <button onClick={() => { setPhase('setup'); setTournament(null); setSelected([]); }}
          className="px-6 py-3 rounded-full bg-violet-600 text-white font-medium hover:bg-violet-500 transition-colors">
          다시 하기
        </button>
      </div>
    );
  }

  return null;
}

'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';

import { useRequireAuth } from '@/lib/hooks/use-require-auth';

import { getAlbumWithTracks, searchAlbums, searchTracks } from '@/lib/api/music';
import { TOURNAMENT_MAX_POOL, TOURNAMENT_MIN_POOL } from '@/lib/domain/limits';
import type { PoolItem } from '@/lib/domain/pool-item';

import type { AlbumSummary, TrackSearchItem } from '@/types/music';
import type { TournamentCreateBody, TournamentItemType } from '@/types/tournament';

export type Step = 'type' | 'meta' | 'pool';
/** 곡 월드컵에서는 곡으로도, 앨범을 펼쳐서도 담을 수 있다. */
export type SearchMode = 'track' | 'album';

/** 수정 화면이 기존 월드컵을 채워 넣을 때 쓰는 초기값. */
export interface TournamentDraftInitial {
  itemType: TournamentItemType;
  title: string;
  description: string;
  pool: PoolItem[];
}

interface Args {
  /** 없으면 새 월드컵. 있으면 그 값으로 시작하고 종류 선택 단계를 건너뛴다. */
  initial?: TournamentDraftInitial;
  onSubmit: (body: TournamentCreateBody) => Promise<void>;
}

export interface UseTournamentDraftResult {
  isEdit: boolean;
  totalSteps: number;
  step: Step;
  setStep: (step: Step) => void;
  /** 1단계 카드 선택 — 종류를 정하고 풀을 비운 뒤 다음 단계로 넘어간다. */
  selectItemType: (type: TournamentItemType) => void;

  itemType: TournamentItemType;
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;

  searchMode: SearchMode;
  setSearchMode: (v: SearchMode) => void;
  /** 앨범 월드컵이면 검색 모드를 무시하고 항상 앨범 검색이다. */
  effectiveMode: SearchMode;
  q: string;
  setQ: (v: string) => void;
  shownTracks: TrackSearchItem[];
  shownAlbums: AlbumSummary[];

  /** 펼쳐놓은 앨범 id. 그 앨범의 수록곡을 아래에 보여준다. */
  expanded: string | null;
  albumTracks: Record<string, TrackSearchItem[]>;
  expandAlbum: (album: AlbumSummary) => Promise<void>;

  pool: PoolItem[];
  inPool: (id: string) => boolean;
  addItems: (items: PoolItem[]) => void;
  toggleItem: (item: PoolItem) => void;

  submitting: boolean;
  submit: () => Promise<void>;
}

/**
 * 월드컵 만들기·수정 화면의 상태 로직. `TournamentEditor` 에서 UI를 남기고 여기로 뺐다
 * (2026-08-28, 575줄짜리 컴포넌트에 훅 호출 17개가 몰려 있던 것을 정리).
 *
 * **3단계 위저드의 단계 전환은 이 훅이 들고 있지만, "뒤로가기"가 어디로 갈지는 컴포넌트에
 * 남겨 뒀다** — 1단계의 '이전'은 `backHref`(페이지별 prop)로 라우팅해서 에디터를 완전히
 * 벗어나는데, 그건 이 훅이 몰라도 되는 페이지 차원의 일이다. `setStep` 을 그대로 반환해
 * 컴포넌트가 필요한 대로 조합한다.
 */
export function useTournamentDraft({ initial, onSubmit }: Args): UseTournamentDraftResult {
  useRequireAuth();

  const isEdit = initial !== undefined;
  const totalSteps = isEdit ? 2 : 3;

  const [step, setStep] = useState<Step>(isEdit ? 'meta' : 'type');
  const [itemType, setItemType] = useState<TournamentItemType>(initial?.itemType ?? 'track');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');

  const [searchMode, setSearchMode] = useState<SearchMode>('track');
  const [q, setQ] = useState('');
  const [debouncedQ, setDebouncedQ] = useState('');
  const [trackResults, setTrackResults] = useState<TrackSearchItem[]>([]);
  const [albumResults, setAlbumResults] = useState<AlbumSummary[]>([]);

  /** 펼쳐놓은 앨범의 수록곡 캐시. 같은 앨범을 다시 펼칠 때 재요청하지 않는다. */
  const [expanded, setExpanded] = useState<string | null>(null);
  const [albumTracks, setAlbumTracks] = useState<Record<string, TrackSearchItem[]>>({});

  const [pool, setPool] = useState<PoolItem[]>(initial?.pool ?? []);
  const [submitting, setSubmitting] = useState(false);

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
          const items = await searchTracks(debouncedQ, 50);
          if (alive) setTrackResults(items);
        } else {
          const items = await searchAlbums(debouncedQ, 50);
          if (alive) setAlbumResults(items);
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

      const room = TOURNAMENT_MAX_POOL - prev.length;
      if (room <= 0) {
        toast.error(`최대 ${TOURNAMENT_MAX_POOL}개까지만 담을 수 있습니다`);
        return prev;
      }
      if (fresh.length > room) {
        toast.warning(`${room}개만 추가했습니다 (최대 ${TOURNAMENT_MAX_POOL}개)`);
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
      const res = await getAlbumWithTracks(album.id);
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

  function selectItemType(type: TournamentItemType) {
    setItemType(type);
    setPool([]);
    setStep('meta');
  }

  async function submit() {
    if (pool.length < TOURNAMENT_MIN_POOL) return;
    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        item_type: itemType,
        item_ids: pool.map((p) => p.id),
      });
      // 성공하면 페이지가 이동시킨다. submitting 을 되돌리지 않는 건 이중 제출을 막기 위함.
    } catch {
      toast.error(isEdit ? '저장에 실패했습니다' : '월드컵 생성에 실패했습니다');
      setSubmitting(false);
    }
  }

  return {
    isEdit,
    totalSteps,
    step,
    setStep,
    selectItemType,
    itemType,
    title,
    setTitle,
    description,
    setDescription,
    searchMode,
    setSearchMode,
    effectiveMode,
    q,
    setQ,
    shownTracks,
    shownAlbums,
    expanded,
    albumTracks,
    expandAlbum,
    pool,
    inPool,
    addItems,
    toggleItem,
    submitting,
    submit,
  };
}

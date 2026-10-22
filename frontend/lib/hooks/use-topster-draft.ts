'use client';

import type { DropResult } from '@hello-pangea/dnd';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';

import { useRequireAuth } from '@/lib/hooks/use-require-auth';

import { searchAlbums } from '@/lib/api/music';
import { albumToPoolItem, type PoolItem } from '@/lib/domain/pool-item';
import { downloadTopsterImage } from '@/lib/render/topster-image';

import type { AlbumSummary } from '@/types/music';
import {
  DEFAULT_TOPSTER_OPTIONS,
  type TopsterCreateBody,
  type TopsterOptions,
} from '@/types/topster';

export interface GridItem {
  position: number;
  album: PoolItem | null;
}

/** 수정 화면이 기존 탑스터를 채워 넣을 때 쓰는 초기값. */
export interface TopsterDraftInitial {
  title: string;
  description: string;
  options: TopsterOptions;
  /** 인덱스가 곧 격자 position 이다. 빈 칸은 null. */
  placements: (PoolItem | null)[];
}

interface Args {
  /** 없으면 새 탑스터, 있으면 그 값으로 시작한다. */
  initial?: TopsterDraftInitial;
  onSubmit: (body: TopsterCreateBody) => Promise<void>;
}

const NEW_DEFAULTS: TopsterOptions = { ...DEFAULT_TOPSTER_OPTIONS, width: 3, height: 3 };

export interface UseTopsterDraftResult {
  title: string;
  setTitle: (v: string) => void;
  description: string;
  setDescription: (v: string) => void;
  options: TopsterOptions;
  setOption: <K extends keyof TopsterOptions>(key: K, value: TopsterOptions[K]) => void;

  cellCount: number;
  grid: GridItem[];
  /** 채워진 칸만 골라 저장 바디·이미지 렌더가 요구하는 모양으로 만든 배열. */
  placed: { album_spotify_id: string; position: number }[];
  /** 격자 셀 → 앨범. TopsterAlbumList·topster-image 가 요구하는 모양으로 이미 모아 뒀다. */
  albums: Map<string, PoolItem | null>;

  searchQ: string;
  setSearchQ: (v: string) => void;
  searchResults: AlbumSummary[];

  saving: boolean;
  downloading: boolean;
  error: string;

  placeAlbum: (album: AlbumSummary) => void;
  removeAlbum: (position: number) => void;
  onDragEnd: (result: DropResult) => void;
  handleDownload: () => Promise<void>;
  handleSave: () => Promise<void>;
}

/**
 * 탑스터 만들기·수정 화면의 상태 로직. `TopsterEditor` 에서 UI를 남기고 여기로 뺐다
 * (2026-08-28, 578줄짜리 컴포넌트에 훅 호출 15개가 몰려 있던 것을 정리).
 *
 * **`lib/hooks/use-topster-grid.ts` 와는 다른 훅이다** — 그쪽은 격자 셀 픽셀 크기를
 * 재는 순수 사이즈 계산(useBoxSize/computeCell)이고 상태가 없다. 이 훅은 title·options·
 * placements 같은 실제 편집 상태와 저장·다운로드 동작을 다룬다. 컴포넌트는 두 훅을
 * 함께 쓴다 — 사이즈 계산 결과(cellPx 등)로 격자를 그리고, 이 훅의 grid/placeAlbum 등으로
 * 내용을 채운다.
 */
export function useTopsterDraft({ initial, onSubmit }: Args): UseTopsterDraftResult {
  useRequireAuth();

  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [options, setOptions] = useState<TopsterOptions>(initial?.options ?? NEW_DEFAULTS);
  // 배치는 '칸 수'와 독립적으로 들고 있는다. 격자를 줄였다 늘려도 원래 앨범이 살아난다.
  const [placements, setPlacements] = useState<(PoolItem | null)[]>(initial?.placements ?? []);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<AlbumSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const cellCount = options.width * options.height;

  function setOption<K extends keyof TopsterOptions>(key: K, value: TopsterOptions[K]) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  // 격자는 상태가 아니라 파생값이다 — effect로 동기화하면 연쇄 렌더가 생긴다.
  // 격자를 줄이면 넘치는 배치는 화면에서 빠질 뿐 placements 에는 남는다.
  const grid: GridItem[] = useMemo(
    () =>
      Array.from({ length: cellCount }, (_, i) => ({ position: i, album: placements[i] ?? null })),
    [cellCount, placements],
  );

  useEffect(() => {
    const q = searchQ.trim();
    // setState는 전부 타이머 콜백 안에서만 일어난다 — effect 본문에서 동기로 부르면
    // 연쇄 렌더가 생긴다(프로젝트 eslint가 막는다).
    const t = setTimeout(async () => {
      if (!q) {
        setSearchResults([]);
        return;
      }
      try {
        setSearchResults(await searchAlbums(q, 10));
      } catch {
        toast.error('앨범 검색에 실패했습니다');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  const placed = useMemo(
    () =>
      grid
        .filter((g) => g.album)
        .map((g) => ({ album_spotify_id: g.album!.id, position: g.position })),
    [grid],
  );

  /** placements 를 최소 cellCount 길이로 맞춘 뒤 조작한다. */
  function updatePlacements(fn: (draft: (PoolItem | null)[]) => void) {
    setPlacements((prev) => {
      const next = Array.from(
        { length: Math.max(cellCount, prev.length) },
        (_, i) => prev[i] ?? null,
      );
      fn(next);
      return next;
    });
  }

  // 목록·다운로드는 TopsterAlbumList / topster-image 가 쓰는 PoolItem 모양을 요구한다.
  // 배치 자체를 PoolItem 으로 들고 있어 추가 조회 없이 그대로 모은다 — 수정 화면이
  // 기존 아이템을 `/api/music/albums?ids=` 로 받아 그대로 넣을 수 있는 것도 이 덕분이다.
  const albums = useMemo(() => {
    const m = new Map<string, PoolItem | null>();
    grid.forEach((g) => {
      if (g.album) m.set(g.album.id, g.album);
    });
    return m;
  }, [grid]);

  function placeAlbum(album: AlbumSummary) {
    if (placed.length >= cellCount) {
      toast.error('빈 칸이 없습니다. 옵션에서 격자를 넓혀보세요');
      return;
    }
    // 빈 칸은 반드시 **업데이터 안에서** 찾는다. 렌더 시점의 grid 로 찾으면 한 배치 안에서
    // 연속 클릭했을 때 전부 같은 칸을 가리켜 서로 덮어쓴다(실제로 재현됨).
    updatePlacements((d) => {
      const idx = d.findIndex((a, i) => i < cellCount && !a);
      if (idx !== -1) d[idx] = albumToPoolItem(album);
    });
  }

  function removeAlbum(position: number) {
    updatePlacements((d) => {
      d[position] = null;
    });
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    updatePlacements((d) => {
      [d[from], d[to]] = [d[to], d[from]];
    });
  }

  async function handleDownload() {
    setDownloading(true);
    try {
      await downloadTopsterImage({ options, title, items: placed, albums });
    } catch {
      toast.error('이미지를 만들지 못했습니다');
    } finally {
      setDownloading(false);
    }
  }

  async function handleSave() {
    if (!title.trim()) {
      setError('제목을 입력해주세요');
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSubmit({ title, description, ...options, items: placed });
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return {
    title,
    setTitle,
    description,
    setDescription,
    options,
    setOption,
    cellCount,
    grid,
    placed,
    albums,
    searchQ,
    setSearchQ,
    searchResults,
    saving,
    downloading,
    error,
    placeAlbum,
    removeAlbum,
    onDragEnd,
    handleDownload,
    handleSave,
  };
}

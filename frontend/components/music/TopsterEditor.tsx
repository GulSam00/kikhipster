'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Download, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import TopsterAlbumList from '@/components/music/TopsterAlbumList';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { albumToPoolItem, type PoolItem } from '@/lib/pool-item';
import { computeCell, gridOffsetTop, topsterGridStyle, useBoxSize } from '@/lib/topster-grid';
import { downloadTopsterImage } from '@/lib/topster-image';
import { cn } from '@/lib/utils';
import type { AlbumSummary } from '@/types/music';
import {
  DEFAULT_TOPSTER_OPTIONS,
  type TopsterCreateBody,
  type TopsterOptions,
} from '@/types/topster';

interface GridItem {
  position: number;
  album: PoolItem | null;
}

/** 수정 화면이 기존 탑스터를 채워 넣을 때 쓰는 초기값. */
export interface TopsterEditorInitial {
  title: string;
  description: string;
  isPublic: boolean;
  options: TopsterOptions;
  /** 인덱스가 곧 격자 position 이다. 빈 칸은 null. */
  placements: (PoolItem | null)[];
}

interface Props {
  heading: string;
  submitLabel: string;
  savingLabel: string;
  /** 없으면 새 탑스터, 있으면 그 값으로 시작한다. */
  initial?: TopsterEditorInitial;
  onSubmit: (body: TopsterCreateBody) => Promise<void>;
  /** 저장 버튼 줄에 덧붙일 동작 — 수정 화면의 '삭제' 같은 것. */
  extraActions?: ReactNode;
}

// 백엔드 schemas/topster.py 의 MIN_SIDE / MAX_SIDE / MAX_CELLS 와 같은 값이어야 한다.
const MIN_SIDE = 1;
const MAX_SIDE = 5;
const MAX_CELLS = 25;

const NEW_DEFAULTS: TopsterOptions = { ...DEFAULT_TOPSTER_OPTIONS, width: 3, height: 3 };

/**
 * 탑스터 만들기·수정 공용 에디터.
 *
 * `/topsters/new` 와 `/topsters/[id]/edit` 가 같은 화면을 쓴다. 저장 방식(POST/PUT)만
 * 달라서 `onSubmit` 으로 빼고 나머지는 통째로 공유한다 — 표시 옵션이 8종이라 화면을
 * 복제하면 옵션이 늘 때마다 두 곳을 고쳐야 한다.
 */
export default function TopsterEditor({
  heading,
  submitLabel,
  savingLabel,
  initial,
  onSubmit,
  extraActions,
}: Props) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [isPublic, setIsPublic] = useState(initial?.isPublic ?? true);
  const [options, setOptions] = useState<TopsterOptions>(initial?.options ?? NEW_DEFAULTS);
  // 배치는 '칸 수'와 독립적으로 들고 있는다. 격자를 줄였다 늘려도 원래 앨범이 살아난다.
  const [placements, setPlacements] = useState<(PoolItem | null)[]>(initial?.placements ?? []);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<AlbumSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');

  const cellCount = options.width * options.height;
  const [gridBoxRef, gridBox] = useBoxSize<HTMLDivElement>();
  const cellPx = computeCell(options.width, options.height, options.cell_gap, gridBox);
  const listOffsetTop = gridOffsetTop(options.height, options.cell_gap, cellPx, gridBox);

  function setOption<K extends keyof TopsterOptions>(key: K, value: TopsterOptions[K]) {
    setOptions((prev) => ({ ...prev, [key]: value }));
  }

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.push('/login');
    }
  }, [router]);

  // 격자는 상태가 아니라 파생값이다 — effect로 동기화하면 연쇄 렌더가 생긴다.
  // 격자를 줄이면 넘치는 배치는 화면에서 빠질 뿐 placements 에는 남는다.
  const grid: GridItem[] = useMemo(
    () => Array.from({ length: cellCount }, (_, i) => ({ position: i, album: placements[i] ?? null })),
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
        const res = await apiFetch<{ items: AlbumSummary[] }>(
          `/api/music/search/albums?q=${encodeURIComponent(q)}&limit=10`,
        );
        setSearchResults(res.items);
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
      const next = Array.from({ length: Math.max(cellCount, prev.length) }, (_, i) => prev[i] ?? null);
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
    updatePlacements((d) => { d[position] = null; });
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    updatePlacements((d) => { [d[from], d[to]] = [d[to], d[from]]; });
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
      await onSubmit({ title, description, is_public: isPublic, ...options, items: placed });
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    // layout 의 main 이 "헤더를 뺀 높이"를 definite 하게 주므로 h-full 로 그대로 받는다.
    // 페이지 자체는 스크롤하지 않고 사이드바/미리보기 안에서만 스크롤한다.
    <div className="mx-auto flex h-full w-full max-w-6xl flex-col overflow-hidden px-4 py-6">
      {/* 페이지 제목과 본문을 구분선으로 가른다. */}
      <h1 className="mb-4 shrink-0 border-b pb-3 font-heading text-2xl font-bold">{heading}</h1>

      <div className="grid min-h-0 flex-1 gap-8 lg:grid-cols-[320px_minmax(0,1fr)]">
        {/*
          좌측 사이드바 — topsters.org처럼 '추가'와 '옵션'을 탭으로 가른다.
          화면 높이를 채우고 내부만 스크롤한다. 미리보기가 길어져도 옵션이 같이
          밀려 올라가지 않아야 만지면서 결과를 볼 수 있다.
        */}
        <div className="flex min-h-0 flex-col gap-4">
          <Tabs defaultValue="add" className="flex min-h-0 flex-1 flex-col">
            <TabsList className="w-full">
              <TabsTrigger value="add" className="flex-1">
                앨범 추가
              </TabsTrigger>
              <TabsTrigger value="options" className="flex-1">
                옵션
              </TabsTrigger>
            </TabsList>

            <TabsContent value="add" className="mt-4 flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
              <Label htmlFor="album-search">앨범 검색</Label>
              <Input
                id="album-search"
                value={searchQ}
                onChange={(e) => setSearchQ(e.target.value)}
                placeholder="앨범 이름을 입력하세요"
                className="h-10"
              />
              {searchResults.length > 0 ? (
                <ScrollArea className="min-h-0 flex-1 rounded-lg border">
                  <div className="flex flex-col gap-1 p-1">
                    {searchResults.map((a) => (
                      <button
                        key={a.id}
                        type="button"
                        onClick={() => placeAlbum(a)}
                        className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left outline-none transition-colors hover:bg-accent focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {a.cover_url ? (
                          <Image
                            src={a.cover_url}
                            alt={a.title}
                            width={32}
                            height={32}
                            className="size-8 rounded object-cover"
                          />
                        ) : (
                          <div className="size-8 shrink-0 rounded bg-muted" />
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm">{a.title}</p>
                          <p className="truncate text-xs text-muted-foreground">{a.artist_name}</p>
                        </div>
                      </button>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-xs text-muted-foreground">
                  검색해서 고른 앨범이 격자의 빈 칸에 차례로 들어갑니다. 칸을 드래그해 순서를
                  바꾸고, 클릭하면 비웁니다.
                </p>
              )}
            </TabsContent>

            <TabsContent value="options" className="mt-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto pr-1">
              <div className="grid gap-2">
                <Label htmlFor="topster-title">제목</Label>
                <Input
                  id="topster-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="예: 2026 상반기 베스트"
                  className="h-10"
                  aria-invalid={!!error && !title.trim()}
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="topster-description">설명 (선택)</Label>
                <Textarea
                  id="topster-description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="이 차트에 대한 한마디"
                  rows={2}
                  className="resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="opt-width">가로 칸</Label>
                  <Input
                    id="opt-width"
                    type="number"
                    min={MIN_SIDE}
                    max={MAX_SIDE}
                    value={options.width}
                    onChange={(e) => setOption('width', clampSide(e.target.value, options.height))}
                    className="h-10"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="opt-height">세로 칸</Label>
                  <Input
                    id="opt-height"
                    type="number"
                    min={MIN_SIDE}
                    max={MAX_SIDE}
                    value={options.height}
                    onChange={(e) => setOption('height', clampSide(e.target.value, options.width))}
                    className="h-10"
                  />
                </div>
              </div>
              <p className="-mt-2 text-xs text-muted-foreground">
                {options.width}×{options.height} = {cellCount}칸 (최대 {MAX_CELLS}칸)
              </p>

              <div className="grid gap-2">
                <Label htmlFor="opt-gap">칸 간격 {options.cell_gap}px</Label>
                <Input
                  id="opt-gap"
                  type="range"
                  min={0}
                  max={40}
                  value={options.cell_gap}
                  onChange={(e) => setOption('cell_gap', Number(e.target.value))}
                  className="h-10 p-0"
                />
              </div>

              <ColorField
                id="opt-bg"
                label="배경색"
                value={options.background_color}
                onChange={(v) => setOption('background_color', v)}
                placeholder="#18181b"
              />

              <ColorField
                id="opt-text"
                label="글자색"
                value={options.text_color}
                onChange={(v) => setOption('text_color', v)}
                placeholder="#ffffff"
              />

              <div className="flex flex-col gap-2">
                <OptionToggle
                  id="opt-show-title"
                  label="제목 표시"
                  checked={options.show_title}
                  onChange={(v) => setOption('show_title', v)}
                />
                <OptionToggle
                  id="opt-show-info"
                  label="앨범 정보 표시"
                  checked={options.show_album_info}
                  onChange={(v) => setOption('show_album_info', v)}
                />
                <OptionToggle
                  id="opt-show-num"
                  label="넘버링 표시"
                  checked={options.show_numbering}
                  onChange={(v) => setOption('show_numbering', v)}
                />
                <OptionToggle
                  id="topster-public"
                  label="공개"
                  checked={isPublic}
                  onChange={setIsPublic}
                />
              </div>
            </TabsContent>
          </Tabs>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2">
            <Button onClick={handleSave} disabled={saving} size="lg" className="h-11 flex-1">
              {saving ? savingLabel : submitLabel}
            </Button>
            {/* 저장 전에도 동작한다 — 화면 상태만으로 캔버스에 그리기 때문이다. */}
            <Button
              onClick={handleDownload}
              disabled={downloading || placed.length === 0}
              variant="secondary"
              size="lg"
              className="h-11"
            >
              <Download />
              {downloading ? '만드는 중...' : '이미지'}
            </Button>
            {extraActions}
          </div>
        </div>

        {/*
          미리보기 — 옵션이 실시간 반영된다. 남은 영역을 꽉 채우되(화면을 벗어나지 않는
          최대 크기) 안에서 넘치지 않는다.
        */}
        <div
          className="flex min-h-0 min-w-0 flex-col overflow-hidden rounded-xl p-3 sm:p-4"
          style={{ backgroundColor: options.background_color, color: options.text_color }}
        >
          {options.show_title && title.trim() !== '' && (
            <p className="mb-3 shrink-0 truncate text-center text-lg font-bold">{title}</p>
          )}

          <div className="flex min-h-0 min-w-0 flex-1 flex-col gap-4 lg:flex-row">
            {/*
              격자는 TopsterGridBox 와 같은 규칙으로 그린다 — 바깥은 정사각형으로 못 박고
              트랙 안에 다시 정사각형 칸을 넣어, 칸 수가 늘어도 전체 크기가 안 변한다.
              드래그 재배치 때문에 Droppable/Draggable 이 필요해 컴포넌트를 그대로 쓰진 못한다.
            */}
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="grid" direction="horizontal">
                {(provided) => (
                  <div ref={gridBoxRef} className="flex min-h-0 min-w-0 flex-1 items-center justify-center">
                    <div
                      ref={provided.innerRef}
                      {...provided.droppableProps}
                      style={topsterGridStyle(options.width, options.height, options.cell_gap, cellPx)}
                    >
                      {grid.map((cell, idx) => (
                        <Draggable key={`cell-${idx}`} draggableId={`cell-${idx}`} index={idx}>
                          {(drag) => (
                            <div
                              ref={drag.innerRef}
                              {...drag.draggableProps}
                              {...drag.dragHandleProps}
                            >
                              <div
                                onClick={() => cell.album && removeAlbum(cell.position)}
                                className={cn(
                                  'group relative size-full cursor-pointer overflow-hidden bg-white/5',
                                  !cell.album && 'ring-1 ring-white/10 ring-inset',
                                )}
                              >
                                {cell.album?.coverUrl ? (
                                  <Image
                                    src={cell.album.coverUrl}
                                    alt={cell.album.title}
                                    fill
                                    sizes="160px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex size-full items-center justify-center text-white/30">
                                    <Plus className="size-4" />
                                  </div>
                                )}
                                {options.show_numbering && cell.album && (
                                  <span className="absolute top-0 left-0 bg-black/70 px-1 text-[10px] font-medium text-white tabular-nums">
                                    {idx + 1}
                                  </span>
                                )}
                                {cell.album && (
                                  <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                    <X className="size-3" />
                                    제거
                                  </div>
                                )}
                              </div>
                            </div>
                          )}
                        </Draggable>
                      ))}
                      {provided.placeholder}
                    </div>
                  </div>
                )}
              </Droppable>
            </DragDropContext>

            {options.show_album_info && (
              <TopsterAlbumList
                width={options.width}
                height={options.height}
                items={placed}
                albums={albums}
                cell={cellPx}
                gap={options.cell_gap}
                color={options.text_color}
                offsetTop={listOffsetTop}
                linkItems={false}
                showNumbering={options.show_numbering}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

/** 칸 수는 MIN_SIDE~MAX_SIDE 이고 전체 칸이 MAX_CELLS 를 넘지 않아야 한다 — 백엔드와 같은 규칙. */
function clampSide(raw: string, other: number): number {
  const n = Math.round(Number(raw));
  if (!Number.isFinite(n)) return MIN_SIDE;
  const capped = Math.min(MAX_SIDE, Math.max(MIN_SIDE, n));
  return Math.min(capped, Math.max(MIN_SIDE, Math.floor(MAX_CELLS / Math.max(other, 1))));
}

function OptionToggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    // 다른 옵션 컨트롤이 h-10 이라 체크박스만 작아 보였다 — 크기와 히트 영역을 맞춘다.
    <Label
      htmlFor={id}
      className="flex h-9 cursor-pointer items-center gap-2.5 rounded-lg text-sm font-normal text-muted-foreground transition-colors hover:text-foreground"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(v) => onChange(v === true)}
        className="size-5"
      />
      {label}
    </Label>
  );
}

/** 컬러 피커 + hex 입력 한 쌍. 배경색·글자색이 같은 모양이라 묶었다. */
function ColorField({
  id,
  label,
  value,
  onChange,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
}) {
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <Input
          id={id}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-10 w-16 p-1"
        />
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="h-10"
          aria-label={`${label} hex 값`}
        />
      </div>
    </div>
  );
}

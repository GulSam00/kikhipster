'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import type { AlbumSummary } from '@/types/music';

interface GridItem {
  position: number;
  album: AlbumSummary | null;
}

const GRID_SIZES = [3, 4, 5];

export default function NewTopsterPage() {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [gridSize, setGridSize] = useState(3);
  const [isPublic, setIsPublic] = useState(true);
  const [grid, setGrid] = useState<GridItem[]>([]);
  const [searchQ, setSearchQ] = useState('');
  const [searchResults, setSearchResults] = useState<AlbumSummary[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!localStorage.getItem('access_token')) {
      router.push('/login');
    }
  }, [router]);

  useEffect(() => {
    setGrid(Array.from({ length: gridSize * gridSize }, (_, i) => ({ position: i, album: null })));
  }, [gridSize]);

  useEffect(() => {
    if (!searchQ.trim()) { setSearchResults([]); return; }
    const t = setTimeout(async () => {
      try {
        const res = await apiFetch<{ items: AlbumSummary[] }>(`/api/music/search/albums?q=${encodeURIComponent(searchQ)}&limit=10`);
        setSearchResults(res.items);
      } catch {
        toast.error('앨범 검색에 실패했습니다');
      }
    }, 300);
    return () => clearTimeout(t);
  }, [searchQ]);

  function placeAlbum(album: AlbumSummary) {
    const emptyIdx = grid.findIndex((g) => !g.album);
    if (emptyIdx === -1) return;
    setGrid((prev) => prev.map((g) => g.position === emptyIdx ? { ...g, album } : g));
  }

  function removeAlbum(position: number) {
    setGrid((prev) => prev.map((g) => g.position === position ? { ...g, album: null } : g));
  }

  function onDragEnd(result: DropResult) {
    if (!result.destination) return;
    const from = result.source.index;
    const to = result.destination.index;
    setGrid((prev) => {
      const next = [...prev];
      [next[from], next[to]] = [next[to], next[from]];
      return next.map((g, i) => ({ ...g, position: i }));
    });
  }

  async function handleSave() {
    if (!title.trim()) { setError('제목을 입력해주세요'); return; }
    setSaving(true);
    setError('');
    try {
      const items = grid
        .filter((g) => g.album)
        .map((g) => ({ album_spotify_id: g.album!.id, position: g.position }));
      const res = await apiFetch<{ id: string }>('/api/topsters/', {
        method: 'POST',
        body: JSON.stringify({ title, description, grid_size: gridSize, is_public: isPublic, items }),
      });
      router.push(`/topsters/${res.id}`);
    } catch {
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <h1 className="mb-6 font-heading text-2xl font-bold">새 탑스터</h1>

      <div className="grid gap-8 lg:grid-cols-2">
        <div className="flex flex-col gap-4">
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

          <div className="grid gap-2">
            <Label>격자 크기</Label>
            <ToggleGroup
              type="single"
              variant="outline"
              value={String(gridSize)}
              onValueChange={(v) => v && setGridSize(Number(v))}
            >
              {GRID_SIZES.map((s) => (
                <ToggleGroupItem key={s} value={String(s)} aria-label={`${s}×${s} 격자`}>
                  {s}×{s}
                </ToggleGroupItem>
              ))}
            </ToggleGroup>
          </div>

          <div className="flex items-center gap-2">
            <Checkbox
              id="topster-public"
              checked={isPublic}
              onCheckedChange={(v) => setIsPublic(v === true)}
            />
            <Label htmlFor="topster-public" className="font-normal text-muted-foreground">
              공개
            </Label>
          </div>

          <div className="grid gap-2">
            <Label htmlFor="album-search">앨범 검색</Label>
            <Input
              id="album-search"
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="앨범 이름을 입력하세요"
              className="h-10"
            />
            {searchResults.length > 0 && (
              <ScrollArea className="h-48 rounded-lg border">
                <div className="flex flex-col gap-1 p-1">
                  {searchResults.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => placeAlbum(a)}
                      className="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
                    >
                      {a.cover_url ? (
                        <Image src={a.cover_url} alt={a.name} width={32} height={32} className="size-8 rounded object-cover" />
                      ) : (
                        <div className="size-8 shrink-0 rounded bg-muted" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm">{a.name}</p>
                        <p className="truncate text-xs text-muted-foreground">{a.artist_name}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </ScrollArea>
            )}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button onClick={handleSave} disabled={saving} size="lg" className="h-11 w-full">
            {saving ? '저장 중...' : '탑스터 저장'}
          </Button>
        </div>

        <Card className="self-start">
          <CardContent>
            <DragDropContext onDragEnd={onDragEnd}>
              <Droppable droppableId="grid" direction="horizontal">
                {(provided) => (
                  <div
                    ref={provided.innerRef}
                    {...provided.droppableProps}
                    className="grid gap-1"
                    style={{ gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))` }}
                  >
                    {grid.map((cell, idx) => (
                      <Draggable key={`cell-${idx}`} draggableId={`cell-${idx}`} index={idx}>
                        {(drag) => (
                          <div
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            {...drag.dragHandleProps}
                            onClick={() => cell.album && removeAlbum(cell.position)}
                            className={cn(
                              'group relative aspect-square cursor-pointer overflow-hidden rounded-md bg-muted',
                              !cell.album && 'ring-1 ring-border ring-inset',
                            )}
                          >
                            {cell.album?.cover_url ? (
                              <Image src={cell.album.cover_url} alt={cell.album.name} fill className="object-cover" />
                            ) : (
                              <div className="flex size-full items-center justify-center text-muted-foreground">
                                <Plus className="size-4" />
                              </div>
                            )}
                            {cell.album && (
                              <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/60 text-xs text-white opacity-0 transition-opacity group-hover:opacity-100">
                                <X className="size-3" />
                                제거
                              </div>
                            )}
                          </div>
                        )}
                      </Draggable>
                    ))}
                    {provided.placeholder}
                  </div>
                )}
              </Droppable>
            </DragDropContext>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

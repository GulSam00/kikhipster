'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { DragDropContext, Droppable, Draggable, DropResult } from '@hello-pangea/dnd';
import { apiFetch } from '@/lib/api';
import type { AlbumSummary } from '@/types/music';

interface GridItem {
  position: number;
  album: AlbumSummary | null;
}

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
      } catch { /* ignore */ }
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
    <div className="mx-auto max-w-6xl px-4 py-8">
      <h1 className="text-2xl font-bold text-white mb-6">새 탑스터</h1>

      <div className="grid lg:grid-cols-2 gap-8">
        <div className="flex flex-col gap-4">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="제목"
            className="w-full px-4 py-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="설명 (선택)"
            rows={2}
            className="w-full px-4 py-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500 resize-none"
          />
          <div className="flex gap-2 items-center">
            <span className="text-sm text-zinc-400">격자 크기:</span>
            {[3, 4, 5].map((s) => (
              <button
                key={s}
                onClick={() => setGridSize(s)}
                className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors ${gridSize === s ? 'bg-violet-600 text-white' : 'bg-zinc-800 text-zinc-400 hover:text-white'}`}
              >
                {s}×{s}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-2 text-sm text-zinc-400 cursor-pointer">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} className="accent-violet-500" />
            공개
          </label>
          <div>
            <input
              value={searchQ}
              onChange={(e) => setSearchQ(e.target.value)}
              placeholder="앨범 검색..."
              className="w-full px-4 py-2 rounded-lg bg-zinc-800 text-white placeholder-zinc-500 outline-none focus:ring-2 focus:ring-violet-500 mb-2"
            />
            <div className="flex flex-col gap-1 max-h-48 overflow-y-auto">
              {searchResults.map((a) => (
                <button
                  key={a.id}
                  onClick={() => placeAlbum(a)}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-left transition-colors"
                >
                  {a.cover_url && (
                    <Image src={a.cover_url} alt={a.name} width={32} height={32} className="rounded" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm text-white truncate">{a.name}</p>
                    <p className="text-xs text-zinc-400 truncate">{a.artist_name}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={handleSave}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-violet-600 text-white font-medium hover:bg-violet-500 disabled:opacity-50 transition-colors"
          >
            {saving ? '저장 중...' : '탑스터 저장'}
          </button>
        </div>

        <DragDropContext onDragEnd={onDragEnd}>
          <Droppable droppableId="grid" direction="horizontal">
            {(provided) => (
              <div
                ref={provided.innerRef}
                {...provided.droppableProps}
                className="grid gap-1 self-start"
                style={{ gridTemplateColumns: `repeat(${gridSize}, 1fr)` }}
              >
                {grid.map((cell, idx) => (
                  <Draggable key={`cell-${idx}`} draggableId={`cell-${idx}`} index={idx}>
                    {(drag) => (
                      <div
                        ref={drag.innerRef}
                        {...drag.draggableProps}
                        {...drag.dragHandleProps}
                        onClick={() => cell.album && removeAlbum(cell.position)}
                        className="aspect-square rounded bg-zinc-800 relative overflow-hidden cursor-pointer group"
                      >
                        {cell.album?.cover_url ? (
                          <Image src={cell.album.cover_url} alt={cell.album.name} fill className="object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-zinc-600 text-xs">+</div>
                        )}
                        {cell.album && (
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center text-white text-xs transition-opacity">
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
      </div>
    </div>
  );
}

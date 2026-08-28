'use client';

import { DragDropContext, Draggable, Droppable, type DropResult } from '@hello-pangea/dnd';
import { ChevronDown, GripVertical, Music2, Volume2, X } from 'lucide-react';
import CoverImage from '@/components/common/CoverImage';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { usePlayer } from '@/contexts/PlayerContext';

/**
 * 재생기 위로 펼쳐지는 재생목록.
 *
 * 순서 바꾸기는 탑스터 편집기와 같은 `@hello-pangea/dnd` 를 쓴다 — 같은 앱에서 끌어
 * 옮기는 동작이 두 가지 조작계면 곤란하다. 대신 **드래그는 손잡이(⠿)에서만** 시작한다.
 * 행 전체를 드래그 가능하게 하면 "눌러서 그 곡으로 이동"과 충돌한다.
 *
 * 목록은 radix `ScrollArea` 대신 평범한 `overflow-y-auto` 를 쓴다. dnd 라이브러리가
 * 자동 스크롤을 하려면 스크롤 컨테이너를 직접 찾아야 하는데, `ScrollArea` 는 뷰포트를
 * 한 겹 더 감싸서 그 탐색이 어긋난다.
 */
export default function PlayerQueue() {
  const { queue, currentIndex, isPlaying, playAt, removeAt, move, clear, setQueueOpen } =
    usePlayer();

  const onDragEnd = (result: DropResult) => {
    if (!result.destination) return;
    move(result.source.index, result.destination.index);
  };

  return (
    <div className="border-b">
      <div className="mx-auto flex h-80 max-w-6xl flex-col px-4 py-3 sm:h-96">
        <div className="mb-2 flex items-center gap-2">
          <p className="flex-1 text-sm font-medium tabular-nums">재생목록 {queue.length}곡</p>
          <Button variant="ghost" size="sm" onClick={clear}>
            전체 비우기
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={() => setQueueOpen(false)}
            aria-label="재생목록 접기"
          >
            <ChevronDown />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <DragDropContext onDragEnd={onDragEnd}>
            <Droppable droppableId="player-queue">
              {(drop) => (
                <ul ref={drop.innerRef} {...drop.droppableProps} className="flex flex-col">
                  {queue.map((track, index) => {
                    const isCurrent = index === currentIndex;
                    return (
                      <Draggable key={track.id} draggableId={track.id} index={index}>
                        {(drag, snapshot) => (
                          <li
                            ref={drag.innerRef}
                            {...drag.draggableProps}
                            className={cn(
                              'flex items-center gap-2 rounded-md pr-1',
                              // 재생 중인 행은 색이 아니라 밝기 단계로 구분한다 —
                              // 색 예산은 아래 재생 바(재생 버튼·슬라이더)가 이미 다 쓴다.
                              isCurrent && 'bg-accent',
                              snapshot.isDragging && 'bg-accent shadow-lg',
                            )}
                          >
                            <span
                              {...drag.dragHandleProps}
                              className="flex size-8 shrink-0 cursor-grab items-center justify-center text-muted-foreground active:cursor-grabbing"
                              aria-label={`${track.name} 순서 바꾸기`}
                            >
                              <GripVertical className="size-4" />
                            </span>

                            <button
                              type="button"
                              onClick={() => playAt(index)}
                              className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-md py-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring"
                            >
                              <span className="w-5 shrink-0 text-center text-xs text-muted-foreground tabular-nums">
                                {isCurrent && isPlaying ? (
                                  <Volume2 className="mx-auto size-3.5" />
                                ) : (
                                  index + 1
                                )}
                              </span>
                              <CoverImage
                                src={track.albumCover}
                                alt={track.name}
                                fallback={<Music2 className="size-4" />}
                                className="size-9 shrink-0 rounded-md"
                                sizes="36px"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="block truncate text-sm">{track.name}</span>
                                <span className="block truncate text-xs text-muted-foreground">
                                  {track.artist}
                                </span>
                              </span>
                            </button>

                            <Button
                              variant="ghost"
                              size="icon-sm"
                              className="shrink-0 text-muted-foreground hover:text-foreground"
                              onClick={() => removeAt(index)}
                              aria-label={`${track.name} 재생목록에서 빼기`}
                            >
                              <X />
                            </Button>
                          </li>
                        )}
                      </Draggable>
                    );
                  })}
                  {drop.placeholder}
                </ul>
              )}
            </Droppable>
          </DragDropContext>
        </div>
      </div>
    </div>
  );
}

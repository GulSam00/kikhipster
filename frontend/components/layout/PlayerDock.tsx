'use client';

import Image from 'next/image';
import { ListMusic, Music2, Pause, Play, SkipBack, SkipForward, X } from 'lucide-react';
import PlayerQueue from '@/components/layout/PlayerQueue';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { usePlayer } from '@/contexts/PlayerContext';

/** 초를 `m:ss` 로. 미리듣기는 30초라 시(hour) 자리는 없다. */
function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const s = Math.floor(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/**
 * 화면 맨 아래 재생기. **fixed 가 아니라 레이아웃 흐름 안에 있다.**
 *
 * 예전 `MiniPlayer` 는 `fixed` 라 열려 있는 동안 본문 아래쪽을 가렸다. 재생목록까지
 * 얹히면서 가리는 높이가 커져서, `body` 의 세로 flex 에 그냥 끼워 넣는 쪽으로 바꿨다 —
 * `main` 이 그만큼 줄어들 뿐 무엇도 가려지지 않는다.
 *
 * 곡이 없을 때도 껍데기는 렌더한다. 모바일 하단 탭바(`Navbar` 의 `fixed bottom-0`)가
 * 가릴 자리를 이 `pb-16` 이 맡기 때문이다 — 예전에 `main` 이 들고 있던 여백이다.
 */
export default function PlayerDock() {
  const {
    queue,
    currentTrack,
    isPlaying,
    position,
    duration,
    queueOpen,
    setQueueOpen,
    toggle,
    next,
    prev,
    seek,
    clear,
  } = usePlayer();

  return (
    <div className="shrink-0 pb-16 sm:pb-0">
      {currentTrack && (
        <div className="border-t bg-card">
          {queueOpen && <PlayerQueue />}

          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3">
            <div className="flex items-center gap-3">
              {currentTrack.albumCover ? (
                <Image
                  src={currentTrack.albumCover}
                  alt={currentTrack.name}
                  width={48}
                  height={48}
                  className="size-12 shrink-0 rounded-md object-cover"
                />
              ) : (
                <div className="flex size-12 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <Music2 className="size-5" />
                </div>
              )}

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{currentTrack.name}</p>
                <p className="truncate text-xs text-muted-foreground">{currentTrack.artist}</p>
              </div>

              <Button
                variant="ghost"
                className="size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground"
                onClick={() => setQueueOpen(!queueOpen)}
                aria-expanded={queueOpen}
                aria-label={queueOpen ? '재생목록 접기' : '재생목록 펼치기'}
              >
                <ListMusic />
                <span className="text-xs tabular-nums">{queue.length}</span>
              </Button>

              {/* 모바일에서는 컨트롤에 자리를 몰아준다 — 비우기는 재생목록 안에도 있다. */}
              <Button
                variant="ghost"
                className="hidden size-10 shrink-0 rounded-full text-muted-foreground hover:text-foreground sm:flex"
                onClick={clear}
                aria-label="재생기 닫기"
              >
                <X />
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                className="size-10 shrink-0 rounded-full"
                onClick={prev}
                aria-label="이전 곡"
              >
                <SkipBack />
              </Button>
              {/*
                이 줄에서 primary 로 칠하는 것은 재생 버튼 하나뿐이다. 슬라이더의 진행
                구간도 primary 라 화면당 2개 — DESIGN.md § Color budget 의 WARN 선(2개)에
                딱 걸치는 값이라 여기서 더 늘리지 않는다.
              */}
              <Button
                className="size-11 shrink-0 rounded-full"
                onClick={toggle}
                aria-label={isPlaying ? '일시정지' : '재생'}
              >
                {isPlaying ? <Pause /> : <Play />}
              </Button>
              <Button
                variant="ghost"
                className="size-10 shrink-0 rounded-full"
                onClick={next}
                aria-label="다음 곡"
              >
                <SkipForward />
              </Button>

              <span className="w-9 shrink-0 text-right text-xs text-muted-foreground tabular-nums">
                {formatTime(position)}
              </span>
              {/*
                `duration` 은 메타데이터를 받기 전엔 0이다. max 를 0으로 두면 슬라이더가
                꽉 찬 것처럼 보이므로 미리듣기 기본 길이(30초)로 버틴다.
              */}
              <Slider
                value={[Math.min(position, duration || 30)]}
                max={duration || 30}
                step={0.1}
                onValueChange={([v]) => seek(v)}
                aria-label="재생 위치"
                className="min-w-16"
              />
              <span className="hidden w-9 shrink-0 text-xs text-muted-foreground tabular-nums sm:block">
                {formatTime(duration)}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

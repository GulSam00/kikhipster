'use client';

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { QueueTrack } from '@/types/player';

interface PlayerContextValue {
  queue: QueueTrack[];
  /** 큐가 비면 -1. */
  currentIndex: number;
  currentTrack: QueueTrack | null;
  isPlaying: boolean;
  /** 재생 위치·전체 길이(초). iTunes 미리듣기는 보통 30초다. */
  position: number;
  duration: number;
  /** 재생목록 패널이 펼쳐져 있는지. */
  queueOpen: boolean;
  setQueueOpen: (open: boolean) => void;

  /**
   * 0~1. **음소거와 따로 둔다** — 음소거를 풀었을 때 원래 크기로 돌아와야 하기 때문이다.
   * 실제 오디오에 먹는 값은 `muted ? 0 : volume` 이다.
   */
  volume: number;
  muted: boolean;
  setVolume: (volume: number) => void;
  toggleMute: () => void;

  /**
   * 큐 끝에 붙이고 그 첫 곡부터 바로 재생한다. **앱 어디서든 재생의 진입점은 이것 하나다.**
   * 이미 큐에 있는 곡은 다시 넣지 않고 그 자리로 이동한다 — 같은 곡을 두 번 누르면
   * 큐가 늘어나는 대신 처음부터 다시 재생된다.
   */
  enqueueAndPlay: (tracks: QueueTrack[]) => void;
  playAt: (index: number) => void;
  next: () => void;
  prev: () => void;
  toggle: () => void;
  seek: (seconds: number) => void;
  removeAt: (index: number) => void;
  move: (from: number, to: number) => void;
  clear: () => void;
}

const PlayerContext = createContext<PlayerContextValue | null>(null);

/** prev 를 눌렀을 때 이전 곡으로 갈지 현재 곡을 처음으로 되돌릴지 가르는 기준(초). */
const RESTART_THRESHOLD = 3;

/**
 * 볼륨은 브라우저에 남긴다 — 페이지를 옮길 때마다 100%로 돌아가면 매번 다시 줄여야 한다.
 * 음소거를 **크기와 따로** 적는 이유는, 음소거를 0으로 적으면 다시 켰을 때 원래 크기를
 * 잃어버리기 때문이다.
 */
const VOLUME_KEY = 'player_volume';
const MUTED_KEY = 'player_muted';
/** 볼륨이 0인 채로 음소거를 풀면 아무 소리도 안 난다 — 이 값으로 되살린다. */
const UNMUTE_FALLBACK = 0.5;

function persistVolume(volume: number, muted: boolean) {
  try {
    localStorage.setItem(VOLUME_KEY, String(volume));
    localStorage.setItem(MUTED_KEY, muted ? '1' : '0');
  } catch {
    // 사생활 보호 모드 등에서 접근 자체가 던진다. 이번 세션 볼륨에는 영향이 없다.
  }
}

/**
 * 저장해 둔 값을 **초기값으로** 읽는다(effect 가 아니라 lazy initializer).
 *
 * 서버에는 `localStorage` 가 없어 여기서 값이 갈리지만 hydration 은 어긋나지 않는다 —
 * 볼륨을 그리는 것은 `PlayerDock` 뿐이고, 그 안쪽은 `currentTrack` 이 있어야 렌더된다.
 * 첫 렌더의 큐는 서버·클라이언트 모두 비어 있어서 어느 쪽도 아무것도 그리지 않는다.
 */
function readStoredVolume() {
  if (typeof window === 'undefined') return 1;
  try {
    const raw = localStorage.getItem(VOLUME_KEY);
    const saved = Number(raw);
    if (raw !== null && Number.isFinite(saved) && saved >= 0 && saved <= 1) return saved;
  } catch {
    // 접근 자체가 던지는 환경 — 기본값으로 간다.
  }
  return 1;
}

function readStoredMuted() {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(MUTED_KEY) === '1';
  } catch {
    return false;
  }
}

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueue] = useState<QueueTrack[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [position, setPosition] = useState(0);
  const [duration, setDuration] = useState(0);
  const [queueOpen, setQueueOpen] = useState(false);
  const [volume, setVolumeState] = useState(readStoredVolume);
  const [muted, setMuted] = useState(readStoredMuted);

  // 콜백 안에서 최신 값을 봐야 하는데, 의존성에 넣으면 콜백이 매번 새로 만들어져
  // 자식이 통째로 리렌더된다. 렌더가 아니라 커밋 이후에 맞춰 둔다.
  const queueRef = useRef(queue);
  const indexRef = useRef(currentIndex);
  useEffect(() => {
    queueRef.current = queue;
  }, [queue]);
  useEffect(() => {
    indexRef.current = currentIndex;
  }, [currentIndex]);

  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);
  useEffect(() => {
    volumeRef.current = volume;
  }, [volume]);
  useEffect(() => {
    mutedRef.current = muted;
  }, [muted]);

  /**
   * 오디오에 볼륨을 먹인다. `src` 를 갈아 끼워도 엘리먼트의 `volume` 은 유지되므로
   * 곡 전환마다 다시 걸어 줄 필요는 없다.
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = muted ? 0 : volume;
  }, [volume, muted]);

  const setVolume = useCallback((next: number) => {
    const clamped = Math.min(Math.max(next, 0), 1);
    setVolumeState(clamped);
    // 슬라이더를 0까지 내리는 것은 음소거와 같은 뜻이다.
    setMuted(clamped === 0);
    persistVolume(clamped, clamped === 0);
  }, []);

  const toggleMute = useCallback(() => {
    // 업데이터 안에서 다른 setState 를 부르지 않는다(StrictMode 이중 호출) — ref 로 읽는다.
    if (!mutedRef.current) {
      setMuted(true);
      persistVolume(volumeRef.current, true);
      return;
    }
    // 0인 채로 음소거를 풀면 소리가 안 나니 들리는 크기로 되돌린다.
    const restored = volumeRef.current === 0 ? UNMUTE_FALLBACK : volumeRef.current;
    setVolumeState(restored);
    setMuted(false);
    persistVolume(restored, false);
  }, []);

  const currentTrack = currentIndex >= 0 ? (queue[currentIndex] ?? null) : null;
  const currentUrl = currentTrack?.previewUrl ?? null;

  /**
   * 곡이 바뀌면 src 를 갈아 끼우고 바로 재생한다.
   *
   * 의존성이 **URL 하나**인 게 중요하다 — 객체를 넣으면 큐를 재정렬하기만 해도
   * 같은 곡이 처음부터 다시 재생된다(순서 바꾸다가 노래가 끊긴다).
   *
   * 이 안에서 setState 를 직접 부르지 않는다. 재생 상태·진행률·길이는 전부 오디오
   * 엘리먼트가 알려 주는 값이라(`play`/`pause`/`loadstart`/`emptied` 이벤트) 그쪽에서
   * 받는 게 맞고, effect 본문에서 동기 setState 를 하면 연쇄 렌더가 생긴다.
   */
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    if (!currentUrl) {
      audio.pause();
      audio.removeAttribute('src');
      // src 를 떼기만 하면 진행률이 마지막 값에 멈춰 있다. load() 가 emptied 를 띄운다.
      audio.load();
      return;
    }

    audio.src = currentUrl;
    audio.play().catch(() => {
      // 사용자 제스처에서 시작하므로 브라우저 autoplay 차단에는 안 걸리지만,
      // 네트워크·CORS 로 실패할 수 있다. 조용히 멈추면 고장으로 보인다.
      setIsPlaying(false);
      toast.error('미리듣기를 재생하지 못했습니다');
    });
  }, [currentUrl]);

  const playAt = useCallback((index: number) => {
    if (index < 0 || index >= queueRef.current.length) return;
    if (index === indexRef.current) {
      // 같은 곡을 다시 고른 것 — 처음부터 다시 튼다.
      const audio = audioRef.current;
      if (audio) {
        audio.currentTime = 0;
        void audio.play();
      }
      return;
    }
    setCurrentIndex(index);
  }, []);

  const enqueueAndPlay = useCallback(
    (tracks: QueueTrack[]) => {
      if (tracks.length === 0) return;

      const existing = queueRef.current;
      const known = new Set(existing.map((t) => t.id));
      const fresh = tracks.filter((t) => !known.has(t.id));

      if (fresh.length === 0) {
        // 전부 이미 큐에 있다 — 첫 곡 자리로 이동한다.
        playAt(existing.findIndex((t) => t.id === tracks[0].id));
        return;
      }

      setQueue([...existing, ...fresh]);
      setCurrentIndex(existing.length);
    },
    [playAt],
  );

  const next = useCallback(() => {
    const i = indexRef.current;
    if (i + 1 < queueRef.current.length) {
      setCurrentIndex(i + 1);
      return;
    }
    // 마지막 곡이면 멈춘다. 되감아 두면 재생 버튼 한 번으로 다시 들을 수 있다.
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.currentTime = 0;
    }
    setPosition(0);
    setIsPlaying(false);
  }, []);

  const prev = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return;
    // 곡이 어느 정도 진행됐으면 이전 곡이 아니라 현재 곡을 처음으로 —
    // 플레이어의 관례이고, 미리듣기가 30초라 이 편이 실수를 덜 만든다.
    if (audio.currentTime > RESTART_THRESHOLD || indexRef.current <= 0) {
      audio.currentTime = 0;
      setPosition(0);
      void audio.play();
      return;
    }
    setCurrentIndex(indexRef.current - 1);
  }, []);

  const toggle = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || indexRef.current < 0) return;
    if (audio.paused) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, []);

  const seek = useCallback((seconds: number) => {
    const audio = audioRef.current;
    if (!audio || !Number.isFinite(audio.duration)) return;
    audio.currentTime = Math.min(Math.max(seconds, 0), audio.duration);
    setPosition(audio.currentTime);
  }, []);

  const removeAt = useCallback((index: number) => {
    const cur = indexRef.current;
    // 업데이터 안에서 다른 setState 를 부르지 않는다 — 업데이터는 순수해야 하고
    // StrictMode 에서 두 번 호출되면 인덱스가 두 번 밀린다.
    const rest = queueRef.current.filter((_, i) => i !== index);
    setQueue(rest);
    if (index < cur) {
      setCurrentIndex(cur - 1);
    } else if (index === cur) {
      // 뺀 자리에 다음 곡이 흘러 들어온다. 마지막 곡이었으면 한 칸 당긴다.
      setCurrentIndex(rest.length === 0 ? -1 : Math.min(cur, rest.length - 1));
    }
  }, []);

  const move = useCallback((from: number, to: number) => {
    if (from === to) return;
    const cur = indexRef.current;
    const rest = [...queueRef.current];
    const [moved] = rest.splice(from, 1);
    if (!moved) return;
    rest.splice(to, 0, moved);
    setQueue(rest);
    // 재생 중인 곡은 순서가 바뀌어도 계속 그 곡이어야 한다 — 인덱스만 따라 옮긴다.
    if (from === cur) setCurrentIndex(to);
    else if (from < cur && to >= cur) setCurrentIndex(cur - 1);
    else if (from > cur && to <= cur) setCurrentIndex(cur + 1);
  }, []);

  const clear = useCallback(() => {
    setQueue([]);
    setCurrentIndex(-1);
    setQueueOpen(false);
  }, []);

  return (
    <PlayerContext.Provider
      value={{
        queue,
        currentIndex,
        currentTrack,
        isPlaying,
        position,
        duration,
        queueOpen,
        setQueueOpen,
        volume,
        muted,
        setVolume,
        toggleMute,
        enqueueAndPlay,
        playAt,
        next,
        prev,
        toggle,
        seek,
        removeAt,
        move,
        clear,
      }}
    >
      {children}
      {/*
        오디오 엘리먼트를 렌더 트리에 둔다. `new Audio()` 를 쓰면 곡이 바뀔 때마다
        엘리먼트를 새로 만들고 리스너를 다시 붙여야 해서, 진행률·길이 같은 상태가
        전환 순간에 어긋난다.
      */}
      <audio
        ref={audioRef}
        preload="metadata"
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onLoadStart={() => setPosition(0)}
        onEmptied={() => {
          setPosition(0);
          setDuration(0);
        }}
        onTimeUpdate={(e) => setPosition(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) =>
          setDuration(Number.isFinite(e.currentTarget.duration) ? e.currentTarget.duration : 0)
        }
        onEnded={next}
      />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer must be used within PlayerProvider');
  return ctx;
}

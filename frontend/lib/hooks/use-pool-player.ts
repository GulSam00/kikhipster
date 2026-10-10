'use client';

import { useCallback, useState } from 'react';
import { toast } from 'sonner';

import { albumQueueTracks, poolItemToQueue } from '@/lib/domain/playable';
import type { PoolItem } from '@/lib/domain/pool-item';

import type { TournamentItemType } from '@/types/tournament';

import { usePlayer } from '@/contexts/PlayerContext';

/**
 * 월드컵 후보(곡·앨범) 하나를 눌렀을 때 재생목록에 넣고 트는 동작.
 *
 * 후보 그리드(`PoolGrid`)와 대결 화면(`/play/[playId]`)이 같은 규칙을 써야 해서 훅으로 뺐다:
 * - **곡**은 이미 `previewUrl` 을 들고 있다(배치 조회 응답에 들어 있다) — 바로 큐로.
 * - **앨범**은 미리듣기가 없다 — 누를 때 수록곡을 받아 통째로 큐에 붙인다.
 *
 * `pendingId` 는 앨범 수록곡을 받아 오는 동안 그 타일만 스피너로 바꾸기 위한 것이다.
 */
export function usePoolPlayer(itemType: TournamentItemType) {
  const { enqueueAndPlay, toggle, currentTrack, isPlaying } = usePlayer();
  const [pendingId, setPendingId] = useState<string | null>(null);

  const playItem = useCallback(
    async (item: PoolItem) => {
      if (itemType === 'track') {
        // 지금 그 곡이 걸려 있으면 큐를 건드리지 않고 멈추기만 한다.
        if (currentTrack?.id === item.id) {
          toggle();
          return;
        }
        const track = poolItemToQueue(item);
        if (!track) {
          toast.error('이 곡은 미리듣기를 제공하지 않습니다');
          return;
        }
        enqueueAndPlay([track]);
        return;
      }

      if (pendingId) return;
      setPendingId(item.id);
      try {
        const tracks = await albumQueueTracks(item.id);
        if (tracks.length === 0) {
          toast.error('이 앨범은 미리듣기를 제공하지 않습니다');
          return;
        }
        enqueueAndPlay(tracks);
      } catch {
        toast.error('앨범 수록곡을 불러오지 못했습니다');
      } finally {
        setPendingId(null);
      }
    },
    [currentTrack?.id, enqueueAndPlay, itemType, pendingId, toggle],
  );

  return { playItem, pendingId, currentId: currentTrack?.id ?? null, isPlaying };
}

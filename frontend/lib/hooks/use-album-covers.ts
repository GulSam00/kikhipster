'use client';

import { useEffect, useReducer } from 'react';

import { fetchPoolItems, type PoolItem } from '@/lib/domain/pool-item';

/**
 * 앨범 메타데이터(커버 URL + 제목 + 아티스트) 배치 로더.
 *
 * 왜 카드마다 부르지 않고 모아서 부르나: 탑스터 카드 한 장이 최대 25칸(5×5)이고 목록
 * 한 페이지에 30장이면 카드가 각자 요청할 경우 수백 번이 된다. 그래서 각 카드는 필요한
 * ID를 등록만 하고, 한 틱 뒤에 모인 걸 한 번의 `/api/music/albums?ids=` 로 합쳐 부른다.
 * 백엔드는 그 앞에 DB 캐시가 있어 두 번째부터는 iTunes를 아예 안 부른다.
 *
 * 카드가 Server Component 페이지(홈)에서도 쓰이므로 페이지가 prop으로 내려주는 방식은
 * 안 맞는다 — 카드 자신이 등록하는 구조여야 네 군데 사용처가 모두 그대로 동작한다.
 */

/** id → 앨범 정보. null 은 "조회했지만 iTunes에 없다"는 뜻이라 재요청하지 않는다. */
const albums = new Map<string, PoolItem | null>();

let queue = new Set<string>();
let scheduled = false;

/**
 * 배치가 끝날 때마다 깨울 구독자들.
 *
 * 반환 Promise로 리렌더를 걸면 경합이 생긴다 — 배치가 도는 중에 마운트된 카드는
 * "지금 도는 배치"의 Promise를 받지만 그 배치엔 자기 ID가 안 들어 있다. 그래서
 * 완료 알림을 구독 방식으로 돌려 어떤 배치가 끝나든 전부 다시 그리게 한다.
 */
const listeners = new Set<() => void>();

// 백엔드가 한 번에 512개까지 받는다. 여유를 두고 400으로 자른다.
const BATCH_LIMIT = 400;

async function runBatch(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i += BATCH_LIMIT) {
    const chunk = ids.slice(i, i + BATCH_LIMIT);
    try {
      const items = await fetchPoolItems('album', chunk);
      const found = new Map(items.map((it) => [it.id, it]));
      // 응답에 없는 ID도 null로 적어둬야 매 렌더마다 다시 묻지 않는다.
      chunk.forEach((id) => albums.set(id, found.get(id) ?? null));
    } catch {
      // 커버는 부가 정보다. 실패해도 카드 자체는 폴백으로 그려지고, 다음 마운트에 다시 시도한다.
    }
    listeners.forEach((l) => l());
  }
}

function requestAlbums(ids: string[]): void {
  const need = ids.filter((id) => id && !albums.has(id));
  if (need.length === 0) return;

  need.forEach((id) => queue.add(id));
  if (scheduled) return;

  scheduled = true;
  // setTimeout 0 — 같은 렌더 패스에서 마운트된 카드들이 전부 등록을 마친 뒤에 모아 보낸다.
  setTimeout(async () => {
    while (queue.size > 0) {
      const batch = [...queue];
      queue = new Set();
      // 배치가 도는 동안 새로 등록된 ID는 다음 바퀴에서 처리된다.
      await runBatch(batch);
    }
    scheduled = false;
  }, 0);
}

/**
 * 넘긴 ID들의 앨범 정보를 채우고, 채워지면 리렌더를 일으킨다.
 * 반환값은 전역 맵이라 이미 다른 화면이 받아둔 앨범은 요청 없이 바로 쓰인다.
 */
export function useAlbumItems(ids: string[]): Map<string, PoolItem | null> {
  const [, rerender] = useReducer((n: number) => n + 1, 0);
  const key = ids.join(',');

  useEffect(() => {
    if (!key) return;
    const wake = () => rerender();
    listeners.add(wake);
    // effect 안에서는 key만 쓴다 — ids 배열을 참조하면 매 렌더 새 참조라 의존성이 흔들린다.
    requestAlbums(key.split(','));
    return () => {
      listeners.delete(wake);
    };
  }, [key]);

  return albums;
}

import type { AppLocale } from '@/lib/domain/locale';

import type ko from '@/messages/ko.json';

/**
 * 메시지 파일 로더. **`ko.json` 이 기준 스키마다** — en·ja 로더의 반환 타입을 `ko` 의 타입으로
 * 고정해서, 키가 빠지면 `tsc`/`next build` 가 여기서 실패한다. 반대 방향(en·ja 에만 있는 키)과
 * 플레이스홀더 이름 차이는 `lib/domain/__tests__/messages.test.ts` 가 잡는다.
 */
export type Messages = typeof ko;

const loaders: Record<AppLocale, () => Promise<{ default: Messages }>> = {
  ko: () => import('@/messages/ko.json'),
  en: () => import('@/messages/en.json'),
  ja: () => import('@/messages/ja.json'),
};

export async function loadMessages(locale: AppLocale): Promise<Messages> {
  return (await loaders[locale]()).default;
}

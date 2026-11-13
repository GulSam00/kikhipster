import type { AppLocale } from '@/lib/domain/locale';

import type { Messages } from '@/i18n/messages';

/**
 * next-intl 타입 보강 — `useTranslations`/`getTranslations` 의 키와 `useLocale()` 의 반환 타입이
 * `messages/ko.json` 과 `LOCALES` 를 따른다. 없는 키를 쓰면 타입 체크에서 걸린다.
 */
declare module 'next-intl' {
  interface AppConfig {
    Locale: AppLocale;
    Messages: Messages;
  }
}

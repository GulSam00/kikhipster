'use client';

import { Languages } from 'lucide-react';
import { useLocale, useTranslations } from 'next-intl';
import { useTransition } from 'react';
import { toast } from 'sonner';

import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { isLocale, LOCALE_NATIVE_NAMES, LOCALES } from '@/lib/domain/locale';

import { setLocaleCookie } from '@/i18n/actions';

/**
 * 언어 전환. 상단 바에 있지만 그 바는 모바일에서도 보이므로(링크 목록만 `sm:` 이상) 어느 화면에서든 닿는다.
 * 하단 탭에 칸을 더 만들지 않은 이유: 5분할이 6분할이 되면 320px 에서 한 칸이 53px 로 줄어
 * 영어·일본어 라벨이 넘칠 위험이 더 커진다(DESIGN.md § Mobile responsiveness).
 */
export default function LocaleSwitcher() {
  const t = useTranslations('LocaleSwitcher');
  const locale = useLocale();
  const [isPending, startTransition] = useTransition();

  function handleChange(next: string) {
    if (!isLocale(next) || next === locale) return;
    startTransition(async () => {
      try {
        await setLocaleCookie(next);
      } catch (e) {
        console.error(e);
        toast.error(t('failed'));
      }
    });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label={t('label')} disabled={isPending}>
          <Languages />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-auto">
        <DropdownMenuLabel>{t('label')}</DropdownMenuLabel>
        <DropdownMenuRadioGroup value={locale} onValueChange={handleChange}>
          {LOCALES.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l}>
              {LOCALE_NATIVE_NAMES[l]}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

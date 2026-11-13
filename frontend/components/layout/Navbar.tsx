'use client';

import { Home, LayoutGrid, LogOut, Search, Trophy, User, type LucideIcon } from 'lucide-react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';

import LocaleSwitcher from '@/components/layout/LocaleSwitcher';
import { Button } from '@/components/ui/button';

import { clearMeCache } from '@/lib/hooks/use-me';

import { cn } from '@/lib/utils';

/**
 * 모바일 하단 탭은 상단 바와 다른 메시지(`Nav.tabs.*`)를 쓴다 — 줄인 이름이 필요해서다.
 *
 * 하단 탭은 `flex-1` 5분할이라 320px 에서 한 칸이 64px 인데, `text-xs`(12px) 기준
 * '이상형 월드컵'은 약 78px 로 칸을 넘긴다. 넘치면 가로 스크롤이 생기고 그건
 * DESIGN.md § Mobile responsiveness 의 BLOCK 사안이라, 좁은 화면에서만 '월드컵'으로 줄인다.
 * 상단 바에는 자리가 넉넉하므로 전체 이름을 그대로 쓴다.
 *
 * en·ja 도 같은 기준(`text-xs` 로 64px 안)으로 골랐다. 일본어는 한 글자가 약 12px 라
 * 6자짜리 'トップスター'·'プロフィール' 은 넘치므로 탭에서는 'チャート'·'マイページ' 로 줄인다.
 */
type NavKey = 'search' | 'topsters' | 'tournament';

const navLinks: { href: string; key: NavKey; icon: LucideIcon }[] = [
  { href: '/search', key: 'search', icon: Search },
  { href: '/topsters', key: 'topsters', icon: LayoutGrid },
  { href: '/tournament', key: 'tournament', icon: Trophy },
];

/** 로그아웃처럼 같은 탭에서 토큰을 지울 때 쓴다 — `storage` 이벤트는 **다른 탭**에서만 온다. */
const AUTH_CHANGE_EVENT = 'kikhipster:auth-change';

function subscribeToken(onChange: () => void) {
  window.addEventListener('storage', onChange);
  window.addEventListener(AUTH_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener('storage', onChange);
    window.removeEventListener(AUTH_CHANGE_EVENT, onChange);
  };
}

export default function Navbar() {
  // `usePathname()` 때문에 이 컴포넌트가 이동마다 다시 렌더되므로, 로그인 콜백이 토큰을 쓰고
  // 이동한 직후에도 스냅샷이 다시 읽힌다. `useState` + `useEffect` 가 아닌 이유는
  // `react-hooks/set-state-in-effect` 와 `use-reduced-motion.ts` 의 설명을 참고.
  const t = useTranslations('Nav');
  const pathname = usePathname();
  const router = useRouter();
  const isLoggedIn = useSyncExternalStore(
    subscribeToken,
    () => !!localStorage.getItem('access_token'),
    () => false,
  );

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    // 모듈 캐시에 남은 이전 사용자를 지운다. 안 지우면 로그아웃 직후에도 '내 댓글'로 보인다.
    clearMeCache();
    window.dispatchEvent(new Event(AUTH_CHANGE_EVENT));
    router.push('/');
  }

  const mobileTabs = [
    { href: '/', label: t('tabs.home'), icon: Home },
    ...navLinks.map(({ href, key, icon }) => ({
      href,
      label: t(`tabs.${key}`),
      icon,
    })),
  ];

  return (
    <>
      <header className="bg-card/95 supports-[backdrop-filter]:bg-card/80 sticky top-0 z-50 border-b backdrop-blur">
        <nav className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link
            href="/"
            className="text-primary text-lg font-bold tracking-tight transition-opacity hover:opacity-80"
          >
            kikhipster
          </Link>

          <ul className="hidden items-center gap-1 sm:flex">
            {navLinks.map(({ href, key }) => (
              <li key={href}>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(pathname.startsWith(href) && 'bg-muted text-foreground')}
                >
                  <Link href={href}>{t(key)}</Link>
                </Button>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            <LocaleSwitcher />
            {isLoggedIn ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(pathname.startsWith('/profile') && 'bg-muted text-foreground')}
                >
                  <Link href="/profile">{t('profile')}</Link>
                </Button>
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={handleLogout}
                  aria-label={t('logout')}
                >
                  <LogOut />
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">{t('login')}</Link>
              </Button>
            )}
          </div>
        </nav>
      </header>

      {/*
        모바일 하단 탭. `<header>` 밖에 둔다 — 헤더의 `backdrop-blur` 가 `fixed` 자손의
        기준 박스를 뷰포트에서 헤더로 바꿔서, 안에 두면 탭이 화면 아래가 아니라 헤더(56px)
        안에 갇혀 맨 위에 붙는다.
      */}
      <nav className="bg-card fixed inset-x-0 bottom-0 z-50 flex border-t sm:hidden">
        {mobileTabs.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || (href !== '/' && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
              )}
            >
              <Icon className="size-4" />
              {label}
            </Link>
          );
        })}
        <Link
          href={isLoggedIn ? '/profile' : '/login'}
          className={cn(
            'flex flex-1 flex-col items-center gap-0.5 py-2 text-xs font-medium transition-colors',
            pathname.startsWith('/profile') || pathname === '/login'
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground',
          )}
        >
          <User className="size-4" />
          {isLoggedIn ? t('tabs.profile') : t('tabs.login')}
        </Link>
      </nav>
    </>
  );
}

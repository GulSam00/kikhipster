'use client';

import { Home, LayoutGrid, LogOut, Search, Trophy, User, type LucideIcon } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/button';

import { clearMeCache } from '@/lib/hooks/use-me';

import { cn } from '@/lib/utils';

/**
 * `shortLabel` 은 모바일 하단 탭에서만 쓰는 줄인 이름이다.
 *
 * 하단 탭은 `flex-1` 5분할이라 320px 에서 한 칸이 64px 인데, `text-xs`(12px) 기준
 * '이상형 월드컵'은 약 78px 로 칸을 넘긴다. 넘치면 가로 스크롤이 생기고 그건
 * DESIGN.md § Mobile responsiveness 의 BLOCK 사안이라, 좁은 화면에서만 '월드컵'으로 줄인다.
 * 상단 바에는 자리가 넉넉하므로 전체 이름을 그대로 쓴다.
 */
const navLinks: { href: string; label: string; shortLabel?: string; icon: LucideIcon }[] = [
  { href: '/search', label: '검색', icon: Search },
  { href: '/topsters', label: '탑스터', icon: LayoutGrid },
  { href: '/tournament', label: '이상형 월드컵', shortLabel: '월드컵', icon: Trophy },
];

export default function Navbar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    setIsLoggedIn(!!localStorage.getItem('access_token'));
  }, [pathname]);

  function handleLogout() {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    localStorage.removeItem('user_id');
    // 모듈 캐시에 남은 이전 사용자를 지운다. 안 지우면 로그아웃 직후에도 '내 댓글'로 보인다.
    clearMeCache();
    setIsLoggedIn(false);
    router.push('/');
  }

  const mobileTabs = [
    { href: '/', label: '홈', icon: Home },
    ...navLinks.map(({ href, label, shortLabel, icon }) => ({
      href,
      label: shortLabel ?? label,
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
            {navLinks.map(({ href, label }) => (
              <li key={href}>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(pathname.startsWith(href) && 'bg-muted text-foreground')}
                >
                  <Link href={href}>{label}</Link>
                </Button>
              </li>
            ))}
          </ul>

          <div className="ml-auto flex items-center gap-1">
            {isLoggedIn ? (
              <>
                <Button
                  asChild
                  variant="ghost"
                  size="sm"
                  className={cn(pathname.startsWith('/profile') && 'bg-muted text-foreground')}
                >
                  <Link href="/profile">프로필</Link>
                </Button>
                <Button variant="ghost" size="icon-sm" onClick={handleLogout} aria-label="로그아웃">
                  <LogOut />
                </Button>
              </>
            ) : (
              <Button asChild size="sm">
                <Link href="/login">로그인</Link>
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
          {isLoggedIn ? '프로필' : '로그인'}
        </Link>
      </nav>
    </>
  );
}

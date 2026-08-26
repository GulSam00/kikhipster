'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Home, Search, LayoutGrid, Trophy, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { clearMeCache } from '@/lib/use-me';

const navLinks = [
  { href: '/search', label: '검색', icon: Search },
  { href: '/topsters', label: '탑스터', icon: LayoutGrid },
  { href: '/tournament', label: '토너먼트', icon: Trophy },
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

  const mobileTabs = [{ href: '/', label: '홈', icon: Home }, ...navLinks];

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link
          href="/"
          className="text-lg font-bold tracking-tight text-primary transition-opacity hover:opacity-80"
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

        <div className="flex items-center gap-1">
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

      {/* 모바일 하단 탭 */}
      <nav className="fixed inset-x-0 bottom-0 z-50 flex border-t bg-card sm:hidden">
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
    </header>
  );
}

'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

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
    setIsLoggedIn(false);
    router.push('/');
  }

  const navLinks = [
    { href: '/search', label: '검색' },
    { href: '/topsters', label: '탑스터' },
    { href: '/tournament', label: '토너먼트' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-zinc-900/95 backdrop-blur border-b border-zinc-800">
      <nav className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="text-lg font-bold text-violet-400 tracking-tight">
          kikhipster
        </Link>

        <ul className="hidden sm:flex items-center gap-1">
          {navLinks.map(({ href, label }) => (
            <li key={href}>
              <Link
                href={href}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  pathname.startsWith(href)
                    ? 'bg-zinc-800 text-white'
                    : 'text-zinc-400 hover:text-white hover:bg-zinc-800'
                }`}
              >
                {label}
              </Link>
            </li>
          ))}
        </ul>

        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <Link
                href="/profile"
                className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                프로필
              </Link>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 rounded-md text-sm font-medium text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
              >
                로그아웃
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="px-4 py-1.5 rounded-full text-sm font-medium bg-violet-600 text-white hover:bg-violet-500 transition-colors"
            >
              로그인
            </Link>
          )}
        </div>
      </nav>

      {/* 모바일 하단 탭 */}
      <nav className="sm:hidden fixed bottom-0 left-0 right-0 z-50 flex border-t border-zinc-800 bg-zinc-900">
        {[{ href: '/', label: '홈' }, ...navLinks].map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
              pathname === href || (href !== '/' && pathname.startsWith(href))
                ? 'text-violet-400'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {label}
          </Link>
        ))}
        <Link
          href={isLoggedIn ? '/profile' : '/login'}
          className={`flex-1 py-3 text-center text-xs font-medium transition-colors ${
            pathname.startsWith('/profile') || pathname === '/login'
              ? 'text-violet-400'
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {isLoggedIn ? '프로필' : '로그인'}
        </Link>
      </nav>
    </header>
  );
}

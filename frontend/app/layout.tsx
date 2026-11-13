import type { Metadata } from 'next';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getTranslations } from 'next-intl/server';
import { Geist } from 'next/font/google';

import Navbar from '@/components/layout/Navbar';
import PlayerDock from '@/components/layout/PlayerDock';
import { Toaster } from '@/components/ui/sonner';

import { OG_LOCALES } from '@/lib/domain/locale';
import { SITE_NAME, siteUrl } from '@/lib/site';

import { PlayerProvider } from '@/contexts/PlayerContext';

import './globals.css';

const geistSans = Geist({
  variable: '--font-sans',
  subsets: ['latin'],
});

export async function generateMetadata(): Promise<Metadata> {
  const [locale, t] = await Promise.all([getLocale(), getTranslations('Site')]);
  return {
    // 페이지별 OG 태그가 상대 경로를 절대 URL로 풀 기준. 없으면 Next가 빌드에서 경고하고
    // 크롤러는 이미지 경로를 해석하지 못한다.
    metadataBase: new URL(siteUrl()),
    title: {
      default: SITE_NAME,
      // 상세 페이지들이 제목만 주면 여기 붙는다.
      template: `%s · ${SITE_NAME}`,
    },
    description: t('description'),
    openGraph: {
      siteName: SITE_NAME,
      type: 'website',
      locale: OG_LOCALES[locale],
    },
  };
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // 쿠키 → Accept-Language → ko 로 해석된 값(`i18n/request.ts`). `dark` 는 언어와 무관하게 고정이다.
  // 클라이언트의 `apiFetch` 가 이 `lang` 을 읽어 음악 API 에 locale 을 싣는다.
  const locale = await getLocale();

  return (
    <html
      lang={locale}
      className={`dark ${geistSans.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      {/*
        문서 자체는 스크롤하지 않고 main 안에서만 스크롤한다. 이래야 페이지가
        "헤더를 뺀 남은 높이"를 definite 한 값으로 받을 수 있다 — 만들기 화면처럼
        화면을 꽉 채우고 내부만 스크롤해야 하는 페이지가 h-full 로 그 높이를 쓴다.
        (기존 페이지들은 main 이 스크롤되므로 보이는 동작은 그대로다.)
      */}
      <body className="flex h-full flex-col overflow-hidden">
        <NextIntlClientProvider>
          <PlayerProvider>
            <Navbar />
            {/*
            모바일 하단 탭바만큼의 여백은 `PlayerDock` 이 들고 있다 — 재생기가 흐름 안에
            있어서(fixed 아님) main 이 그 아래로 밀리지 않으려면 여백도 그쪽에 있어야 한다.
          */}
            <main className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</main>
            <PlayerDock />
            <Toaster />
          </PlayerProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}

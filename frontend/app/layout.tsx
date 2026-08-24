import type { Metadata } from "next";
import { Geist } from "next/font/google";
import Navbar from "@/components/layout/Navbar";
import MiniPlayer from "@/components/layout/MiniPlayer";
import { PlayerProvider } from "@/contexts/PlayerContext";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "kikhipster",
  description: "음악 탑스터, 토너먼트, 아티스트 탐색 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
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
        <PlayerProvider>
          <Navbar />
          <main className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-16 sm:pb-0">
            {children}
          </main>
          <MiniPlayer />
          <Toaster />
        </PlayerProvider>
      </body>
    </html>
  );
}

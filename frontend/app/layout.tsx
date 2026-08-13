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
      <body className="flex min-h-full flex-col">
        <PlayerProvider>
          <Navbar />
          <main className="flex flex-1 flex-col pb-16 sm:pb-0">{children}</main>
          <MiniPlayer />
          <Toaster />
        </PlayerProvider>
      </body>
    </html>
  );
}

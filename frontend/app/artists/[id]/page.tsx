import { Mic2 } from 'lucide-react';
import Image from 'next/image';
import { notFound } from 'next/navigation';

import AlbumCard from '@/components/music/AlbumCard';
import TrackRow from '@/components/music/TrackRow';
import LikeButton from '@/components/social/LikeButton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

import { ApiError } from '@/lib/api/client';
// 지역 래퍼(404 -> null)와 이름이 겹쳐 별칭을 준다.
import {
  getArtist as fetchArtist,
  getArtistAlbums as fetchArtistAlbums,
  getArtistTopTracks as fetchArtistTopTracks,
} from '@/lib/api/music';

import type { AlbumSummary, ArtistDetail, TrackSearchItem } from '@/types/music';

async function getArtist(id: string): Promise<ArtistDetail | null> {
  try {
    return await fetchArtist(id);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
}

async function getTopTracks(id: string): Promise<TrackSearchItem[]> {
  try {
    return await fetchArtistTopTracks(id);
  } catch {
    return [];
  }
}

async function getAlbums(id: string): Promise<AlbumSummary[]> {
  try {
    return await fetchArtistAlbums(id);
  } catch {
    return [];
  }
}

export default async function ArtistPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [artist, topTracks, albums] = await Promise.all([
    getArtist(id),
    getTopTracks(id),
    getAlbums(id),
  ]);

  if (!artist) notFound();

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8">
      <div className="mb-8 flex flex-col items-start gap-6 sm:flex-row sm:items-end">
        <div className="bg-muted relative size-32 shrink-0 overflow-hidden rounded-full">
          {artist.image_url ? (
            <Image src={artist.image_url} alt={artist.name} fill className="object-cover" />
          ) : (
            <div className="text-muted-foreground flex size-full items-center justify-center">
              <Mic2 className="size-10" />
            </div>
          )}
        </div>
        <div className="min-w-0">
          <p className="text-muted-foreground mb-1 text-xs">아티스트</p>
          <h1 className="font-heading mb-2 text-3xl font-bold">{artist.name}</h1>
          <div className="text-muted-foreground mb-3 flex flex-wrap items-center gap-2 text-sm">
            {artist.genres.slice(0, 3).map((g) => (
              <Badge key={g} variant="secondary">
                {g}
              </Badge>
            ))}
          </div>
          <LikeButton targetType="artist" targetId={artist.id} name={artist.name} />
        </div>
      </div>

      <Separator className="mb-6" />

      {topTracks.length > 0 && (
        <section className="mb-8">
          <h2 className="font-heading mb-3 text-lg font-bold">인기 트랙</h2>
          <div className="flex flex-col">
            {topTracks.map((t, i) => (
              <TrackRow
                key={t.id}
                track={{ ...t, track_number: i + 1 }}
                artist={artist.name}
                /*
                  예전에는 `artist.image_url` 을 넘겼는데 그건 **항상 null 이다** —
                  iTunes 아티스트 엔티티에 이미지 필드가 없다. 그래서 여기서 재생을
                  시작하면 하단 재생기의 커버 자리가 늘 비어 있었다. 곡이 실린 앨범의
                  커버를 넘긴다(2026-09-01).
                */
                albumCover={t.album.cover_url}
                showCover
              />
            ))}
          </div>
        </section>
      )}

      {albums.length > 0 && (
        <section>
          <h2 className="font-heading mb-3 text-lg font-bold">앨범 · 싱글</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6">
            {albums.map((a) => (
              <AlbumCard key={a.id} album={a} />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

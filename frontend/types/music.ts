export interface ArtistSummary {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

// 백엔드 스키마(ArtistDetail(ArtistSummary): pass)와 동일 — 앨범 목록은
// 별도 엔드포인트(GET /api/music/artists/{id}/albums)로 조회한다.
export type ArtistDetail = ArtistSummary;

export interface AlbumSummary {
  id: string;
  name: string;
  artist_id: string;
  artist_name: string;
  cover_url: string | null;
  release_date: string;
  total_tracks: number;
  album_type: string;
}

export interface TrackItem {
  id: string;
  name: string;
  duration_ms: number;
  track_number: number;
  preview_url: string | null;
  explicit: boolean;
}

export interface AlbumWithTracks extends AlbumSummary {
  tracks: TrackItem[];
}

export interface TrackSearchItem {
  id: string;
  name: string;
  artists: string[];
  album: {
    id: string;
    name: string;
    cover_url: string | null;
  };
  duration_ms: number;
  popularity: number;
  explicit: boolean;
  preview_url: string | null;
}

export interface SearchArtistsResponse {
  items: ArtistSummary[];
  total: number;
}

export interface SearchAlbumsResponse {
  items: AlbumSummary[];
  total: number;
}

export interface SearchTracksResponse {
  items: TrackSearchItem[];
  total: number;
}

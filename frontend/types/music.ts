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
  /** 백엔드는 `name`이 아니라 `title`로 준다. `artist_id`는 아예 오지 않는다. */
  title: string;
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
  artists: string[];
}

/**
 * `GET /api/music/albums/{id}/tracks` 응답.
 * 백엔드는 앨범을 `album` 키 아래에 중첩해 준다 — 평평한 모양이 아니다.
 */
export interface AlbumWithTracks {
  album: AlbumSummary;
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

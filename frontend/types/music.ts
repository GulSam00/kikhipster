export interface ArtistSummary {
  id: string;
  name: string;
  image_url: string | null;
  genres: string[];
  popularity: number;
}

export interface ArtistDetail extends ArtistSummary {
  albums: AlbumSummary[];
}

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

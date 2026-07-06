export interface TopsterItem {
  id: string;
  album_spotify_id: string;
  position: number;
}

export interface TopsterUser {
  id: string;
  nickname: string;
}

export interface Topster {
  id: string;
  title: string;
  description: string;
  grid_size: number;
  is_public: boolean;
  created_at: string;
  user: TopsterUser;
  items: TopsterItem[];
  like_count: number;
}

export interface TopsterCreateBody {
  title: string;
  description?: string;
  grid_size: number;
  is_public: boolean;
  items: { album_spotify_id: string; position: number }[];
}

export interface TopsterUpdateBody {
  title?: string;
  description?: string;
  grid_size?: number;
  is_public?: boolean;
  items?: { album_spotify_id: string; position: number }[];
}

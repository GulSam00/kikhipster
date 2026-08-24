export interface TopsterItem {
  id: string;
  album_spotify_id: string;
  position: number;
}

export interface TopsterUser {
  id: string;
  nickname: string;
}

/**
 * 탑스터 표시 옵션. 만들기 화면 '옵션' 탭과 1:1 대응하고, 백엔드 `TopsterOptions` 와 같다.
 * width/height 는 격자의 **칸 개수**(열 수 / 행 수)다 — 셀 픽셀 크기가 아니다.
 */
export interface TopsterOptions {
  width: number;
  height: number;
  /** #RGB 또는 #RRGGBB. 사용자 콘텐츠라 임의 색을 허용한다. */
  background_color: string;
  /** 제목·앨범 정보 글자색. 배경을 밝게 고르면 흰 글자가 안 보이므로 같이 고른다. */
  text_color: string;
  /** 칸 사이 간격(px). */
  cell_gap: number;
  show_title: boolean;
  /** 그리드 옆 '아티스트 – 앨범' 목록 노출 여부. */
  show_album_info: boolean;
  show_numbering: boolean;
}

export const DEFAULT_TOPSTER_OPTIONS: TopsterOptions = {
  width: 5,
  height: 5,
  background_color: '#18181b',
  text_color: '#ffffff',
  cell_gap: 4,
  show_title: true,
  show_album_info: true,
  show_numbering: false,
};

export interface Topster extends TopsterOptions {
  id: string;
  title: string;
  description: string;
  is_public: boolean;
  created_at: string;
  user: TopsterUser;
  items: TopsterItem[];
  like_count: number;
}

export interface TopsterCreateBody extends TopsterOptions {
  title: string;
  description?: string;
  is_public: boolean;
  items: { album_spotify_id: string; position: number }[];
}

export interface TopsterUpdateBody extends Partial<TopsterOptions> {
  title?: string;
  description?: string;
  is_public?: boolean;
  items?: { album_spotify_id: string; position: number }[];
}

/** 탑스터 목록 정렬. 인기순은 전체 기간 '좋아요 수' 기준이다(월드컵과 달리 기간 구분 없음). */
export type TopsterSort = 'recent' | 'popular';

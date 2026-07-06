from pydantic import BaseModel


class ArtistSummary(BaseModel):
    id: str
    name: str
    image_url: str | None = None
    genres: list[str] = []
    popularity: int = 0
    followers: int = 0


class ArtistDetail(ArtistSummary):
    pass


class AlbumSummary(BaseModel):
    id: str
    title: str
    cover_url: str | None = None
    artist_name: str = ""
    release_date: str = ""
    total_tracks: int = 0
    album_type: str = "album"


class TrackItem(BaseModel):
    id: str
    name: str
    track_number: int = 0
    duration_ms: int = 0
    preview_url: str | None = None
    artists: list[str] = []


class AlbumWithTracks(BaseModel):
    album: AlbumSummary
    tracks: list[TrackItem]


class SearchArtistsResponse(BaseModel):
    items: list[ArtistSummary]
    total: int = 0


class SearchAlbumsResponse(BaseModel):
    items: list[AlbumSummary]
    total: int = 0

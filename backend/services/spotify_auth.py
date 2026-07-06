import asyncio
import base64
import logging
import time

import httpx

logger = logging.getLogger(__name__)


class SpotifyTokenManager:
    """Client Credentials Flow 토큰 관리자 (자동 갱신)."""

    TOKEN_URL = "https://accounts.spotify.com/api/token"

    def __init__(self, client_id: str, client_secret: str) -> None:
        self._client_id = client_id
        self._client_secret = client_secret
        self._token: str | None = None
        self._expires_at: float = 0.0
        self._lock = asyncio.Lock()

    def _is_token_valid(self) -> bool:
        """만료 60초 전 기준으로 토큰 유효 여부 확인."""
        return self._token is not None and time.time() < (self._expires_at - 60)

    async def get_token(self, client: httpx.AsyncClient) -> str:
        """유효한 access token 반환. 만료 임박 시 자동 갱신."""
        if self._is_token_valid():
            return self._token  # type: ignore[return-value]

        async with self._lock:
            if self._is_token_valid():
                return self._token  # type: ignore[return-value]
            await self._refresh_token(client)

        return self._token  # type: ignore[return-value]

    async def _refresh_token(self, client: httpx.AsyncClient) -> None:
        """Client Credentials Flow로 새 토큰 발급."""
        credentials = f"{self._client_id}:{self._client_secret}"
        encoded = base64.b64encode(credentials.encode()).decode()

        response = await client.post(
            self.TOKEN_URL,
            headers={
                "Authorization": f"Basic {encoded}",
                "Content-Type": "application/x-www-form-urlencoded",
            },
            data={"grant_type": "client_credentials"},
        )
        response.raise_for_status()

        data = response.json()
        self._token = data["access_token"]
        self._expires_at = time.time() + data.get("expires_in", 3600)

        logger.info(
            "Spotify access token refreshed, expires in %ds",
            data.get("expires_in", 3600),
        )

    async def invalidate(self) -> None:
        """토큰 강제 무효화 (401 재시도 시 사용). Lock으로 race condition 방지."""
        async with self._lock:
            self._token = None
            self._expires_at = 0.0

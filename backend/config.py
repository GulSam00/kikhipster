from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    database_url: str = "postgresql://user:password@localhost:5432/kikhipster"
    spotify_client_id: str = ""
    spotify_client_secret: str = ""
    spotify_default_market: str = "KR"

    model_config = {"env_file": ".env", "env_file_encoding": "utf-8"}


settings = Settings()

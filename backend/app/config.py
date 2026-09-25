from functools import lru_cache
from pathlib import Path

from pydantic_settings import BaseSettings, SettingsConfigDict
from sqlalchemy import URL

# Lokal liegt die .env im Repo-Wurzelverzeichnis; im Container kommt alles aus der Umgebung.
REPO_ROOT_ENV = Path(__file__).resolve().parents[2] / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=REPO_ROOT_ENV, extra="ignore")

    postgres_host: str = "localhost"
    postgres_port: int = 5432
    postgres_user: str = "famquest"
    postgres_password: str = ""
    postgres_db: str = "famquest"

    # Verzeichnis mit dem gebauten Frontend; leer = nur API (lokale Entwicklung mit Vite).
    static_dir: Path | None = None
    upload_dir: Path = Path("data/uploads")

    def database_url(self, database: str | None = None) -> URL:
        return URL.create(
            "postgresql+psycopg",
            username=self.postgres_user,
            password=self.postgres_password,
            host=self.postgres_host,
            port=self.postgres_port,
            database=database or self.postgres_db,
        )


@lru_cache
def get_settings() -> Settings:
    return Settings()

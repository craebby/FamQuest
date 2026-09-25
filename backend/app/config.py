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
    # debug, info, warning, error, critical; debug protokolliert z. B. die eingegebene E-Mail
    # bei fehlgeschlagenen Anmeldungen.
    log_level: str = "info"
    upload_dir: Path = Path("data/uploads")

    # Google Kalender (Phase 2). Ohne diese drei Werte ist der Kalender abgeschaltet.
    google_client_id: str = ""
    google_client_secret: str = ""
    # Beliebige lange Zufallszeichenkette; verschlüsselt die OAuth-Tokens in der Datenbank.
    token_encryption_key: str = ""
    # Abstand der Kalender-Synchronisation im Hintergrund in Minuten; 0 = aus.
    calendar_sync_minutes: int = 5

    @property
    def calendar_configured(self) -> bool:
        return bool(
            self.google_client_id and self.google_client_secret and self.token_encryption_key
        )

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

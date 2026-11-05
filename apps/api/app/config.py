import json
import os
from dataclasses import dataclass
from pathlib import Path
from zoneinfo import ZoneInfo

ROOT = Path(__file__).resolve().parents[3]


@dataclass(frozen=True)
class Settings:
    database_url: str
    cors_origins: tuple[str, ...]
    timezone: ZoneInfo

    @classmethod
    def from_env(cls) -> "Settings":
        origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000")
        # A JSON array or a comma-separated list; origins never include a URL path.
        parsed = json.loads(origins) if origins.strip().startswith("[") else origins.split(",")
        if not isinstance(parsed, list) or not all(isinstance(item, str) for item in parsed):
            raise ValueError("CORS_ORIGINS doit être une liste d'origines")
        url = os.environ.get("DATABASE_URL", f"sqlite:///{ROOT / 'work' / 'daily.db'}")
        return cls(
            database_url=url,
            cors_origins=tuple(origin.strip().rstrip("/") for origin in parsed if origin.strip()),
            timezone=ZoneInfo(os.environ.get("APP_TIMEZONE", "Europe/Paris")),
        )

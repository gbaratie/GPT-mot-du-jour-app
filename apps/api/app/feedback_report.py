"""Export aggregate feedback for editorial planning, without reader identifiers."""

import argparse
import json
import sys
from datetime import UTC, date, datetime
from pathlib import Path

from sqlalchemy.exc import SQLAlchemyError

from app.config import Settings
from app.db import create_database
from app.repositories.feedback import FeedbackRepository


def export_report(database_url: str, slug: str | None = None, since: date | None = None):
    engine, factory = create_database(database_url)
    try:
        with factory() as session:
            items = FeedbackRepository(session).report(slug, since)
        return {
            "generated_at": datetime.now(UTC).isoformat(),
            "collection": slug,
            "votes_updated_since": str(since) if since else None,
            "total_votes": sum(row["likes"] + row["dislikes"] for row in items),
            "items": items,
        }
    finally:
        engine.dispose()


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--collection")
    parser.add_argument("--since", type=date.fromisoformat)
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    try:
        report = export_report(Settings.from_env().database_url, args.collection, args.since)
    except SQLAlchemyError:
        print(
            "Rapport indisponible : vérifier la connexion et les migrations de la base configurée.",
            file=sys.stderr,
        )
        raise SystemExit(1) from None
    rendered = json.dumps(report, default=str, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    else:
        print(rendered, end="")


if __name__ == "__main__":
    main()

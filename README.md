# Chaque jour · Mot du jour

Une application de découvertes quotidiennes : mots français et citations, avec consultation par date et archives. Monorepo léger inspiré de [gb](https://github.com/gbaratie/gb) et [kahin](https://github.com/gbaratie/kahin).

| Composant | Stack | Hébergement cible |
| --- | --- | --- |
| `apps/web` | Next.js, React, TypeScript, MUI, export statique | GitHub Pages |
| `apps/api` | FastAPI, Pydantic, SQLAlchemy, Alembic | Render |
| Base | PostgreSQL / JSONB | Neon |
| `content/` | JSON versionné et validé | Source éditoriale |

## Démarrage local

Prérequis : Python 3.12+, Node 22+, npm, make.

```sh
make install
make migrate
make sync-content
make dev-api
# Autre terminal :
make dev-web
```

Front : http://localhost:3000 ; API : http://localhost:8000/docs.
Sans `DATABASE_URL`, le développement utilise SQLite dans `work/daily.db`.
Pour PostgreSQL/Neon, exporter `DATABASE_URL` avant les migrations, la synchronisation et le démarrage. Voir `.env.example` ; le shell doit exporter ses valeurs.
La production utilise PostgreSQL avec TLS et JSONB ; SQLite est une facilité locale.

```sh
make check          # Contenu, Ruff, TypeScript et ESLint
make test           # API + composants React
make build          # apps/web/out/ ; aucun appel API au build
make add-entry COLLECTION=mot-du-jour DATE=2026-11-05
```

La dernière commande crée un brouillon dans `work/drafts/`. Le compléter puis relancer avec `PAYLOAD=work/drafts/mot-du-jour-2026-11-05.json` pour ajouter l'entrée validée.

## API de lecture

```text
GET /health
GET /api/v1/collections
GET /api/v1/today
GET /api/v1/collections/{slug}
GET /api/v1/collections/{slug}/today
GET /api/v1/collections/{slug}/entries?limit=30&before=2026-11-04
GET /api/v1/collections/{slug}/entries/{date}
```

Dates exactes ; `before` exclusif ; historique du plus récent au plus ancien ; `limit` de 1 à 100. Le jour courant suit Europe/Paris. Une publication absente renvoie 404, une date invalide 422, une base indisponible 503. `/today` garde les collections sans publication avec `entry: null`.

## Contenu migré

Les **365 mots de 2025** sont conservés dans `content/mot-du-jour/2025.json`. Ils ne se répètent plus automatiquement en 2026. `citation-du-jour` contient trois exemples du 4 au 6 novembre 2026. Aucune publication n'est inventée pour les autres dates.
Archives : `/mot-du-jour/?date=2025-01-01`.

Streamlit et les anciennes routes `/motdujour`, `/historique` sont remplacés. Le code précédent reste dans l'historique Git. L'import réutilisable :

```sh
scripts/import-legacy-words --source /chemin/words.json
```

Il refuse les années incomplètes, les doublons et l'écrasement des fichiers déjà migrés.

## Documentation

- [Architecture](docs/ARCHITECTURE.md)
- [Déploiement Render, Neon et GitHub Pages](docs/DEPLOYMENT.md)
- [Ajouter des entrées](docs/agents/ADD_ENTRIES.md)
- [Ajouter une collection ou un kind](docs/agents/ADD_COLLECTION.md)
- [Instructions pour les agents](AGENTS.md)

Les configurations de déploiement sont fournies ; aucun service ni secret n'est créé par les commandes de développement.

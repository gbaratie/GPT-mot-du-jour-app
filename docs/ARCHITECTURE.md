# Architecture

## Périmètre

```text
Navigateur → GitHub Pages (Next.js exporté)
     └────→ Render (FastAPI) → Neon (PostgreSQL)
Git content/ → validation → synchronisation transactionnelle → Neon
```

`apps/web/src/app/[slug]` est généré au build pour chaque collection active de
`content/collections.json`. La date est un paramètre de recherche (`?date=2025-01-01`),
donc GitHub Pages sert la même page quelle que soit la date. Les données sont chargées
dans le navigateur ; le build ne contacte pas l'API. Next.js ajoute le `basePath` aux
liens et assets. Les requêtes API utilisent une URL absolue indépendante.

## Modèle

`DailyCollection` contient slug unique, nom, description, kind, locale, active et sort_order.
`DailyEntry` contient collection_id, publication_date, payload JSONB, created_at et updated_at.
La contrainte unique `(collection_id, publication_date)` garantit un contenu par jour et
collection et indexe les recherches par date et les archives.

Les kinds `word`, `quote`, `riddle` sont enregistrés dans `collections/registry.py`.
Pydantic interdit les champs inconnus et les chaînes vides. Les réponses OpenAPI sont
des unions discriminées par `kind`. Le front reproduit cette union et rend le payload
via un switch exhaustif. Aucun HTML éditorial n'est injecté.

La collection est déclarée dans le manifeste éditorial. L'API la lit depuis la base après
synchronisation ; le front lit le manifeste au build pour ses routes et sa navigation.
Ajouter une collection exige donc une synchronisation et un build du front.

## Dates et absences

L'API calcule aujourd'hui avec `zoneinfo` et `APP_TIMEZONE=Europe/Paris`, y compris en heure
d'été. Les publications utilisent des dates SQL exactes. L'historique prend les dates
strictement antérieures à `before`, par défaut aujourd'hui, dans l'ordre décroissant.
Une date future peut être consultée explicitement : ce jalon ne gère pas d'embargo éditorial.

Une publication absente renvoie 404 ; l'accueil indique `entry: null` pour cette collection.
Le front conserve l'accès aux archives. Les données sont rechargées à la navigation ou au
rechargement de page ; une page laissée ouverte n'est pas rafraîchie automatiquement à minuit.

## Contenu

`content/<slug>/<année>.json` contient `{publication_date, payload}`. Les plages `coverage`
du manifeste déclarent les périodes que l'équipe s'engage à remplir. La validation contrôle
les trous dans ces plages, les chevauchements, les dates hors couverture, les doublons,
les années de fichiers et les schémas de payload. Une démonstration peut ainsi couvrir trois
jours sans prétendre couvrir toute une année.

`sync-content` valide tout avant de se connecter, puis effectue une transaction d'upsert.
Les identifiants et dates de création restent stables ; `updated_at` change seulement si le
payload change. Aucune suppression : retirer une ligne JSON ne l'efface pas de la base.
Pour masquer une collection, garder sa déclaration avec `active: false`. Le kind d'une
collection existante est immuable ; un nouveau kind exige un nouveau slug.

Alembic gère uniquement le schéma. Le fichier historique words.json est converti en 365
entrées de 2025 sans changer les termes, définitions ou exemples. Streamlit et l'ancien
script d'ajout sont retirés ; leurs versions précédentes restent dans Git.

## Organisation API

- `api/routes/` : HTTP, paramètres et réponses.
- `services/` : règles de lecture, assemblage des réponses et erreurs d'absence.
- `repositories/` : requêtes SQLAlchemy.
- `models/` : tables ; `schemas/` : contrats HTTP ; `collections/` : schémas des payloads.
- `content.py` : validation, import et synchronisation, sans endpoints d'écriture.

Les sessions sont courtes et le pool vérifie les connexions avant réutilisation. Les erreurs
SQL deviennent des 503 génériques sans exposer requêtes ni chaînes de connexion. `/health`
vérifie la connexion. Les migrations sont obligatoires avant le lancement du service.

## Vérification

Les tests couvrent les dates exactes, le passage d'année, Paris hiver/été, les archives,
les collections inconnues/inactives, CORS, les erreurs de base, les schémas, la couverture,
les doublons et l'idempotence. La CI teste aussi PostgreSQL 17 (JSONB, migrations et double
synchronisation). Les tests React couvrent les payloads et les erreurs/absences. Le build
est exécuté sous `/GPT-mot-du-jour-app` pour vérifier l'export en sous-répertoire.

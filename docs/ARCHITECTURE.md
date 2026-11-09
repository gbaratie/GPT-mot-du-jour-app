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

## Découverte et cache navigateur

`GET /api/v1/collections/{slug}/discover?limit=12&exclude=YYYY-MM-DD` fournit
un lot aléatoire (1 à 20 éléments, 100 dates exclues maximum, paramètre répété).
La sélection porte sur une seule collection active et les publications jusqu’à
aujourd’hui inclus, calculé par l’API à Paris. Le hasard est appliqué en SQL ;
aucune date vide n’est tirée. Une collection épuisée renvoie un tableau vide.

Les cartes proposent un balayage horizontal, des boutons et les flèches clavier
lorsque la carte a le focus. Retour permet de relire le parcours courant. Les 30
dernières dates vues par collection sont conservées sur cet appareil ; les dates
encore connues dans la session sont aussi exclues (jusqu’à 100 au total). Après
épuisement, « Recommencer » autorise explicitement leur réapparition. Les lots
chargés sont consommés localement et leurs publications peuvent être réutilisées
en cas de panne réseau après rechargement. Sans stockage disponible, la session continue de fonctionner.

Le cache `localStorage` est versionné, séparé par URL d’API et limité à 200
réponses/publications. Une publication datée est conservée sept jours ; les
réponses « aujourd’hui » sont toujours revalidées auprès du serveur avant affichage ;
les listes d’archives ont une fraîcheur de 60 secondes.
Une réponse expirée de moins de sept jours peut dépanner en cas de panne réseau
ou d’erreur serveur, avec un message explicite. Les erreurs 4xx ne sont pas
masquées. Les réponses « aujourd’hui » conservent la date fournie par l’API.
Il s’agit du cache des données, pas d’un mode PWA hors ligne du site lui-même.

Après 3,5 secondes d’attente réseau, une notification refermable explique que le
service peut redémarrer après une pause. Elle disparaît à la fin des appels lents.
Le front ne peut pas distinguer un démarrage à froid d’une connexion lente et ne
prétend donc pas le diagnostiquer. Le délai d’expiration est de 90 secondes pour
laisser le temps au service de redémarrer ; les erreurs restent réessayables.

Le tirage consomme un lot choisi aléatoirement dans toute l’histoire publiée de
la collection. Quand il est vide, le front demande un nouveau lot au serveur,
sans privilégier les seuls éléments déjà en cache. Le cache devient le secours
en cas de panne. Pendant la recherche d’une nouvelle carte, un squelette remplace
la précédente. Le geste transforme la carte entière et toute interruption du
pointeur restaure sa position. Couverture éditoriale 2026 : voir `docs/content/2026.md`.

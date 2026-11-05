# Déploiement

## Neon

Créer un projet PostgreSQL dans Neon. Conserver son URI dans le secret Render `DATABASE_URL`,
jamais dans Git ou une variable `NEXT_PUBLIC_*`. Utiliser TLS (`sslmode=require` ou vérification
renforcée selon la configuration Neon). L'API normalise `postgresql://` vers psycopg.

Pour tester l'intégration avec une base PostgreSQL **de test dédiée** :

```sh
TEST_DATABASE_URL=postgresql://... make test
```

Ce test crée les tables et synchronise le contenu. Ne pas utiliser une base de production.
La CI fournit une base éphémère sans contacter Neon.

## Render

Le Blueprint `render.yaml` utilise la racine du dépôt : ne pas définir `rootDir: apps/api`,
car `content/` doit être disponible. L'installation éditable conserve cet accès au monorepo.
Le script `scripts/start-api` migre le schéma puis synchronise le contenu avant Uvicorn :

```sh
alembic -c apps/api/alembic.ini upgrade head
daily-content sync
```

Le service utilise `plan: free` dans la région de Francfort. Les commandes de démarrage
exigent `DATABASE_URL` et `CORS_ORIGINS`, puis lancent Uvicorn sur le port fourni par Render.
Le script est répétable : il s'exécute aussi lors d'un redémarrage ou d'une sortie de veille.
Sur une offre payante, les migrations et la synchronisation peuvent être déplacées dans
`preDeployCommand`. Le mode actuel prévoit un seul processus ; avant de multiplier les
instances, déplacer ces opérations dans une étape de déploiement unique.

| Variable | Valeur |
| --- | --- |
| `DATABASE_URL` | URI Neon avec TLS |
| `CORS_ORIGINS` | `https://gbaratie.github.io` (origine seule, sans chemin) |
| `APP_TIMEZONE` | `Europe/Paris` |

Plusieurs origines sont séparées par des virgules ou fournies comme tableau JSON. Ne pas
ajouter `/GPT-mot-du-jour-app` à CORS. Pour un domaine personnalisé, ajouter son origine exacte.

Le Blueprint pointe sur `main` et active le déploiement automatique (`autoDeployTrigger: commit`).
Le service Render doit suivre cette même configuration. Vérifier `/health`, `/docs`,
`/api/v1/today` et une archive datée après déploiement.

La synchronisation est répétable et transactionnelle. Pour publier/corriger : versionner
les JSON, valider puis synchroniser dans l'environnement autorisé. Si la structure change,
migrer d'abord. Retirer une ligne Git ne supprime pas son archive en base ; les retraits
nécessitent une opération dédiée. Désactiver une collection avec `active: false`.

## GitHub Pages

1. **Settings → Pages → Source** : choisir **GitHub Actions**.
2. **Settings → Secrets and variables → Actions → Variables** :
   `NEXT_PUBLIC_API_URL` = URL HTTPS Render (sans `/api/v1`) ;
   `NEXT_PUBLIC_BASE_PATH` = `/GPT-mot-du-jour-app` (valeur par défaut du workflow).
   Pour servir à la racine d'un domaine, donner `/`, normalisé en chemin vide.
3. Exécuter `Deploy web to GitHub Pages` ou publier sur `main`.

Le workflow de déploiement accepte aussi les entrées manuelles `api_url` et `base_path`.
Sans surcharge, il utilise l'API de cette refonte : `https://daily-collections-api.onrender.com`.
L'ordre de priorité est entrée manuelle, variable du dépôt, puis cette URL publique.
La première exécution manuelle peut nécessiter que le workflow existe sur la branche par
défaut ; la publication par push sur `main` fonctionne dès que les variables sont prêtes.

Le workflow refuse une URL API absente ou locale. Il publie `apps/web/out/` via les actions
officielles configure-pages, upload-pages-artifact et deploy-pages. Les variables publiques
sont figées au build. Changer l'URL API ou ajouter une collection exige un nouveau build.

Aperçu local en sous-chemin :

```sh
NEXT_PUBLIC_BASE_PATH=/GPT-mot-du-jour-app NEXT_PUBLIC_API_URL=http://localhost:8000 make build
mkdir -p work/pages
ln -sfn ../../apps/web/out work/pages/GPT-mot-du-jour-app
python3 -m http.server 3000 --directory work/pages
```

Ouvrir `http://localhost:3000/GPT-mot-du-jour-app/` puis
`http://localhost:3000/GPT-mot-du-jour-app/mot-du-jour/?date=2025-01-01`.
L'API doit autoriser `http://localhost:3000` dans CORS.

## Transition

Le front Streamlit est remplacé par GitHub Pages. L'API principale utilise
`sh scripts/start-api` et `/api/v1`.

Le service historique conserve sa configuration `pip install -r requirements.txt` puis
`uvicorn api:app --host 0.0.0.0 --port 10000`, compatible Python 3.11+. Les fichiers racine
`requirements.txt` et `api.py` servent uniquement de passerelle : `/` redirige vers le site,
`/motdujour` et `/historique` adaptent les réponses de l'API principale à l'ancien format,
`/api/v1/*` et `/docs` redirigent vers celle-ci. `/health` vérifie sa disponibilité.
Cette passerelle n'a ni base de données, ni calendrier, ni secret Neon ; elle ne remplace
pas l'installation de `apps/api`. La synchronisation reste limitée à l'API principale.

Les échecs Pages antérieurs restent visibles dans l'historique Actions après une publication
réussie. Vérifier le dernier workflow et son étape `Verify published application`.

Sources : [Blueprint Render](https://render.com/docs/blueprint-spec),
[export Next.js](https://nextjs.org/docs/app/guides/static-exports),
[GitHub Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[connexion Neon](https://neon.tech/docs/connect/connect-from-any-app).

## Ressources de la refonte

- API : `daily-collections-api`, région Francfort, offre gratuite, branche `main`.
  [Tableau de bord Render](https://dashboard.render.com/web/srv-dblr8n3bc2fs73a735gg).
- Base : projet Neon `GPT-mot-du-jour-app`, PostgreSQL 17, région `aws-eu-central-1`,
  branche `production`, base `daily_collections`.
  [Console Neon](https://console.neon.tech/app/projects/quiet-truth-97113248).
- Le service historique `gpt-mot-du-jour-app.onrender.com` reste sur `main` avec sa passerelle
  de compatibilité. Son build ne doit pas installer le monorepo Python 3.12.
- Le service de la refonte suit `main` avec déploiement automatique à chaque commit.
  Valider la CI avant de fusionner les changements sur `main`.
- L'URL de connexion Neon est enregistrée uniquement dans l'environnement Render.

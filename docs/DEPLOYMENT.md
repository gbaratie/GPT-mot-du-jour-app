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

Le Blueprint pointe sur `Main-refacto` et désactive le déploiement automatique (`autoDeployTrigger: off`).
La refonte peut être déployée sans fusionner `main`. Vérifier `/health`, `/docs`,
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
3. Exécuter `Deploy web to GitHub Pages` ou publier sur `Main-refacto` / `main`.

Le workflow de déploiement accepte aussi les entrées manuelles `api_url` et `base_path`.
Un push sans variable `NEXT_PUBLIC_API_URL` ignore le déploiement ; la CI s'exécute quand même.
Une exécution manuelle exige une URL API valide (entrée `api_url` ou variable du dépôt).
La première exécution manuelle peut nécessiter que le workflow existe sur la branche par
défaut ; la publication par push sur `Main-refacto` fonctionne dès que les variables sont prêtes.

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

`streamlit run app.py` et `uvicorn api:app` ne s'appliquent plus à cette branche. Mettre à jour
Render et publier le front lors de la bascule vers `/api/v1`. Les anciennes routes sont retirées.
L'application existante déployée conserve son code tant que cette branche n'est pas publiée.

Sources : [Blueprint Render](https://render.com/docs/blueprint-spec),
[export Next.js](https://nextjs.org/docs/app/guides/static-exports),
[GitHub Pages Actions](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages),
[connexion Neon](https://neon.tech/docs/connect/connect-from-any-app).

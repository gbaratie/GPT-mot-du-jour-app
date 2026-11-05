# Instructions pour les agents

Ce dépôt contient une API FastAPI et un front Next.js statique. Lire `docs/ARCHITECTURE.md`
avant de changer leurs contrats, puis le guide adapté dans `docs/agents/`.

- Python 3.12+, Node 22+. Installation : `make install`.
- Vérification : `make check`, `make test`, `make build`.
- Les tests PostgreSQL s'activent avec `TEST_DATABASE_URL` vers une base **de test dédiée**.
  La CI la fournit ; ne jamais utiliser l'URL de production pour les tests.
- `make schemas` régénère les JSON Schema depuis Pydantic ; versionner les changements.
- Garder les accès SQL dans `repositories/`, les règles métier dans `services/`, les
  contrats dans `schemas/`, les schémas de payload dans `collections/`.
- Le front reste exportable : pas de serveur Next.js, de secrets, de cookies serveur
  ou de routes de dates arbitraires. Les collections sont pré-générées depuis le manifeste.
- Dates exactes `YYYY-MM-DD`, jamais de comparaison sur `MM-DD` ni de répétition annuelle.
  « Aujourd'hui » est calculé par l'API dans `Europe/Paris`, pas par l'horloge du navigateur.
- Git (`content/`) est la source éditoriale ; PostgreSQL est la source de lecture de l'API.
  Les migrations gèrent le schéma, `make sync-content` les données.
- Toute modification éditoriale doit passer `make validate`. Ne pas contourner les schémas,
  les contrôles de doublons ou les plages de couverture pour faire passer un fichier invalide.
- Une nouvelle locale réutilise un kind existant quand la forme du payload est identique.
- Pas d'API publique d'écriture dans ce jalon. Ne pas supprimer des archives lors du sync.
- Ne jamais versionner des identifiants Neon/Render. Les variables `NEXT_PUBLIC_*` sont publiques.
- Utiliser `work/` pour les brouillons, caches et données locales ; ce dossier est ignoré.

Ajouts de contenu : `docs/agents/ADD_ENTRIES.md`. Ajouts de collection :
`docs/agents/ADD_COLLECTION.md`. Hébergement : `docs/DEPLOYMENT.md`.

# Ajouter une collection

## Réutiliser un kind

1. Déclarer le slug stable, nom, description, kind, locale, active, sort_order et les plages
   coverage exactes dans `content/collections.json`.
2. Créer `content/<slug>/<année>.json`. Remplir les périodes annoncées : pour une démo de
   trois jours, annoncer trois jours et pas une année complète.
3. Lancer `make validate`, `make check`, `make test`, `make build`.
4. Ajouter des tests API/front si cette collection introduit une nouvelle règle de locale ou
   de présentation. Mettre à jour README et exemples.
5. Synchroniser vers la base autorisée puis reconstruire le front : la route et les liens
   sont générés depuis le manifeste.

Exemple : `mot-anglais-du-jour`, `kind: word`, `locale: en-US` réutilise WordPayload et son
renderer sans nouvelle table. Les collections déjà implémentées sont `mot-du-jour` et
`citation-du-jour` et `enigme-du-jour` ; les autres slugs sont créés uniquement lorsqu'un contenu existe.

## Introduire un kind

1. Définir un modèle strict dans `apps/api/app/collections/registry.py`, l'ajouter à
   PAYLOAD_MODELS et CollectionKind. Refuser champs inconnus et chaînes vides.
2. Étendre la contrainte SQL `ck_kind` avec une **nouvelle migration Alembic**. Ne pas
   modifier une migration déjà déployée ; conserver les données existantes.
3. Étendre les unions discriminées dans `apps/api/app/schemas/` et
   `apps/web/src/lib/api/types.ts`.
4. Ajouter le renderer dans `src/collections/EntryRenderer.tsx`. Le switch est exhaustif.
   Garder le texte échappé par React et les interactions accessibles.
5. Étendre les brouillons dans `scripts/add_entry.py`, lancer `make schemas`, déclarer
   une collection et quelques entrées utilisant le nouveau kind.
6. Tester validation, API, renderer et export de la nouvelle route. Mettre à jour les
   guides et exemples puis exécuter toutes les vérifications.

Le kind d'un slug existant est immuable. Pour désactiver une collection, conserver sa
déclaration avec `active: false`.

---
name: completer-contenus-du-jour
description: Repérer les jours sans contenu d'une collection quotidienne, proposer des mots, énigmes ou autres sujets sans descriptions à validation, puis compléter les données après accord explicite. Utiliser pour remplir ou prolonger tout thème existant.
---

# Compléter les contenus du jour

## Identifier la collection et la période

Lire `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/agents/ADD_ENTRIES.md`, le manifeste
`content/collections.json` et les fichiers de la collection. Vérifier le schéma
Pydantic du kind dans `apps/api/app/collections/registry.py` et les contraintes
éditoriales : langue, public, niveau, sources, répétitions souhaitées ou interdites.
Ne pas imposer les champs d'un mot aux autres types de contenu.

Choisir le slug d'après la demande ; demander une précision seulement si plusieurs
collections conviennent. Si la collection n'existe pas, utiliser le skill voisin
`creer-theme-du-jour`. Déterminer les bornes inclusives de la période. Si aucun
horizon ne peut être déduit de la demande ou des consignes, demander une période.

Dans ce dépôt, les dates sont absolues (`publication_date: YYYY-MM-DD`) et le jour
courant suit `Europe/Paris`. Les archives d'une autre année ne remplissent pas
l'année demandée. Ne jamais réintroduire une sélection sur `MM-DD`. Une réutilisation
éditoriale explicitement demandée est publiée à de nouvelles dates, sans déplacer
les archives ni activer une répétition automatique. Gérer correctement le 29 février.

## Auditer et préparer le lot

1. Lire et valider les fichiers sans modifier les données. Énumérer tous les jours
   attendus avec un outil de calendrier puis comparer aux dates présentes.
2. Distinguer jours absents, champs incomplets et doublons. Ne pas écraser une entrée
   existante sans demande explicite. Annoncer période et nombre de jours manquants.
   S'il n'en manque aucun, le dire et s'arrêter.
3. Préparer une proposition par jour absent, adaptée au thème. Vérifier répétitions
   dans le lot et la collection (casse, espaces, formes proches et sens). Respecter
   une réutilisation explicitement autorisée plutôt que la remplacer silencieusement.
4. Vérifier que chaque sujet permet un contenu fiable : énigme résoluble avec les
   hypothèses données ; citation ou fait avec attribution vérifiée. Ne pas inventer
   de sources. Remplacer les propositions incertaines avant leur présentation.

Conserver si nécessaire le brouillon dans `work/drafts/`, ignoré par Git et jamais
synchronisé ; ne pas écrire de contenu non approuvé dans `content/`.

## Validation obligatoire des propositions

Présenter un tableau avec uniquement **date** et **proposition** : le mot, l'énoncé
complet de l'énigme, le titre ou le sujet permettant de choisir. Ne pas afficher de
définition, description, exemple, indice, réponse, solution, explication ou source
détaillée. Pour une énigme, un titre seul ne suffit pas à valider l'énoncé.

Demander explicitement la validation du lot ou les remplacements souhaités, puis
attendre la réponse. Expliquer que cette étape vient de ce skill et de la demande
initiale de l'utilisateur. Un silence, une question ou une retouche ne vaut pas accord.
Une approbation explicite du lot exact donnée plus tôt reste valable : ne pas la
redemander. Un accord partiel autorise seulement les propositions approuvées. Toute
proposition remplacée ou reformulée sur le fond doit être soumise à nouveau.

## Ajouter les contenus approuvés

Rédiger les champs complémentaires selon le kind : `term`, `definition`, `example`
pour un mot ; `question`, `answer`, `hint` optionnel pour une énigme ; `text`, `author`,
`source` optionnelle pour une citation. L'explication d'une énigme complète `answer`
et reste masquée avec la réponse ; ne pas l'ajouter comme indice visible. Pour un
nouveau kind, suivre son contrat réel. Préserver exactement les sujets approuvés.
Si un problème exige un nouvel énoncé, revenir à sa validation.

Relire les fichiers juste avant l'écriture. Préserver les contenus apparus depuis
l'audit et signaler les conflits. Ajouter les entrées dans
`content/<slug>/<année>.json` avec `{publication_date, payload}` ; utiliser
`scripts/add_entry.py` pour une entrée ou mettre à jour fichier annuel et `coverage`
pour un lot. Conserver le tri, les archives et le schéma. Ne pas fragmenter la
couverture pour masquer des trous. La validation ne doit jamais être désactivée.

## Vérifier et rendre compte

Exécuter `make validate` et `make test`, ainsi que les autres contrôles exigés par
les consignes locales. Vérifier dates, champs non vides, absence de doublons,
couverture complète du lot, identité des énoncés validés et diff des entrées existantes.
Utiliser uniquement une base locale ou de test pour les vérifications. Le contenu
Git est la source éditoriale ; l'API lit la base après synchronisation.

Rapporter nombre ajouté, période, fichiers et éventuels jours en attente, sans
révéler les solutions. Ne synchroniser la base distante, fusionner ou déployer que
si ces actions sont demandées ; une autorisation déjà donnée reste valable.

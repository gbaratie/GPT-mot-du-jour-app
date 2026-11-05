---
name: creer-theme-du-jour
description: Concevoir et mettre en place une collection quotidienne, comme l'énigme du jour, dans les données, l'API et le front. Utiliser pour un nouveau thème ou kind, puis passer au skill de remplissage pour valider les contenus.
---

# Créer un thème du jour

Un thème est ici une rubrique quotidienne : mot, énigme, recette, etc. Dans ce
repo, une rubrique correspond à une **collection**, tandis que le **kind** définit
son schéma et son rendu. Un sujet éditorial (par exemple « les mots de la nature »)
peut aussi appartenir à une collection existante. Clarifier seulement si cette
ambiguïté change l'implémentation. Une demande de conception seule appelle une
proposition documentée ; une demande de mise en place autorise l'implémentation.

## Examiner et cadrer

Lire `AGENTS.md`, `docs/ARCHITECTURE.md`, `docs/agents/ADD_COLLECTION.md`,
`docs/agents/ADD_ENTRIES.md` et le code réel. L'architecture est Next.js statique
sur GitHub Pages, FastAPI sur Render, données de lecture PostgreSQL/Neon et
source éditoriale versionnée dans `content/`. Les anciennes routes et Streamlit
ne sont plus utilisés.

Déduire les choix évidents, annoncer les hypothèses et avancer. Poser uniquement
les questions bloquantes : type ambigu, public ou contraintes décisives. Ne pas
redemander l'autorisation générale déjà donnée. Traiter séparément la validation
des nouveaux contenus.

## Définir le contrat

Documenter nom affiché, slug stable, kind, locale, public, niveau, ligne éditoriale,
champs requis/optionnels, sources, identité du sujet à valider, stockage, couverture,
comportement des absences et interactions. Les dates sont absolues et le jour courant
suit Europe/Paris. Ne pas introduire de cycle annuel implicite. Une publication par
jour et collection ; les archives restent disponibles.

Réutiliser un kind existant quand son payload convient. Les kinds `word`, `quote`
et `riddle` sont déjà pris en charge. Une nouvelle locale n'exige pas un nouveau
kind si le schéma est identique. Garder les contrats et données existants.

## Mettre en place de bout en bout

Pour un kind existant : déclarer la collection dans `content/collections.json`,
ajouter `content/<slug>/<année>.json` avec une couverture exacte correspondant
aux publications approuvées. La navigation et la route statique sont générées
depuis le manifeste. Le schéma de la base ne change pas. Ne pas annoncer une
collection active vide : le validateur exige des fichiers et une couverture.
Préparer la structure en brouillon dans `work/` jusqu'à l'accord sur un premier
lot si aucun contenu n'est encore approuvé.

Pour un nouveau kind, suivre `docs/agents/ADD_COLLECTION.md` : modèle strict dans
le registre Pydantic, unions API et TypeScript, contrainte SQL par **nouvelle**
migration Alembic, renderer exhaustif, brouillons du script d'ajout et schémas
via `make schemas`. Ne pas modifier une migration déjà déployée. Garder les accès
SQL dans repositories, le métier dans services et les contrats dans schemas.

Le front doit rester exportable, sans secrets ni serveur Next.js. Échapper le
texte avec React ; ne pas injecter de HTML éditorial. Traiter absence et erreurs.
Mettre à jour le README et les guides pour la nouvelle collection.

### Exemple : énigme du jour

Utiliser `kind: riddle`, avec `question`, `answer` et éventuellement `hint`.
La proposition à valider est l'énoncé complet `question`, sans réponse,
explication ni indice. Une explication peut compléter le champ `answer` :
elle doit rester masquée avec la réponse et non s'afficher comme un indice.

Afficher d'abord l'énoncé et un bouton accessible de révélation. Garder les
solutions masquées aussi dans l'historique et après changement de date. L'API
transmet les réponses : leur masquage visuel n'est pas une protection secrète.
Réutiliser le renderer existant s'il convient plutôt que le dupliquer.

## Alimenter et vérifier

Utiliser [completer-contenus-du-jour](../completer-contenus-du-jour/SKILL.md) pour
le premier lot et les suivants. Ce skill exige une approbation explicite des
propositions avant leur ajout réel. Ne pas contourner cette étape avec des
contenus « exemples » ou « seed ». Les fixtures isolées restent hors publication.
L'approbation explicite d'un lot exact reste valable après adaptation technique.

Exécuter `make validate`, `make check`, `make test`, `make build` ; vérifier les
routes du nouveau thème, l'historique, l'isolation, les frontières de dates et
la non-régression des collections existantes. Tester toute nouvelle interaction.
Pour une énigme, vérifier la révélation et l'état initial masqué. Vérifier que
l'export contient la nouvelle route sous le basePath attendu.

La mise en ligne demande synchronisation et reconstruction du front. Respecter
`docs/DEPLOYMENT.md` ; utiliser une base dédiée aux tests. Ne pas créer de ressource
payante ni déployer sans demande correspondante. Présenter le comportement obtenu,
les contrôles, fichiers et état des contenus (approuvés ou en attente).

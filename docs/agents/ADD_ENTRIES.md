# Ajouter des entrées

1. Lire `content/collections.json` pour choisir slug, kind et locale.
2. Préparer textes et sources. Ne pas inventer d'attributions ou déplacer une publication
   existante pour remplir un trou. Les dates sont exactes, au format `YYYY-MM-DD`.
3. Créer un brouillon :

   ```sh
   make add-entry COLLECTION=mot-du-jour DATE=2026-11-05
   ```

   Compléter `work/drafts/mot-du-jour-2026-11-05.json`, puis :

   ```sh
   make add-entry COLLECTION=mot-du-jour DATE=2026-11-05 PAYLOAD=work/drafts/mot-du-jour-2026-11-05.json
   ```

   Le script refuse les doublons, valide le payload puis ajoute l'entrée au fichier annuel
   et étend coverage. Une copie temporaire est validée avant écriture. Le brouillon seul
   n'est jamais synchronisé.
4. Pour une plage entière, modifier le fichier annuel et annoncer la plage dans coverage.
   `make validate` détecte les trous, doublons et dates hors couverture. Ne pas fragmenter
   artificiellement la couverture pour masquer des publications manquantes.
5. Lancer `make validate` et `make test`. `content/schemas/` contient les JSON Schema générés ;
   Pydantic reste la définition canonique. Ne pas désactiver de validateur.
6. Aperçu : `make migrate && make sync-content`, démarrer API et front puis ouvrir
   `/<slug>/?date=YYYY-MM-DD`. Relire texte, accents, date et source.
7. Relire le diff Git, notamment toutes les dates de la plage. Synchroniser la base distante
   uniquement dans l'environnement prévu pour la publication.

Le sync valide tout avant de se connecter, puis effectue des upserts transactionnels.
Le relancer ne duplique rien et ne supprime aucune archive. Corriger le payload à date
égale met à jour la publication ; changer la date ou le slug nécessite une décision éditoriale.

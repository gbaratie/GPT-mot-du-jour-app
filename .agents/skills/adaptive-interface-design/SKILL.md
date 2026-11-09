---
name: adaptive-interface-design
description: Concevoir et améliorer une interface web éditoriale ou applicative harmonieuse avec des compositions distinctes sur ordinateur et mobile. Utiliser pour une refonte visuelle, une expérience mobile, une interface compacte ou un audit de design adaptatif.
---

# Interfaces adaptatives

Concevoir une expérience complète adaptée à la place disponible et aux moyens d’interaction. Ce skill est autonome : copier ce dossier dans `.agents/skills/` d’un autre projet. Il ne suppose ni framework, ni palette, ni dépendance particulière.

## 1. Comprendre avant de dessiner

Lire les instructions du dépôt, identifier la bibliothèque UI, les routes, les contrats de données et les états existants. Conserver les fonctionnalités, les URLs et les contraintes de déploiement. Observer l’écran actuel dans un navigateur avant de conclure sur ses défauts.

Définir l’action principale, l’information à lire immédiatement et les informations secondaires. Choisir une direction visuelle explicite adaptée au produit : typographie, contraste, densité, rythme, couleurs. Réutiliser les composants accessibles existants avant d’ajouter une bibliothèque.

## 2. Concevoir deux compositions

- Ordinateur : exploiter la largeur pour la comparaison ou le contexte, avec des colonnes dont la longueur de lecture reste confortable.
- Mobile : une tâche ou une découverte au premier plan. Transformer les colonnes parallèles en sélection explicite, navigation ou divulgation progressive lorsque cela sert l’usage. Conserver l’accès à chaque contenu.
- Choisir les seuils selon le contenu qui ne tient plus, pas selon une marque d’appareil. Prévoir aussi les tailles intermédiaires et le paysage.
- Viser une vue initiale avec information principale et commandes visibles. Établir un budget vertical à partir de la hauteur réelle, du header, des marges et des contrôles.
- Préférer `min-height: 100svh` pour une page et `100dvh` pour un véritable shell d’application. Éviter les hauteurs rigides pour le contenu éditorial.
- Le contenu long, le zoom et un clavier ouvert doivent pouvoir faire défiler la page. Ne jamais cacher du texte ni réduire arbitrairement sa taille pour promettre un écran unique. Une archive est naturellement un document défilant.

## 3. Construire une grammaire visuelle

Centraliser les couleurs sémantiques, typographies, espacements, rayons et surfaces dans le thème existant. Limiter les accents et les niveaux de surface. Donner une hiérarchie nette aux titres, au texte et aux métadonnées. Employer une échelle d’espacement cohérente et une longueur de ligne raisonnable. Soigner aussi les états vide, erreur, chargement, contenu absent et réponse révélée.

## 4. Soigner les interactions

Conserver le HTML sémantique, les labels, la navigation clavier et un focus visible. Les contrôles tactiles ont une cible d’environ 44 × 44 px minimum ; les champs utilisent au moins 16 px sur mobile. Ne jamais interdire le zoom. Respecter les safe areas et `viewport-fit=cover` si nécessaire. Réserver les styles hover à `(hover: hover) and (pointer: fine)`. Les actions doivent donner un retour à la pression ; le contenu doit rester sélectionnable.

Utiliser une sélection native ou des composants accessibles de la bibliothèque. Si des onglets sont nécessaires, implémenter aussi leurs rôles, relations et touches fléchées ; ne pas ajouter seulement `role=tab`. Ne jamais rendre une action uniquement gestuelle.

N’ajouter du mouvement que pour expliquer un état ou une relation. Garder les transitions brèves, cibler leurs propriétés et respecter `prefers-reduced-motion`. Ne pas installer un moteur d’animation pour une interface essentiellement statique.

## 5. Vérifier le résultat réel

Capturer au minimum 390 × 844, 360 × 640, 768 × 1024 et 1440 × 900. Vérifier aussi 320 px de large, un paysage court et le zoom à 200 %. Vérifier les débordements horizontaux, les commandes principales, l’ordre du focus et l’accès à tout le contenu.

Tester avec du contenu réel puis des valeurs longues, un seul élément, beaucoup d’éléments, zéro élément, erreur réseau et chargement. Exercer chaque contrôle changé. Les données simulées servent uniquement aux tests ; ne pas inventer du contenu de production.

Exécuter les vérifications du dépôt. Distinguer les tests de navigateur des tests sur appareil : Safari, clavier logiciel, safe areas et sensation tactile nécessitent une validation matérielle. Rapporter précisément ce qui a été vérifié et les limites restantes. Garder les captures locales hors des sources si le dépôt prévoit un dossier de travail ignoré.

## Références complémentaires

Recommandations originales de ce skill, sans dépendance à une installation externe. Les skills d’[Emil Kowalski](https://github.com/emilkowalski/skills) sont des compléments utiles : `emil-design-eng` pour la finition et les décisions de mouvement, `mobile-native` pour les particularités du navigateur mobile, `break-ui` pour les contenus limites. Ils ne remplacent pas l’architecture de l’information ni la vérification de la composition sur les deux formats.

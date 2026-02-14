#!/usr/bin/env python3
"""Script pour ajouter les mots manquants (juillet 2025 + sept-déc 2025)."""
import json
from pathlib import Path

# Chemin vers words.json (racine du projet)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
WORDS_PATH = PROJECT_ROOT / "words.json"

# 153 entrées : (word, definition, example) pour les jours manquants
NEW_ENTRIES = [
    # Juillet 2025 (31 jours)
    ("Estival", "Relatif à l'été.", "La chaleur estivale incitait à la sieste."),
    ("Intégrité", "Honnêteté, probité morale.", "Son intégrité lui a valu le respect de tous."),
    ("Persistance", "Fait de durer, de se maintenir.", "La persistance de l'image sur l'écran était visible."),
    ("Cohorte", "Groupe de personnes partageant une même caractéristique.", "Une cohorte d'étudiants a participé à l'étude."),
    ("Séquelle", "Conséquence durable d'un événement passé.", "L'accident lui a laissé des séquelles permanentes."),
    ("Léthargie", "État d'engourdissement, d'inactivité.", "La canicule plongeait la ville dans une léthargie."),
    ("Éphémère", "De très courte durée.", "Le bonheur des vacances est souvent éphémère."),
    ("Cathartique", "Qui purifie, qui libère des émotions.", "Pleurer peut avoir un effet cathartique."),
    ("Ténacité", "Persévérance, obstination.", "Sa ténacité a fini par payer."),
    ("Magnanime", "Généreux, indulgent envers les autres.", "Il a fait preuve d'une décision magnanime."),
    ("Proscrit", "Exclu, interdit par la loi ou l'usage.", "Ce comportement est proscrit dans l'entreprise."),
    ("Inanition", "État d'affaiblissement par manque de nourriture.", "Le prisonnier était en état d'inanition."),
    ("Soporifique", "Qui provoque le sommeil, ennuyeux.", "Son discours soporifique endormait l'auditoire."),
    ("Concis", "Qui s'exprime en peu de mots.", "Sa réponse concise en disait long."),
    ("Vétuste", "Très vieux, délabré.", "Le bâtiment vétuste menaçait de s'effondrer."),
    ("Prodigalité", "Dépense excessive, gaspillage.", "Sa prodigalité l'a conduit à la ruine."),
    ("Invective", "Parole violente pour attaquer quelqu'un.", "Il s'est lancé dans une invective contre son adversaire."),
    ("Récréance", "Manquement à un engagement, faiblesse.", "Sa récréance a déçu ses partisans."),
    ("Sagace", "Perspicace, qui fait preuve de jugement.", "Un critique sagace a relevé les faiblesses du livre."),
    ("Dilatoire", "Qui retarde, qui cherche à gagner du temps.", "Ces manœuvres dilatoires ont irrité le tribunal."),
    ("Élégiaque", "Qui exprime la mélancolie, la nostalgie.", "Le film se termine sur une note élégiaque."),
    ("Prosaïque", "Banal, sans poésie.", "La réalité prosaïque a tempéré son enthousiasme."),
    ("Incommensurable", "Sans mesure commune, immense.", "Sa gratitude était incommensurable."),
    ("Rétif", "Qui résiste, refuse d'obéir.", "Le cheval rétif refusait d'avancer."),
    ("Séditieux", "Qui incite à la révolte contre l'autorité.", "Des tracts séditieux circulaient dans la ville."),
    ("Taciturne", "Peu enclin à parler, silencieux.", "Ce collègue taciturne reste mystérieux."),
    ("Velléité", "Intention vague sans passage à l'acte.", "Il n'eut que des velléités de révolte."),
    ("Usurpateur", "Personne qui s'empare du pouvoir illégitimement.", "L'usurpateur a été chassé du trône."),
    ("Xénophile", "Qui aime les étrangers, les cultures lointaines.", "Son esprit xénophile l'a poussé à voyager."),
    ("Zénith", "Point le plus haut ; apogée.", "Sa carrière était alors à son zénith."),
    ("Amène", "Agréable, doux envers les autres.", "Il avait des manières amènes qui rassuraient."),
    # Septembre 2025 (30 jours)
    ("Béat", "Qui exprime une satisfaction naïve.", "Un sourire béat illuminait son visage."),
    ("Cabalistique", "Mystérieux, incompréhensible pour les non-initiés.", "Des formules cabalistiques ornaient le manuscrit."),
    ("Dégingandé", "Dont les mouvements sont mal coordonnés.", "Un adolescent dégingandé traversait la cour."),
    ("Égrillard", "Légèrement grivois, un peu osé.", "Il a raconté une anecdote égrillarde."),
    ("Fébrile", "Agité, nerveux, fiévreux.", "L'attente fébrile du résultat l'épuisait."),
    ("Gouaille", "Moquerie familière, esprit facétieux.", "Il répondait avec sa gouaille habituelle."),
    ("Hétéroclite", "Formé d'éléments disparates.", "Une foule hétéroclite se pressait au marché."),
    ("Iconoclaste", "Qui s'attaque aux idées reçues.", "Ce penseur iconoclaste bouscule les conventions."),
    ("Jérémiade", "Plainte longue et monotone.", "Il nous a assommés de ses jérémiades."),
    ("Kafkaïen", "Absurde, angoissant, comme dans l'univers de Kafka.", "La situation était kafkaïenne."),
    ("Infime", "Extrêmement petit.", "Des détails infimes ont retardé le projet."),
    ("Melliflu", "Doux et fluide en parlant de la voix.", "Une voix melliflue récitait le poème."),
    ("Nébulieux", "Flou, peu clair.", "Ses explications restaient nébuleuses."),
    ("Ostensible", "Montré de façon visible, volontaire.", "Il évitait ostensiblement son regard."),
    ("Péjoratif", "Qui déprécie, qui a une connotation négative.", "Ce terme est péjoratif dans ce contexte."),
    ("Quiddité", "Nature propre d'une chose, essence.", "La quiddité du bien fait débat en philosophie."),
    ("Réprobation", "Désapprobation forte.", "Son acte a suscité la réprobation générale."),
    ("Stratégème", "Ruse, manœuvre habile.", "Il a utilisé un stratagème pour les convaincre."),
    ("Truculent", "Haut en couleur, pittoresque.", "Un personnage truculent animait la soirée."),
    ("Ubuesque", "Grotesque, démesuré comme le Père Ubu.", "La réunion avait tourné à l'ubuesque."),
    ("Vindicatif", "Porté à la vengeance.", "Il est devenu vindicatif après l'affront."),
    ("Wagnérien", "Grandiose, emphatique comme l'œuvre de Wagner.", "Une mise en scène wagnérienne."),
    ("Xérophyte", "Plante adaptée à la sécheresse.", "Les xérophytes peuplent les déserts."),
    ("Yiddish", "Langue des juifs d'Europe centrale et orientale.", "Il parlait le yiddish avec sa grand-mère."),
    ("Zénithal", "Relatif au zénith, au point le plus haut.", "Le soleil était à son point zénithal."),
    ("Abyssal", "Très profond, insondable.", "Un silence abyssal régnait dans la grotte."),
    ("Belligérant", "En état de guerre ; agressif.", "Un ton belligérant a envenimé le débat."),
    ("Cynique", "Qui méprise les valeurs, désabusé.", "Une remarque cynique a glacé l'assemblée."),
    ("Diaphane", "Très transparent, délicat.", "Une peau diaphane laissait voir ses veines."),
    ("Éthéré", "Immatériel, léger comme l'éther.", "Une musique éthérée baignait la salle."),
    # Octobre 2025 (31 jours)
    ("Fructueux", "Qui produit des résultats.", "L'entretien a été fructueux."),
    ("Géhenne", "Souffrance intense, enfer.", "Ces semaines furent une véritable géhenne."),
    ("Hédoniste", "Qui recherche le plaisir.", "Une philosophie hédoniste guide sa vie."),
    ("Idiosyncrasie", "Caractéristique propre à un individu.", "Son idiosyncrasie le rendait imprévisible."),
    ("Jubilatoire", "Qui provoque la joie.", "Une fin jubilatoire a conclu le spectacle."),
    ("Képi", "Coiffure militaire à visière.", "Le gendarme ajusta son képi."),
    ("Lénifiant", "Qui endort, qui apaise excessivement.", "Un discours lénifiant ne règle pas les problèmes."),
    ("Métaphore", "Figure de style par comparaison implicite.", "La métaphore du navire pour l'État est classique."),
    ("Néologisme", "Mot ou sens nouveau.", "Ce néologisme est entré dans le dictionnaire."),
    ("Ostracisme", "Exclusion d'un groupe.", "Il a subi l'ostracisme de ses pairs."),
    ("Palingénésie", "Renaissance, régénération.", "La palingénésie de la nature au printemps."),
    ("Quintessence", "Ce qu'il y a de plus pur, de plus parfait.", "Elle incarnait la quintessence de l'élégance."),
    ("Rhapsodie", "Œuvre musicale ou littéraire libre de forme.", "Une rhapsodie en hommage à la ville."),
    ("Syllogisme", "Raisonnement en deux prémisses et une conclusion.", "Le syllogisme peut conduire à l'erreur si les prémisses sont fausses."),
    ("Tautologique", "Qui répète la même idée autrement.", "Cette phrase est tautologique."),
    ("Utopique", "Irréaliste, idéal mais irréalisable.", "Un projet utopique mais séduisant."),
    ("Verbeux", "Qui use de trop de mots.", "Un orateur verbeux a ennuyé l'audience."),
    ("Wattman", "Conducteur de tramway (vieilli).", "Le wattman annonça la prochaine station."),
    ("Xénophobe", "Qui craint ou rejette les étrangers.", "Un discours xénophobe a choqué l'assemblée."),
    ("Yole", "Embarcation légère à rames.", "Une yole glissait sur l'étang."),
    ("Zénonien", "Relatif à Zénon, paradoxal.", "Un raisonnement zénonien sur l'infini."),
    ("Apathie", "Manque d'émotion, d'énergie.", "L'apathie des électeurs inquiète."),
    ("Borborygme", "Bruit produit par le tube digestif.", "Un borborygme trahit sa faim."),
    ("Cacographie", "Mauvaise orthographe.", "La cacographie de ce texte le rend illisible."),
    ("Déontologie", "Ensemble des devoirs professionnels.", "La déontologie médicale impose le secret."),
    ("Éristique", "Art de la controverse.", "Il excellait dans l'éristique."),
    ("Fulminant", "Très rapide ; qui exprime une colère violente.", "Une réaction fulminante a suivi l'annonce."),
    ("Gymnastique", "Exercice du corps ; ici au figuré : exercice intellectuel.", "Une gymnastique mentale s'imposait."),
    ("Hapax", "Mot ou forme n'apparaissant qu'une fois.", "Ce mot est un hapax dans la littérature."),
    ("Idylle", "Relation amoureuse harmonieuse.", "Une idylle d'été s'était nouée."),
    ("Jactance", "Vantardise, arrogance.", "Sa jactance finissait par agacer."),
    ("Kermesse", "Fête populaire, souvent de bienfaisance.", "La kermesse du village a réuni tout le monde."),
    ("Minuscule", "Extrêmement petit.", "Des économies minuscules."),
    ("Allégorie", "Image développée à valeur symbolique.", "L'allégorie filée structure le poème."),
    ("Néophyte", "Débutant dans une discipline.", "Un néophyte en œnologie."),
    ("Oligarchie", "Gouvernement d'un petit nombre.", "Certains dénoncent une oligarchie financière."),
    ("Pandémonium", "Désordre bruyant, chaos.", "Le pandémonium régnait dans la salle."),
    # Novembre 2025 (30 jours)
    ("Quenelle", "Préparation culinaire ; geste de défi (contemporain).", "Il a osé une quenelle en public."),
    ("Récusation", "Refus de participer pour cause de partialité.", "La récusation du juge a été acceptée."),
    ("Syllabe", "Unité phonétique du mot.", "Ce mot compte trois syllabes."),
    ("Redondant", "Qui répète inutilement la même idée.", "Cette définition est redondante."),
    ("Utopiste", "Qui croit en un idéal irréalisable.", "Un utopiste visionnaire."),
    ("Vexatoire", "Qui humilie, qui vexe.", "Une remarque vexatoire l'a blessé."),
    ("Wisigoth", "Relatif aux Wisigoths.", "L'art wisigoth marque l'Espagne."),
    ("Xylophone", "Instrument de musique à lames.", "L'enfant jouait du xylophone."),
    ("Yoga", "Discipline corporelle et mentale.", "Le yoga l'aidait à se détendre."),
    ("Paradoxal", "Qui contient ou soulève un paradoxe.", "Un débat paradoxal."),
    ("Aboulie", "Perte de la volonté.", "L'aboulie le paralysait."),
    ("Béatitude", "Bonheur parfait, état de félicité.", "Une expression de béatitude illuminait son visage."),
    ("Cohésion", "Lien qui unit les parties.", "La cohésion du groupe s'est renforcée."),
    ("Déférence", "Respect, considération.", "Il a traité son aîné avec déférence."),
    ("Élision", "Suppression d'une voyelle en fin de mot.", "L'élision est courante en poésie."),
    ("Frugalité", "Modération dans la nourriture.", "La frugalité était de mise."),
    ("Gratuité", "Caractère de ce qui est gratuit.", "La gratuité des musées le dimanche."),
    ("Hédonisme", "Philosophie du plaisir.", "L'hédonisme antique prône la mesure."),
    ("Inanition", "Épuisement par manque de nourriture.", "Il était en état d'inanition."),
    ("Jovial", "Gai, enjoué.", "Un convive jovial animait la table."),
    ("Kakemphaton", "Jeu de mots involontairement comique.", "Un kakemphaton a fait rire la classe."),
    ("Lapidaire", "Concis, incisif.", "Une formule lapidaire a résumé le débat."),
    ("Métonymie", "Figure par laquelle on désigne un concept par un autre lié.", "La couronne pour la royauté est une métonymie."),
    ("Népotisme", "Favoritisme envers sa famille.", "Le népotisme a miné l'institution."),
    ("Onomatopée", "Mot qui imite un bruit.", "Bang est une onomatopée."),
    ("Paradigme", "Modèle, cadre de pensée.", "Un changement de paradigme s'impose."),
    ("Quolibet", "Moquerie, trait d'esprit.", "Il lançait des quolibets à la cantonade."),
    ("Réticence", "Réserve, hésitation à dire.", "Sa réticence en disait long."),
    ("Synecdoque", "Figure où la partie désigne le tout.", "Une voile pour un bateau : synecdoque."),
    ("Tautologie", "Répétition inutile du même sens.", "C'est une tautologie évidente."),
    # Décembre 2025 (31 jours)
    ("Univoque", "Qui n'a qu'un seul sens.", "Une réponse univoque était attendue."),
    ("Verbose", "Trop bavard.", "Une prose verbose."),
    ("Wisigothique", "Relatif aux Wisigoths.", "L'architecture wisigothique."),
    ("Xénoglossie", "Capacité à parler une langue non apprise.", "La xénoglossie intrigue les scientifiques."),
    ("Yin", "Principe féminin, passif (taoïsme).", "L'équilibre entre le yin et le yang."),
    ("Zéro", "Rien ; symbole numérique.", "Repartir de zéro."),
    ("Abysse", "Profondeur extrême.", "Les abysses océaniques restent mystérieux."),
    ("Bénédiction", "Parole ou geste qui appelle le bien.", "La bénédiction du prêtre."),
    ("Célérité", "Rapidité.", "Il a agi avec célérité."),
    ("Décrépitude", "État de grande vieillesse.", "La décrépitude du bâtiment."),
    ("Élégance", "Grace, raffinement.", "L'élégance de la solution."),
    ("Faste", "Luxe, magnificence.", "Un dîner fastueux."),
    ("Gravité", "Sérieux, importance.", "La gravité de la situation."),
    ("Humilité", "Modestie, absence d'orgueil.", "Il a accepté avec humilité."),
    ("Incipit", "Début d'un texte.", "L'incipit du roman est célèbre."),
    ("Jubilation", "Joie intense.", "La jubilation de la foule."),
    ("Kitsch", "De mauvais goût, tape-à-l'œil.", "Une décoration kitsch."),
    ("Lucidité", "Clarté de l'esprit.", "Garder sa lucidité en toute circonstance."),
    ("Melliflu", "Doux et coulant.", "Une voix melliflue."),
    ("Nostalgie", "Regret du passé.", "La nostalgie des vacances."),
    ("Ovation", "Applaudissement chaleureux.", "Une ovation debout."),
    ("Pédagogue", "Qui sait enseigner.", "Un pédagogue hors pair."),
    ("Quintessence", "Ce qu'il y a de plus pur.", "La quintessence de l'art."),
    ("Révérence", "Salut respectueux.", "Il s'inclina avec révérence."),
    ("Sagesse", "Savoir vivre, discernement.", "La sagesse des anciens."),
    ("Ténèbres", "Obscurité complète.", "Les ténèbres de la nuit."),
    ("Unanime", "Dont tous sont d'accord.", "Un accord unanime."),
    ("Véhémence", "Fougue, violence dans l'expression.", "Répondre avec véhémence."),
    ("Wisigoth", "Membre du peuple wisigoth.", "Les Wisigoths ont conquis l'Espagne."),
    ("Xénophile", "Qui aime l'étranger.", "Un esprit xénophile."),
    ("Yole", "Petite embarcation.", "Une yole sur le lac."),
    ("Zénith", "Point le plus haut.", "À son zénith."),
]


def main():
    with open(WORDS_PATH, "r", encoding="utf-8") as f:
        words = json.load(f)

    existing_dates = {w["date"] for w in words}

    # Générer les dates manquantes : 2025-07-01 -> 2025-07-31, puis 2025-09-01 -> 2025-12-31
    missing_dates = []
    for month, day_end in [(7, 31), (9, 30), (10, 31), (11, 30), (12, 31)]:
        for day in range(1, day_end + 1):
            d = f"2025-{month:02d}-{day:02d}"
            if d not in existing_dates:
                missing_dates.append(d)

    entries_to_use = NEW_ENTRIES[:len(missing_dates)]
    if len(entries_to_use) < len(missing_dates):
        raise ValueError(f"Pas assez d'entrées : {len(entries_to_use)} pour {len(missing_dates)} dates.")

    for i, date in enumerate(missing_dates):
        word, definition, example = entries_to_use[i]
        words.append({
            "date": date,
            "word": word,
            "definition": definition,
            "example": example,
        })

    words.sort(key=lambda w: w["date"])

    with open(WORDS_PATH, "w", encoding="utf-8") as f:
        json.dump(words, f, ensure_ascii=False, indent=2)

    print(f"✓ {len(missing_dates)} mots ajoutés. Total : {len(words)} entrées (année 2025 complète).")


if __name__ == "__main__":
    main()

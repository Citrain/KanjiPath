# Documentation KanjiPath

Plateforme web d'apprentissage progressif des kanji — parcours **aligné sur le JLPT**
(N5 → N1). Les listes de kanji ne sont jamais présentées comme « officielles JLPT ».

## Index

| Document | Contenu |
|---|---|
| [architecture/overview.md](./architecture/overview.md) | Stack, structure du monorepo, flux de données, authentification/sécurité |
| [content/pipeline.md](./content/pipeline.md) | Pipeline de contenu : download → import → normalize → generate → validate → publish |
| [content/licensing.md](./content/licensing.md) | Sources de données, licences, provenance, règles d'attribution |
| [operations/development.md](./operations/development.md) | Environnement local (sans Docker), MariaDB, scripts de lancement |
| [operations/deployment.md](./operations/deployment.md) | Environnements, production, vérifications |
| [operations/local-ai.md](./operations/local-ai.md) | Préparation Windows des services locaux de conversation et Quiz IA |
| [adr/README.md](./adr/README.md) | Pointeur vers l'ADR-001 et son découpage par tâche |
| [agent/guide.md](./agent/guide.md) | Guide pour agent de code : conventions, pièges connus, recettes |

## Références premières

- **ADR-001** : `../ADR-001-plateforme-apprentissage-kanji.md` (racine) — décision
  d'architecture complète. Découpage opérationnel dans `../adr/`.
- **ADR-003** : `../ADR-003-conversation-vocale-japonais-locale.md` — mode
  conversation vocal local, fournisseurs STT/LLM/TTS et contraintes pédagogiques.
- **ADR-004 a ADR-011** : voir [`adr/README.md`](./adr/README.md) — Quiz IA local et
  extensions produit acceptees : mission quotidienne, carte kanji, carnet personnel,
  shadowing, immersion, timeline des erreurs et mode zen.
- **Règles agent** : `../AGENTS.md`.
- **Démarrage rapide** : `../README.md`.

## État actuel (Phase 5 — audio et dictée en cours de publication)

Ce qui est implémenté :

- Monorepo pnpm : `apps/api` (NestJS 11 + Fastify), `apps/web` (React 19 + Vite 8 +
  Tailwind 4), `packages/contracts|domain|content-schema|ui`.
- Base MariaDB : identité (`users`, `user_settings`, `sessions`) + contenu
  (kanji, sens, lectures, radicaux, composants, notes, curricula, vocabulaire,
  phrases, exercices) + progression (`review_cards`, `review_logs`,
  `user_kanji_progress`, `study_sessions`, `study_session_items`) + provenance
  (`content_sources`, `content_versions`, `content_issues`).
- Authentification : inscription, connexion, déconnexion, `me`, changement de mot de
  passe. Argon2id, cookie de session `HttpOnly`, CSRF double-submit, rate-limiting.
- Domaine : moteur FSRS (`ts-fsrs`) encapsulé, calcul de maîtrise pondéré.
- Pipeline de contenu complet **multi-niveaux** : download → import → normalize →
  generate → validate → report → publish → load. Référentiels curatés **N5**
  (80 kanji), **N4** (166 kanji), **N3** (373 kanji), **N2** (368 kanji) et **N1**
  (415 kanji publiés dans le pack initial, 817 en cours de curation) — listes
  croisées kanji-data / kanjiapi + 8 kanji de l'école primaire absents des listes
  `jlpt_new` (分 里 身 畑 的 無 可 孝) ajoutés éditorialement. Ordre pédagogique,
  radicaux, confusions, mnémotechniques. Pack publié 2026.08.6 : 1402 kanji,
  10098 mots (JMdict FR + vocabulaire curaté, sélection par fréquence `nfXX`),
  8429 phrases (Tatoeba CC BY 2.0 FR + phrases curatées prioritaires),
  **10 mini-textes** de lecture graduée (KanjiPath, CC BY-SA 4.0, dont deux textes
  longs N2 et deux N1), 73094 exercices déterministes, SVG KanjiVG assainis.
- API : curricula, kanji (liste, fiche, SVG, vocabulaire, phrases, progression),
  **mini-textes** (`GET /texts`, `GET /texts/:id`), **lookup vocabulaire**
  (`GET /words/:surface` pour la lecture en contexte), étude (sessions, réponses
  FSRS, reprise, abandon, **révision ciblée** par niveau/compétence/kanji),
  progression (tableau de bord, niveaux, points faibles, **statistiques
  détaillées**), sources, préférences (**limite de révisions + équilibrage
  automatique de la charge**), signalements.
- Web : tableau de bord (CTA « Continuer l'apprentissage », stats du jour, série,
  kanji à réviser, activité 30 j, points faibles, parcours N5→N1), liste + recherche
   des kanji avec sélecteur de niveau, filtres de statut, **filtres de fréquence
    (Top 500 / Top 1000), avec audio, et tri par fréquence**, fiche kanji complète
   (tracé animé KanjiVG, lectures avec romaji, radical/composants, mnémotechnique,
   progression par compétence, **marquage manuel comme connu depuis la fiche ou la liste**,
   navigation précédent/suivant, signalement de contenu),
   **entraînement à l'écriture** (`/kanji/:literal/ecriture` : grille de pratique,
   tracé au pointeur validé trait par trait contre KanjiVG — point de départ, sens,
   forme — aide fantôme réglable, trait passé/effacé, signalement de tracé),
   session d'étude (choix du mode — jour/points faibles/libre/**ciblée** par niveau/
   compétence/kanji, quiz avec raccourcis clavier 1-4 et Entrée, feedback animé avec
   lectures kana et romaji après réponse,
   résultats + confettis), **mission quotidienne** (`/mission` : snapshot reprenable
   composé de révisions, vocabulaire et lecture), **lecture graduée** (`/lecture` : liste des mini-textes ;
  `/lecture/:id` : texte annoté furigana/romaji + traduction, **tokens cliquables :
  lecture en contexte** — traduction du mot s'il est au référentiel, sinon
  **décomposition en kanji** (sens + lectures on/kun de chaque kanji, liens fiches)),
  **page progression**
  (onglets vue d'ensemble/activité/points faibles/**statistiques détaillées** :
  précision 7/30/90 j, par compétence et niveau, rétention estimée FSRS, charge de
  révision à 7 jours), page sources, page préférences
  (niveau actif, limite quotidienne, **révisions par session**, **équilibrage
  automatique**, **exclusion globale de la saisie en kana**, rétention, furigana,
  romaji, thème encre/washi).
  Navigation : sidebar desktop + barre inférieure mobile, menu utilisateur, toasts.
  Toutes les phrases d'exemple sont annotées au build (furigana par token + romaji,
  tokenisation kuromoji), affichées selon les préférences furigana/romaji. Design
  system « encre & washi » (voir `docs/architecture/overview.md#design-system-web`).
- Qualité : Vitest (unitaires + intégration MariaDB), Biome.
- **Carte visuelle des kanji** (`/kanji/:literal/carte`, ADR-006) : sous-graphe
   authentifié et borné de relations publiées (composants partagés, confusions
   visuelles, mots partagés, voisins du parcours). La disposition reste locale au
   navigateur ; filtres, liens clavier et liste textuelle donnent le même accès aux fiches.
- **Carnet de vocabulaire personnel** (`/carnet`, ADR-007) : enregistrement d'un mot
  depuis la lecture/lookup ou un tour de conversation propriétaire, contexte court et
  provenance publiée figée (référence, versions, attribution, licence). Les cartes,
  journaux et sessions FSRS du carnet sont stockés dans des tables distinctes : ils ne
  modifient ni les cartes ni les scores du curriculum. Les entrées peuvent être
  archivées ou supprimées explicitement avec leurs données de révision associées.

La Phase 1 (N5) a fait l'objet d'une relecture éditoriale (mnémotechniques,
étymologies, rôles de composants) et d'une complétion du vocabulaire curaté (mois,
heures, compteurs de personnes absents du sous-ensemble FR de JMdict).

La **Phase 2 (N4)** est livrée : critère de sortie atteint (≥ 5000 exercices N4
validés) — pipeline multi-niveaux, 166 kanji N4 curatés (radicaux, confusions
visuelles, mnémotechniques), vocabulaire/phrases complétés (以, 勉, 堂),
8195 exercices N4 validés — et fonctionnalités applicatives complétées :
**statistiques détaillées** (`GET /progress/stats`, onglet Statistiques) et
**mode révision ciblée** (sessions `targeted` filtrées par niveau, compétence ou
kanji ; liens profonds depuis les points faibles et la fiche kanji).

La **Phase 3 (N3)** est finalisée. Outre le pack de contenu N3 (367 kanji curatés,
vocabulaire complété, 18191 exercices N3), elle a livré les quatre fonctionnalités
restantes :
- **mini-textes** : lecture graduée N5/N4/N3 (2 textes par niveau), rendus avec
  furigana/romaji et traduction ;
- **phrases plus naturelles** : phrases curatées KanjiPath par niveau, injectées en
  priorité devant la sélection Tatoeba dans les exercices de contexte ;
- **lecture de vocabulaire avancée** : gabarit `vocab_reading_advanced_qcm` ciblant
  les mots à lecture irrégulière (rendaku, sokuon), distracteur « régularisé » ;
- **personnalisation de la charge** : préférences `reviewLimit` (révisions par
  session) et `autoBalance` (réduction des nouveaux kanji quand la charge due est
  haute), appliquées par `buildQueue`.

La **Phase 4a (N2)** est livrée. Outre le pack de contenu N2 (368 kanji curatés,
57 phrases curatées, 32 mots curatés, 2 textes longs, quota vocabulaire relevé à
10 mots/kanji), elle a livré les fonctionnalités de la phase :
- **filtres de fréquence** : tri « ordre du parcours / fréquence » et filtres
  Top 500 / Top 1000 sur la liste des kanji ;
- **lecture en contexte** : tokens cliquables dans `/lecture/:id`, panneau
  vocabulaire + décomposition en kanji (sens + lectures) alimenté par
  `GET /words/:surface` ;
- **textes plus longs** : les mini-textes N2 font ~300 caractères (contre ~100
  aux niveaux précédents) ;
- **grands volumes de vocabulaire** : sélection JMdict enrichie — score de
  fréquence journalière `nfXX`, éligibilité par niveau estimé du mot, passe bonus
  de mots fréquents ; 8 kanji de l'école primaire manquants ajoutés au référentiel
  (分 里 身 畑 的 無 可 孝), débloquant les mots très courants (今日, 日本, 自分,
  無料, 目的…).

La **Phase 4b (N1)** est livrée en publication progressive. Pipeline étendu N5→N1 ;
listes N1 croisées (kanji-data / kanjiapi : 1232 kanji identiques, 0 divergence).
Les données FR disponibles ne couvrant pas tout le niveau (227 kanji sans aucune
glose française JMdict — surtout des kanji de prénoms — et 401 sans phrase Tatoeba
FR liée), le pack 2026.08.7 publie **433 kanji N1** couverts (≥ 5 mots et
≥ 5 phrases chacun) : 1420 kanji au total, 10181 mots, 8532 phrases, 10 mini-textes
(dont 2 N1), 74009 exercices validés. Les 799 kanji restants sont suivis dans
`content/curated/n1/kanji-pending.json`. Leur curation est reportée jusqu'à une
source japonais-français supplémentaire sous licence compatible ou une capacité
éditoriale dédiée — voir `docs/agent/suivi-phase-4b.md`. Outils ajoutés :
`tools/content/n1-scaffold.mjs` (squelette curaté N1 rejouable),
`content/curated/radicals-fr.json` (radicaux manquants),
`content/curated/confusions-fr.json` (paires transverses),
`content/curated/n1/meanings-fr.json` (219 sens français absents de KANJIDIC2),
`content/curated/n1/mnemonics/` (mnémotechniques par lots),
`tools/content/check-texts.mjs` (vérification de brouillons de mini-textes).

Le pack **2026.08.10** de la **Phase 5** sélectionne toutes les ressources audio Tatoeba
exploitables à licence individuelle explicite : une par phrase japonais-français
annotable, avec préférence CC BY 4.0 et CC BY-NC 4.0 limité à l'instance personnelle
privée par ADR-002. Elles sont servies uniquement aux utilisateurs authentifiés avec
`nosniff` et cache privé. Le lot est figé par fichiers bruts et SHA-256 ; les
attributions restent visibles dans les ressources et dans la page Sources. Les fiches
proposent un bouton de lecture sans autoplay. Seules les dictées dont la réponse kana
est explicitement validée sont matérialisées au build et suivies par la compétence
`listening` / carte `AUDIO_DICTATION`.

Le snapshot actuel produit 645 clips automatiques exploitables, auxquels s'ajoutent les
3 ressources éditoriales initiales, soit **648 ressources audio**. Le rapport
`content/reports/audio-selection.json` conserve le décompte et les checksums.

L'instance est réservée à un usage personnel privé : `ADR-002-usage-personnel-et-audio-non-commercial.md`
autorise les clips CC BY-NC avec attribution, mais interdit toute distribution publique
ou commerciale tant qu'ils sont présents.

Le **laboratoire de shadowing** est disponible à `/shadowing` (ADR-008) : écoute d'une
phrase publiée avec clip audio sous licence autorisée (attribution affichée) ou lue par le
TTS japonais local, enregistrement micro (20 s max), transcription finale locale via l'API,
comparaison déterministe avec la lecture cible et segments à réécouter. Le résultat est
présenté comme une aide de correspondance, jamais comme une note ou un verdict de
prononciation, d'accent, de rythme ou d'intonation. La répétition est libre : aucun effet
sur les cartes FSRS, les scores, la progression kanji ou le curriculum. Seuls les résultats
expressément conservés par l'utilisateur sont persistés (`shadowing_results`, suppression
unitaire ou globale) ; audio brut, buffers et transcriptions intermédiaires restent en
mémoire. Un STT indisponible laisse l'écoute possible et affiche un diagnostic, sans
résultat fictif.

Le mode de conversation vocale locale est disponible à `/conversation` pour N5/N4. Son
mode texte reste opérationnel sans IA locale. L'API est le seul relais vers les services
loopback, conserve uniquement les transcriptions finales et les tours, et valide le JSON
du LLM avec une unique réparation; une sortie toujours invalide ou générique rend le tour
  réessayable sans faux fallback persisté. Les exercices et le pipeline restent déterministes et
  sans LLM au runtime.

Le **Quiz IA local** est disponible à `/quiz-ia`. Une demande libre, un niveau et des formats
fermés créent un snapshot personnel validé par Ollama; les réponses sont ensuite corrigées sans
LLM. Il reste distinct du contenu publié et ne modifie pas les cartes FSRS. Les missions actives
ou terminées restent accessibles depuis l'historique de la page. Tous les textes japonais du
snapshot affichent leur lecture kana. Le protocole génératif QCM se limite à cinq champs par
question, impose quatre choix et un nombre exact de questions; l'API construit toute la
présentation et les métadonnées. Elle planifie les types puis génère chaque question séparément;
une question rejetée est la seule à être régénérée, sans réparation heuristique du JSON. L'interface
conserve le thème général avec une typographie renforcée, des choix tactiles d'au moins 48 px et une
zone de question élargie sur ordinateur, tout en restant fluide sur mobile.

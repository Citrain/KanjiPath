# Plan d'implémentation et critères

Phases de livraison, critères d'acceptation et décisions refusées.

---

## Phases

### Phase 0 — Fondations

- monorepo, vérifications locales, NestJS, React, MariaDB (local, sans Docker), Prisma
- authentification, documentation, conventions de code
- premier pipeline vide

### Phase 1 — MVP N5 complet

- référentiel N5, fiches complètes, KanjiVG
- vocabulaire, phrases, exercices fixes
- FSRS, tableau de bord, progression
- reprise de session, recherche
- page sources et licences

**Critère de sortie** :

- tous les kanji N5 publiés possèdent le minimum de contenu
- au moins 3 000 exercices N5 validés
- progression persistante
- zéro erreur bloquante du validateur

### Phase 2 — N4

- pack N4, nouveaux types de contexte
- confusions visuelles, statistiques détaillées
- mode révision ciblée

**Critère de sortie** : au moins 5 000 exercices N4 validés

**État (2026-08-08)** : phase livrée. Critère de sortie atteint — pack N4 publié
(2026.08.2) : 166 kanji curatés, 8 195 exercices N4 validés, pipeline multi-niveaux,
nettoyage des contenus orphelins au chargement. Les confusions visuelles sont portées
par le curaté (paires par kanji) et les gabarits existants. Statistiques détaillées
(`GET /progress/stats` : précision 7/30/90 j, par compétence et par niveau, rétention
estimée FSRS, charge de révision à 7 jours ; onglet Statistiques de la page
progression) et mode révision ciblée (sessions `targeted` : filtres niveau/compétence/
kanji, liens profonds depuis les points faibles et la fiche kanji) sont implémentés.

### Phase 3 — N3

- mini-textes, phrases plus naturelles
- lecture de vocabulaire avancée
- personnalisation de la charge

**État (2026-08-08)** : phase finalisée. Pack N3 livré puis complété par les quatre
fonctionnalités de la phase, livrées avec le pack 2026.08.4 :
- **mini-textes** : 6 textes de lecture graduée (2 par niveau), tables
  `mini_texts`/`mini_text_tokens`, routes `GET /texts` / `GET /texts/:id`, pages
  web `/lecture` et `/lecture/:id` ;
- **phrases plus naturelles** : phrases curatées KanjiPath par niveau, prioritaires
  sur la sélection Tatoeba dans les exercices de contexte ;
- **lecture de vocabulaire avancée** : gabarit `vocab_reading_advanced_qcm`
  (rendaku/sokuon, distracteur régularisé), compétence `reading`, carte
  `VOCAB_READING` ;
- **personnalisation de la charge** : préférences `review_limit` / `auto_balance`
  appliquées par `buildQueue` (`computeNewKanjiCount`).

### Phase 4 — N2 et N1

- grands volumes de vocabulaire, nuances, mots composés
- lecture en contexte, filtres de fréquence
- textes plus longs

**État (2026-08-08)** : Phase 4a livrée (N2 + fonctionnalités). Pack N2 publié
(2026.08.5) : 368 kanji curatés (radicaux, confusions, mnémotechniques), pipeline
étendu N5→N2, **51377 exercices** validés au total (987 kanji, 7161 mots, 5116
phrases, 8 mini-textes). Fonctionnalités livrées :
- **grands volumes de vocabulaire** : quota de sélection JMdict relevé à 10
  mots/kanji pour N2, score enrichi du rang de fréquence journalière `nfXX`,
  sélection par niveau estimé du mot + passe bonus de mots fréquents ; 8 kanji de
  l'école primaire absents des listes `jlpt_new` ajoutés au référentiel
  (分 里 身 畑 的 無 可 孝), débloquant les mots très courants (今日, 日本, 自分,
  無料, 目的…) ;
- **filtres de fréquence** : tri par fréquence + filtres Top 500 / Top 1000 sur la
  liste des kanji (rang de fréquence KANJIDIC2 déjà porté par le pack) ;
- **lecture en contexte** : tokens cliquables sur `/lecture/:id` — lookup
  vocabulaire + décomposition en kanji (sens + lectures on/kun) via
  `GET /words/:surface` ;
- **textes plus longs** : deux textes N2 de lecture graduée (~300 caractères),
  57 phrases curatées N2 prioritaires.

**Phase 4b (livrée en publication progressive, 2026-08-08)** : pack N1 initial.
Listes croisées : 1232 kanji kanji-data / kanjiapi identiques, 0 divergence.
Constat : les données FR disponibles ne couvrent pas tout le niveau — 227 kanji
(surtout des kanji de prénoms) n'ont aucune entrée JMdict à glose française et
401 aucune phrase Tatoeba FR liée ; monter les quotas n'y change rien (absence de
candidats, pas de sélection). Décision : **publication progressive** — le pack
2026.08.7 publie les 433 kanji N1 couverts (≥ 5 mots ET ≥ 5 phrases) ; les 799
autres sont suivis dans `content/curated/n1/kanji-pending.json`. Leur curation est
reportée jusqu'à la disponibilité d'une source japonais-français sous licence
compatible ou d'une capacité éditoriale dédiée, sans nouvelle décision
d'architecture : le curriculum est versionné et le squelette
(`tools/content/n1-scaffold.mjs`) élargit le pack mécaniquement à chaque lot.
Outils : squelette N1 rejouable, `content/curated/radicals-fr.json` (22 radicaux
manquants), `content/curated/confusions-fr.json` (paires transverses),
`content/curated/n1/meanings-fr.json` (219 sens FR absents de KANJIDIC2),
mnémotechniques par lots dans `content/curated/n1/mnemonics/`, 2 mini-textes N1.
État : pipeline N5→N1, pack validé (1420 kanji, 74009 exercices, 0 erreur),
curation des kanji pending reportée (voir `docs/agent/suivi-phase-4b.md`).

### Phase 5 — Écriture et audio

- tracé, comparaison de traits
- dictée, audio sous licence
- exercices d'écoute

**État (2026-08-08)** : l'écriture existante est conservée ; l'audio utilise des clips
Tatoeba filtrés sur leur licence individuelle CC BY 4.0, avec binaire brut, SHA-256,
attribution et licence dans le pipeline. Les fiches ont une lecture explicite sans
autoplay, et les dictées fixes `audio_dictation_kana` alimentent la compétence
`listening` et la carte `AUDIO_DICTATION`.

Le mode conversation vocale locale est planifié séparément par ADR-003. Il démarre par
le mode texte et les providers injectables, avant STT/WebSocket, et ne remplace jamais
les exercices déterministes.

---

## Critères d'acceptation fonctionnels

### Fiche

- affiche sens, lectures, radical, composants, traits, mots et phrases
- ordre des traits animé
- lectures courantes distinguées des lectures rares
- provenance disponible
- mnémotechniques distinguées de l'étymologie

### Révision

- exercices fixes, disponibles sans IA
- session mélange plusieurs compétences
- chaque réponse met à jour la progression
- une erreur affiche une explication
- prochaine révision calculée
- session reprise possible

### Progression

- progression par niveau et par kanji visible
- points faibles identifiés
- progression persiste après déconnexion
- correction de niveau ne supprime pas l'historique

### Contenu

- chaque item possède une source
- chaque source possède une licence
- seuils de couverture respectés
- aucun contenu brouillon publié
- mise à jour des données sans écraser les enrichissements éditoriaux

---

## Décisions explicitement refusées

| Décision | Raison |
|----------|--------|
| JSON direct servi par React | progression difficile à synchroniser, pas de modèle éditorial |
| Une seule table `kanji` en JSON | requêtes complexes, duplication, pas de contraintes |
| Champ `mastered: boolean` | maîtrise multidimensionnelle et évolutive |
| Exercices générés par LLM à chaque session | coût, latence, erreurs, non-reproductibilité, dépendance |
| Niveaux présentés comme officiels | le JLPT ne publie pas de liste exhaustive officielle |
| Node.js Current en production | doit utiliser une version LTS |
| Microservices | le projet ne le justifie pas |

---

## Conséquences positives

- contenu fiable et vérifiable
- progression réellement utile
- utilisable sans coût d'IA
- architecture compatible N5 → N1
- compatible future app mobile
- données actualisables
- tests automatiques du contenu
- historique utilisateur robuste
- écriture et audio ajoutables plus tard

## Conséquences négatives

- coût initial élevé de préparation du contenu
- gestion de plusieurs licences
- pipeline d'import nécessaire
- validation humaine requise
- modèle de données plus riche
- temps de développement supérieur à une simple app de flashcards
- classement JLPT forcément approximatif et versionné

> Ces coûts sont acceptés : la qualité pédagogique et la pérennité sont centrales.

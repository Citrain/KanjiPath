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
| [adr/README.md](./adr/README.md) | Pointeur vers l'ADR-001 et son découpage par tâche |
| [agent/guide.md](./agent/guide.md) | Guide pour agent de code : conventions, pièges connus, recettes |

## Références premières

- **ADR-001** : `../ADR-001-plateforme-apprentissage-kanji.md` (racine) — décision
  d'architecture complète. Découpage opérationnel dans `../adr/`.
- **Règles agent** : `../AGENTS.md`.
- **Démarrage rapide** : `../README.md`.

## État actuel (Phase 2 — N4)

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
  (79 kanji croisés) et **N4** (166 kanji croisés), ordre pédagogique, radicaux,
  confusions, mnémotechniques. Pack publié 2026.08.2 : 245 kanji, 1664 mots
  (JMdict FR + vocabulaire curaté), 1300 phrases (Tatoeba CC BY 2.0 FR),
  12110 exercices déterministes (3915 N5, 8195 N4), SVG KanjiVG assainis.
- API : curricula, kanji (liste, fiche, SVG, vocabulaire, phrases, progression),
  étude (sessions, réponses FSRS, reprise, abandon, **révision ciblée** par niveau/
  compétence/kanji), progression (tableau de bord, niveaux, points faibles,
  **statistiques détaillées**), sources, préférences, signalements.
- Web : tableau de bord (CTA « Continuer l'apprentissage », stats du jour, série,
  kanji à réviser, activité 30 j, points faibles, parcours N5→N1), liste + recherche
   des kanji avec sélecteur de niveau et filtres de statut, fiche kanji complète
   (tracé animé KanjiVG, lectures avec romaji, radical/composants, mnémotechnique,
   progression par compétence, navigation précédent/suivant, signalement de contenu),
   **entraînement à l'écriture** (`/kanji/:literal/ecriture` : grille de pratique,
   tracé au pointeur validé trait par trait contre KanjiVG — point de départ, sens,
   forme — aide fantôme réglable, trait passé/effacé, signalement de tracé),
  session d'étude (choix du mode — jour/points faibles/libre/**ciblée** par niveau/
  compétence/kanji, quiz avec raccourcis clavier 1-4 et Entrée, feedback animé,
  résultats + confettis), **page progression** (onglets vue d'ensemble/activité/points
  faibles/**statistiques détaillées** : précision 7/30/90 j, par compétence et niveau,
  rétention estimée FSRS, charge de révision à 7 jours), page sources, page préférences
  (niveau actif, limite quotidienne, rétention, furigana, romaji, thème encre/washi).
  Navigation : sidebar desktop + barre inférieure mobile, menu utilisateur, toasts.
  Toutes les phrases d'exemple sont annotées au build (furigana par token + romaji,
  tokenisation kuromoji), affichées selon les préférences furigana/romaji. Design
  system « encre & washi » (voir `docs/architecture/overview.md#design-system-web`).
- Qualité : Vitest (unitaires + intégration MariaDB), Biome.

La Phase 1 (N5) a fait l'objet d'une relecture éditoriale (mnémotechniques,
étymologies, rôles de composants) et d'une complétion du vocabulaire curaté (mois,
heures, compteurs de personnes absents du sous-ensemble FR de JMdict).

La **Phase 2 (N4)** est livrée : critère de sortie atteint (≥ 5000 exercices N4
validés) — pipeline multi-niveaux, 166 kanji N4 curatés (radicaux, confusions
visuelles, mnémotechniques), vocabulaire/phrases complétés (以, 勉, 堂),
8195 exercices N4 validés — et fonctionnalités applicatives complétées :
**statistiques détaillées** (`GET /progress/stats`, onglet Statistiques) et
**mode révision ciblée** (sessions `targeted` filtrées par niveau, compétence ou
kanji ; liens profonds depuis les points faibles et la fiche kanji). L'introduction
de nouveaux kanji en session suit l'ordre N5 → N4 → … Prochaine étape contenu :
Phase 3 (N3).

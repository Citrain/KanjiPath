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

## État actuel (Phase 1 — MVP N5)

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
- Pipeline de contenu complet : download → import → normalize → generate → validate →
  report → publish → load. Référentiel N5 curaté (79 kanji croisés, ordre
  pédagogique, mnémotechniques), 521 mots (JMdict FR + vocabulaire curaté : mois,
  heures, compteurs), 418 phrases (Tatoeba
  CC BY 2.0 FR), 3904 exercices déterministes, SVG KanjiVG assainis.
- API : curricula, kanji (liste, fiche, SVG, vocabulaire, phrases, progression),
  étude (sessions, réponses FSRS, reprise), progression (tableau de bord, niveaux,
  points faibles), sources, préférences, signalements.
- Web : tableau de bord (CTA « Continuer l'apprentissage », stats du jour, série,
  kanji à réviser, activité 30 j, points faibles, parcours N5→N1), liste + recherche
   des kanji avec sélecteur de niveau et filtres de statut, fiche kanji complète
   (tracé animé KanjiVG, lectures avec romaji, radical/composants, mnémotechnique,
   progression par compétence, navigation précédent/suivant, signalement de contenu),
   **entraînement à l'écriture** (`/kanji/:literal/ecriture` : grille de pratique,
   tracé au pointeur validé trait par trait contre KanjiVG — point de départ, sens,
   forme — aide fantôme réglable, trait passé/effacé, signalement de tracé),
  session d'étude (choix du mode — jour/points faibles/libre, quiz avec raccourcis
  clavier 1-4 et Entrée, feedback animé, résultats + confettis), **page progression**
  (onglets vue d'ensemble/activité/points faibles), page sources, page préférences
  (niveau actif, limite quotidienne, rétention, furigana, romaji, thème encre/washi).
  Navigation : sidebar desktop + barre inférieure mobile, menu utilisateur, toasts.
  Toutes les phrases d'exemple sont annotées au build (furigana par token + romaji,
  tokenisation kuromoji), affichées selon les préférences furigana/romaji. Design
  system « encre & washi » (voir `docs/architecture/overview.md#design-system-web`).
- Qualité : Vitest (unitaires + intégration MariaDB), Biome.

La Phase 1 a fait l'objet d'une relecture éditoriale (mnémotechniques, étymologies,
rôles de composants) et d'une complétion du vocabulaire curaté (mois, heures,
compteurs de personnes absents du sous-ensemble FR de JMdict). Prochaine étape :
Phase 2 (N4).

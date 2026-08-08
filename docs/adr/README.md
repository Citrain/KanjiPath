# ADR — Architecture Decision Records

L'ADR de référence est **ADR-001 — Plateforme web d'apprentissage progressif des
kanji**, conservée à la racine du dépôt pour rester la source de vérité unique :

- **ADR complète** : [`../../ADR-001-plateforme-apprentissage-kanji.md`](../../ADR-001-plateforme-apprentissage-kanji.md)
- **ADR-002, instance personnelle et audio CC BY-NC** : [`../../ADR-002-usage-personnel-et-audio-non-commercial.md`](../../ADR-002-usage-personnel-et-audio-non-commercial.md)
- **Découpage opérationnel par tâche** : [`../../adr/`](../../adr/)

## Découpage (`adr/`)

| Dossier | Contenu |
|---|---|
| `adr/0-overview.md` | Vue d'ensemble, principes, définition de terminé |
| `adr/1-foundations/` | Stack, architecture, monorepo, Phase 0 |
| `adr/2-content-pipeline/` | Sources, licences, pipeline, génération, volume |
| `adr/3-data-model/` | Schéma de données complet, index critiques |
| `adr/4-api/` | Routes REST `/api/v1` |
| `adr/5-kanji-card/` | Fiche kanji (sections 5.1–5.9) |
| `adr/6-exercises/` | Types d'exercices, exercices futurs |
| `adr/7-progression/` | Progression, FSRS, cartes, maîtrise, déblocage |
| `adr/8-ux/` | Écrans, aides pédagogiques, mobile-first |
| `adr/9-security-perf/` | Sécurité, performance, observabilité |
| `adr/10-testing-deployment/` | Tests et déploiement |
| `adr/11-phases/` | Plan d'implémentation, critères, décisions refusées |

## Historique des versions de l'ADR

- **1.2** — Montée de Prisma ORM **v6 → v7** : client généré dans
  `apps/api/src/generated/prisma` (provider `prisma-client`, `output` requis),
  moteur « Rust-free », driver adapter `@prisma/adapter-mariadb` obligatoire,
  configuration CLI dans `apps/api/prisma.config.ts`. Provider de schéma
  inchangé (`mysql`).
- **1.1** — PostgreSQL 18 remplacé par **MariaDB 11.4 LTS+** (local, sans Docker,
  Prisma provider `mysql`) ; suppression de Docker Compose pour le développement local.
- **1.0** — version initiale.

## Règle

Toute décision structurante nouvelle doit faire l'objet d'un ADR (ou d'un amendement de
l'ADR existante) **avant** implémentation, puis être reflétée dans `adr/` et `docs/`.

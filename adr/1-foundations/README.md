# Fondations techniques

Stack, architecture et configuration du projet KanjiPath.

---

## Stack retenue

### Runtime et dépôt

- **Node.js 24 LTS** (pas de version Current)
- **TypeScript strict**
- **pnpm workspaces**
- monorepo léger, sans microservices
- **Pas de Docker** : MariaDB local déjà installé (lancé comme service système)

### Frontend

- **React 19.2**
- **Vite 8.1**
- **React Router**
- **TanStack Query**
- **Tailwind CSS 4.3**
- composants accessibles basés sur Radix UI
- PWA installable
- IndexedDB uniquement pour le cache et la continuité hors connexion

### Backend

- **NestJS 11**
- adaptateur **Fastify**
- API REST documentée par OpenAPI
- validation des entrées par Zod ou DTO Nest stricts
- authentification par session sécurisée en cookie HTTP-only

### Données

- **MariaDB 11.4 LTS ou supérieure** (installée en local, sans Docker ; testée en 12.x)
- **Prisma ORM v6 stable**, provider `mysql` (compatible MariaDB)
- migrations SQL versionnées
- Redis non obligatoire en V1
- stockage objet facultatif pour de futurs fichiers audio

> Prisma n'a pas de connector MariaDB dédié : on utilise le provider `mysql`.
> Éviter les fonctionnalités MySQL 8+ non supportées par MariaDB
> (CTE récursives, JSON avancé).

### Qualité

- Vitest pour les tests unitaires
- Supertest pour les tests d'intégration API
- Playwright pour les tests end-to-end
- ESLint ou Biome
- Prettier si Biome n'est pas retenu
- Pas de CI configurée (vérifications locales)
- Renovate pour les mises à jour contrôlées

---

## Architecture des modules

```text
apps/
  web/
    src/
      app/
      routes/
      features/
        auth/
        dashboard/
        curriculum/
        kanji/
        study/
        progress/
        settings/
      components/
      lib/
      styles/

  api/
    src/
      modules/
        auth/
        users/
        curricula/
        kanji/
        vocabulary/
        sentences/
        exercises/
        study/
        progress/
        content/
      infrastructure/
        database/
        security/
        observability/
      main.ts

packages/
  domain/
    src/
      kanji/
      curriculum/
      study/
      review/
      progress/

  contracts/
    src/
      api/
      schemas/
      enums/

  content-schema/
    src/
      kanji.schema.ts
      vocabulary.schema.ts
      sentence.schema.ts
      exercise.schema.ts

  ui/
    src/

tools/
  content/
    import-kanjidic/
    import-jmdict/
    import-kanjivg/
    import-krad/
    import-tatoeba/
    normalize/
    assign-levels/
    generate-exercises/
    validate/
    publish/

content/
  raw/
  normalized/
  curated/
  generated/
  manifests/
  licenses/
  reports/

docs/
  adr/
  architecture/
  content/
  operations/
```

---

## Pourquoi React et NestJS séparés ?

- domaine métier testable indépendamment
- API stable pour une future app mobile
- pipeline de contenu plus propre
- meilleure isolation des règles de progression
- architecture plus facile à faire évoluer
- documentation OpenAPI exploitable automatiquement

---

## Phase 0 — Fondations (tâches)

> Statut : **terminée** (voir `README.md` racine pour lancer le projet).

- [x] initialiser monorepo pnpm
- [x] configurer vérifications locales (lint, typecheck, tests)
- [x] configurer NestJS + Fastify — `apps/api`
- [x] configurer React + Vite — `apps/web`
- [x] configurer MariaDB local + Prisma (provider `mysql`) — `apps/api/prisma`
- [x] implémenter authentification — Argon2id, cookie HttpOnly, CSRF double-submit
- [x] rédiger conventions de code — `AGENTS.md`, TypeScript strict, Biome
- [x] premier pipeline vide (download → import → validate) — `tools/content/run.mjs`

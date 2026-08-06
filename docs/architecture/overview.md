# Architecture — Vue d'ensemble

KanjiPath est un monorepo TypeScript. Le client web et l'API sont séparés afin de
garder un domaine métier testable, une API stable (future app mobile) et un pipeline
de contenu propre. Pas de microservices : une seule API modulaire.

## Stack

| Couche | Technologie |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript strict, pnpm workspaces |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, Radix UI |
| Backend | NestJS 11 + adaptateur Fastify, API REST `/api/v1` |
| Données | MariaDB 11.4+ (testée 12.x), Prisma ORM 6 (provider `mysql`) |
|Répétition espacée | `ts-fsrs` derrière une interface du domaine |
| Qualité | Vitest, Biome, GitHub Actions |

Détail et justification : `adr/1-foundations/README.md`.

## Structure du monorepo

```text
apps/
  web/                 # frontend React (port 5173 en dev)
    src/
      app/             # App, routing, garde d'authentification
      features/
        auth/          # pages login/register, hooks use-auth, api auth
        dashboard/     # page d'accueil connectée
      lib/             # apiFetch (client HTTP, CSRF)
      styles/
  api/                 # API NestJS + Fastify (port 3001 en dev)
    prisma/            # schema.prisma + migrations
    src/
      app.module.ts
      app.controller.ts        # GET /health
      main.ts                  # bootstrap, cookies, CORS, prefixe /api/v1
      infrastructure/
        database/      # PrismaModule, PrismaService
        security/      # csrf-cookie.plugin, csrf.guard, skip-csrf.decorator
      modules/
        auth/          # controller, service, session, guards, décorateurs
        users/         # UsersService
    test/              # tests d'intégration (e2e)

packages/
  contracts/           # types/schémas partagés (enums, API auth, schémas Zod)
  domain/              # règles métier : ReviewScheduler (FSRS), maîtrise
  content-schema/      # schémas Zod du contenu (kanji, vocab, phrases, exercices)
  ui/                  # composants React (Button, Badge) — consommé en source

tools/
  content/run.mjs      # squelette du pipeline de contenu

content/               # raw, normalized, curated, generated, manifests, licenses, reports

docs/                  # documentation humaine + agent
adr/                   # découpage de l'ADR-001 par tâche
```

## Flux de données (authentification)

```text
Navigateur
  │  POST /api/v1/auth/login {email,password}   (cookie kp_csrf + header x-csrf-token)
  ▼
API NestJS (Fastify)
  │  CsrfGuard (double-submit)  →  ThrottlerGuard (rate-limit)
  │  AuthService.login → UsersService (Prisma) → verifyPassword (argon2id)
  │  SessionService.create → random 32 octets, sha256 stocké en base
  ▼
MariaDB : users / user_settings / sessions
  │
  ▼  Set-Cookie kp_session (HttpOnly, SameSite=Lax)
Navigateur
```

- Le cookie de session est **HttpOnly** : aucun token en `localStorage`.
- Le jeton de session n'est jamais stocké en clair : seul son `sha256` est en base.
- Le cookie `kp_csrf` (non HttpOnly) est posé par un hook Fastify (`csrf-cookie.plugin`)
  et comparé au header `x-csrf-token` par `CsrfGuard` sur toute mutation.

## Endpoints (Phase 0)

Préfixe `/api/v1` :

```text
GET    /health
GET    /auth/csrf
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/password/change
```

## Sécurité

Détail complet : `adr/9-security-perf/README.md`. Points clés :

- Argon2id pour le hachage des mots de passe.
- Rotation de session, expiration, révocation à la déconnexion.
- Rate-limiting global + renforcé sur register/login (`@nestjs/throttler`).
- CSRF par double-submit (cookie + header), comparaison en temps constant.
- Les SVG KanjiVG seront traités comme données contrôlées au build (Phase 1).

## Performance / index

Index critiques prévus (Phase 1+) : `adr/3-data-model/README.md#index-critiques-mariadb`.

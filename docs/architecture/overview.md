# Architecture — Vue d'ensemble

KanjiPath est un monorepo TypeScript. Le client web et l'API sont séparés afin de
garder un domaine métier testable, une API stable (future app mobile) et un pipeline
de contenu propre. Pas de microservices : une seule API modulaire.

## Stack

| Couche | Technologie |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript strict, pnpm workspaces |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, Radix UI, Motion, canvas-confetti |
| Backend | NestJS 11 + adaptateur Fastify, API REST `/api/v1` |
| Données | MariaDB 11.4+ (testée 12.x), Prisma ORM 6 (provider `mysql`) |
| Répétition espacée | `ts-fsrs` derrière une interface du domaine |
| Contenu | pipeline déterministe `tools/content/` (voir `docs/content/pipeline.md`) |
| Qualité | Vitest, Biome |

Détail et justification : `adr/1-foundations/README.md`.

## Structure du monorepo

```text
apps/
  web/                 # frontend React (port 5173 en dev)
    src/
      app/             # App, routing, app-layout (nav, thème), garde d'authentification
      features/
        auth/          # pages login/register (écran scindé), hooks use-auth, api auth
        content/       # accès API contenu (kanji, sources, progression)
        dashboard/     # tableau de bord (hero, ring, historique 30j, points faibles)
        kanji/         # liste + recherche + fiche kanji (SVG animé KanjiVG)
        study/         # session d'étude (quiz animé, feedback, résultats + confettis)
        settings/      # préférences (niveau actif, limites, furigana, thème)
        sources/       # page sources et licences
      lib/             # apiFetch (client HTTP, CSRF), theme (encre/washi)
      styles/          # design system Tailwind 4 (tokens, animations)
  api/                 # API NestJS + Fastify (port 3001 en dev)
    prisma/            # schema.prisma + migrations
    src/
      app.module.ts
      app.controller.ts        # GET /health
      main.ts                  # bootstrap, cookies, CORS, préfixe /api/v1
      infrastructure/
        database/      # PrismaModule, PrismaService
        security/      # csrf-cookie.plugin, csrf.guard, skip-csrf.decorator
      modules/
        auth/          # controller, service, session, guards, décorateurs
        users/         # UsersService
        content/       # kanji (liste/fiche/SVG/vocab/phrases), sources, signalements
        curricula/     # curricula et niveaux
        study/         # sessions, file d'étude, réponses (FSRS), reprise
        progress/      # tableau de bord, niveaux, points faibles, historique
        settings/      # préférences utilisateur
    test/              # tests d'intégration (e2e)

packages/
  contracts/           # types/schémas partagés (enums, API auth, kanji, study, progress)
  domain/              # règles métier : ReviewScheduler (FSRS), maîtrise
  content-schema/      # schémas Zod du contenu (kanji, vocab, phrases, exercices)
  ui/                  # composants React (Button, Badge, Card, Progress, Ring,
                       # Toggle, Segmented) — consommé en source

tools/
  content/             # pipeline de contenu : run.mjs (CLI), stages/, lib/, load.mjs

content/               # raw, normalized, curated, generated, manifests, licenses, reports

docs/                  # documentation humaine + agent
adr/                   # découpage de l'ADR-001 par tâche
```

## Design system (web)

Le frontend suit un design system « encre & washi » défini dans
`apps/web/src/styles/index.css` (Tailwind CSS 4, tokens via `@theme inline`) :

- **Deux thèmes** par variables CSS : `encre` (sombre, défaut) et `washi` (clair),
  appliqués via `data-theme` sur `<html>` (`apps/web/src/lib/theme.ts`, persisté en
  localStorage, synchronisable avec la préférence `theme` des settings).
- **Tokens** : `bg`, `panel`, `card`, `line`, `ink`, `muted`, `accent` (vermillon),
  `gold`, `jade`, `sky`, `violet`, `danger` → classes Tailwind dédiées
  (`bg-card`, `text-ink`, `border-line`, `text-accent`…).
- **Typographie** : `Shippori Mincho` (kanji, titres — classe `font-kanji`) et
  `Outfit` (interface).
- **Composants partagés** (`packages/ui`) : `Button`, `Badge`, `Card`, `Progress`,
  `Ring`, `Toggle`, `Segmented`.
- **Animations** : Motion (transitions de pages/questions), keyframes maison
  (`animate-float`, `animate-pop`, `animate-shake`, `shimmer`, tracé SVG), confettis
  en fin de session réussie.

Règle : toute nouvelle page utilise les tokens (jamais de couleurs en dur `zinc-*`),
les composants de `packages/ui` et le gabarit `AppLayout`.

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

## Flux de données (contenu et étude)

```text
Pipeline (build)                     API (runtime)
  download → import → normalize      GET /kanji, /kanji/:literal, /kanji/:literal/svg
  → generate → validate → publish    GET /curricula, /sources
  → load (Prisma upsert)             POST /study/sessions, /study/answers (FSRS)
        ▼                            GET /progress/dashboard, /progress/levels/:level
MariaDB : kanji, vocabulaire, phrases, exercices, cartes FSRS, progression
```

- Le contenu est **fixe et validé** : aucun LLM au runtime.
- Les id du pack sont les id DB (upsert idempotent) : la progression survit aux
  rechargements de contenu.
- Les SVG KanjiVG sont assainis au build puis servis par l'API (voir sécurité).

## Endpoints

Préfixe `/api/v1` :

```text
GET    /health

# Authentification
GET    /auth/csrf
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/password/change

# Curriculum
GET    /curricula
GET    /curricula/:code/levels
GET    /curricula/:code/levels/:level
GET    /curricula/:code/levels/:level/progress

# Kanji
GET    /kanji?level=N5
GET    /kanji/:literal
GET    /kanji/:literal/svg          # SVG KanjiVG assaini
GET    /kanji/:literal/related
GET    /kanji/:literal/vocabulary
GET    /kanji/:literal/sentences
GET    /kanji/:literal/progress

# Étude
POST   /study/sessions
GET    /study/queue
GET    /study/resume
POST   /study/answers
POST   /study/sessions/:id/finish

# Progression
GET    /progress/dashboard
GET    /progress/levels/:level
GET    /progress/weak-points
GET    /progress/history

# Préférences
GET    /settings
PATCH  /settings

# Contenu
GET    /sources
POST   /content/issues
```

## Sécurité

Détail complet : `adr/9-security-perf/README.md`. Points clés :

- Argon2id pour le hachage des mots de passe.
- Rotation de session, expiration, révocation à la déconnexion.
- Rate-limiting global + renforcé sur register/login (`@nestjs/throttler`).
- CSRF par double-submit (cookie + header), comparaison en temps constant.
- Les SVG KanjiVG sont **assainis au build** (balises `svg/g/path` et attributs
  autorisés uniquement) puis servis avec `X-Content-Type-Options: nosniff` et un
  chemin résolu sous `content/generated/kanjivg` (pas de traversée).

## Performance / index

Index critiques (créés dans les migrations) : `review_cards(user_id, due_at)`,
`review_cards(user_id, subject_id, skill)` (contrainte unique),
`curriculum_kanji(curriculum_id, level, order)`, `exercise_items(level, kanji_id,
skill)`, `kanji_readings(reading)`, `vocabulary(reading)`,
`review_logs(review_card_id, reviewed_at)`. Voir
`adr/3-data-model/README.md#index-critiques-mariadb`.

# Architecture — Vue d'ensemble

KanjiPath est un monorepo TypeScript. Le client web et l'API sont séparés afin de
garder un domaine métier testable, une API stable (future app mobile) et un pipeline
de contenu propre. Pas de microservices : une seule API modulaire.

## Stack

| Couche | Technologie |
|---|---|
| Runtime | Node.js 24 LTS, TypeScript strict, pnpm workspaces |
| Frontend | React 19, Vite 8, React Router 7, TanStack Query 5, Tailwind CSS 4, Radix UI (slot, dialog, dropdown-menu, tooltip), lucide-react, Motion, canvas-confetti |
| Backend | NestJS 11 + adaptateur Fastify, API REST `/api/v1` |
| Données | MariaDB 11.4+ (testée 12.x), Prisma ORM 7 (provider `mysql`, driver adapter `@prisma/adapter-mariadb`) |
| Répétition espacée | `ts-fsrs` derrière une interface du domaine |
| Contenu | pipeline déterministe `tools/content/` (voir `docs/content/pipeline.md`) |
| Qualité | Vitest, Biome |

Détail et justification : `adr/1-foundations/README.md`.

## Structure du monorepo

```text
apps/
  web/                 # frontend React (port 5173 en dev)
    src/
      app/             # App, routing (routes lazy), app-layout (sidebar/bottom nav, thème),
                       # garde d'authentification, transitions de page
      components/      # composants domaine web : KanjiTile, LevelBadge, StatusBadge, HistoryChart,
                       # ForecastChart
      features/
        auth/          # pages login/register (écran scindé), champs mot de passe, hooks, api
        content/       # accès API contenu (kanji, sources, progression, signalements)
        dashboard/     # tableau de bord (CTA continuer, stats, série, à réviser, parcours)
        kanji/         # liste + recherche + fiche kanji (SVG animé KanjiVG, signalement)
                       # + entraînement à l'écriture (tracé au pointeur validé, stroke-match)
        progression/   # page progression (onglets : niveaux, activité, points faibles,
                       # statistiques détaillées)
        study/         # session d'étude (choix de mode — jour/points faibles/libre/ciblée,
                       # quiz clavier 1-4/Entrée, résultats)
        settings/      # préférences (niveau actif, limites, furigana, romaji, thème)
        sources/       # page sources et licences
      lib/             # apiFetch (client HTTP, CSRF), theme (encre/washi),
                       # format (dates), progress (série), skills (libellés)
      styles/          # design system Tailwind 4 (tokens, animations, reduced-motion)
  api/                 # API NestJS + Fastify (port 3001 en dev)
    prisma/            # schema.prisma + migrations
    prisma.config.ts   # config CLI Prisma v7 (schema, datasource, migrations)
    src/
      app.module.ts
      app.controller.ts        # GET /health
      main.ts                  # bootstrap, cookies, CORS, préfixe /api/v1
      generated/prisma/        # client Prisma GÉNÉRÉ (gitignoré, `pnpm db:generate`)
      infrastructure/
        database/      # PrismaModule, PrismaService, prisma.adapter (driver MariaDB)
        security/      # csrf-cookie.plugin, csrf.guard, skip-csrf.decorator
      modules/
        auth/          # controller, service, session, guards, décorateurs
        users/         # UsersService
        content/       # kanji (liste/fiche/SVG/vocab/phrases), sources, signalements
        curricula/     # curricula et niveaux
        study/         # sessions, file d'étude, réponses (FSRS), reprise, révision ciblée
        progress/      # tableau de bord, niveaux, points faibles, historique, statistiques
        settings/      # préférences utilisateur
    test/              # tests d'intégration (e2e)

packages/
  contracts/           # types/schémas partagés (enums, API auth, kanji, study, progress)
                       # + schémas Zod (auth, création de session / ciblage)
  domain/              # règles métier : ReviewScheduler (FSRS), maîtrise
  content-schema/      # schémas Zod du contenu (kanji, vocab, phrases, exercices)
  ui/                  # design system React : Button, IconButton, Badge, Card, Field/Input/
                       # Textarea, Toggle, Segmented, Tabs, Progress, Ring, Skeleton, Slider,
                       # Stat, Tooltip, Dropdown, Modal, Toast, EmptyState/ErrorState,
                       # PageHeader/SectionHeader — consommé en source

tools/
  content/             # pipeline de contenu : run.mjs (CLI), stages/, lib/, load.mjs

content/               # raw, normalized, curated, generated, manifests, licenses, reports

docs/                  # documentation humaine + agent
adr/                   # découpage de l'ADR-001 par tâche
```

## Design system (web)

Le frontend suit un design system « encre & washi » contemporain défini dans
`apps/web/src/styles/index.css` (Tailwind CSS 4, tokens via `@theme inline`) :

- **Deux thèmes** par variables CSS : `encre` (sombre, défaut) et `washi` (clair),
  appliqués via `data-theme` sur `<html>` (`apps/web/src/lib/theme.ts`, persisté en
  localStorage, bascule dans le menu utilisateur et les préférences).
- **Tokens de surface** : `bg` (fond de page), `surface` (cartes), `surface-2`
  (surfaces secondaires), `surface-3` (survol/élévation) → `bg-surface`,
  `bg-surface-2`, etc.
- **Tokens de texte** : `ink` (principal), `ink-soft` (secondaire), `muted`
  (tertiaire) → `text-ink`, `text-ink-soft`, `text-muted`.
- **Tokens de bordure** : `line`, `line-strong` → `border-line`.
- **Tokens de couleur** : `accent` (vermillon, action principale) + `accent-soft`,
  `accent-2`, puis sémantiques `gold`, `jade` (succès), `sky` (info), `violet`,
  `danger` (erreur), chacune avec sa variante `-soft`.
- **Ombres** : `shadow-1` (repos), `shadow-2` (survol), `shadow-glow` (halo accent
  des CTA) — définies par variables pour chaque thème.
- **Typographie** : `Shippori Mincho` (kanji — classe `font-jp`) et `Outfit`
  (interface). Hiérarchie : eyebrow (12 px capitales espacées), H1 24/30 px
  extrabold, H2 18 px bold, corps 15 px, légendes 11-13 px.
- **Espacement** : échelle Tailwind standard (4/8/12/16/24/32/48/64), sections
  espacées de `gap-8`, cartes `p-5 sm:p-6`, contenu borné à `max-w-6xl`.
- **Composants partagés** (`packages/ui`, consommé en source) : `Button`
  (variantes primary/secondary/ghost/danger, état `loading`), `IconButton`,
  `Badge`/`BadgeDot`, `Card`/`CardTitle`, `Field`/`Input`/`Textarea`, `Toggle`,
  `Segmented` (navigation fléchée), `Tabs`, `Progress`, `Ring`, `Skeleton`,
  `Slider`, `Stat`, `Tooltip` (Radix), `Dropdown` (Radix), `Modal` (Radix),
  `Toast` (`ToastProvider` + `useToast`), `EmptyState`, `ErrorState`,
  `PageHeader`, `SectionHeader`. Leurs classes Tailwind ne sont générées que grâce
  à la directive `@source "../../../../packages/ui/src"` dans
  `apps/web/src/styles/index.css` (piège 40 du guide agent).
- **Composants domaine** (`apps/web/src/components/`) : `KanjiTile`,
  `LevelBadge` (teinte par niveau N5→N1), `StatusBadge`/`STATUS_META`,
  `HistoryChart` (fenêtre 30 jours complétée de jours vides).
- **Layout** (`AppLayout`) : sidebar fixe à gauche (≥ lg) avec navigation,
  badge de révisions dues, série en cours et menu utilisateur (dropdown) ;
  barre supérieure + barre de navigation inférieure sur mobile. Transitions de
  page via `AnimatePresence` ; icônes `lucide-react`.
- **Animations** : Motion (transitions de pages/questions, apparitions),
  keyframes maison (`animate-float`, `animate-pop`, `animate-shake`,
  `animate-rise`, `animate-toast-in`, `shimmer`, tracé SVG), confettis en fin de
  session réussie. `MotionConfig reducedMotion="user"` + bloc CSS
  `prefers-reduced-motion` neutralisent les animations si demandé par l'OS.

Règle : toute nouvelle page utilise les tokens (jamais de couleurs en dur
`zinc-*` ni hexadécimales), les composants de `packages/ui` et le gabarit
`AppLayout` (routes déclarées dans `app.tsx`, pages chargées en `lazy`).

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
  → generate → validate → publish    GET /curricula, /sources, /texts, /texts/:id
  → load (Prisma upsert)             POST /study/sessions, /study/answers (FSRS)
        ▼                            GET /progress/dashboard, /progress/levels/:level
MariaDB : kanji, vocabulaire, phrases, mini-textes, exercices, cartes FSRS, progression
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

# Lecture (mini-textes)
GET    /texts                          # liste (filtre ?level=)
GET    /texts/:id                      # texte annoté + traduction

# Étude
POST   /study/sessions              # mode daily/weak_points/free/targeted (+ cible level/skill/kanjiIds)
GET    /study/queue
GET    /study/resume
POST   /study/answers
POST   /study/sessions/:id/finish
POST   /study/sessions/:id/abandon   # items restants → skipped, session clôturée

# Progression
GET    /progress/dashboard
GET    /progress/levels/:level
GET    /progress/weak-points
GET    /progress/history
GET    /progress/stats              # statistiques détaillées (précision, rétention, prévision)

# Préférences
GET    /settings
PATCH  /settings                     # activeLevel, dailyNewLimit, reviewLimit, autoBalance,
                                     # desiredRetention, furiganaMode, romajiEnabled, theme

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

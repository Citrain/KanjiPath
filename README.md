# KanjiPath

Plateforme web d'apprentissage progressif des kanji (parcours aligné sur le JLPT, N5 → N1).

Architecture et règles produit complètes : [`ADR-001-plateforme-apprentissage-kanji.md`](./ADR-001-plateforme-apprentissage-kanji.md) (découpé par tâche dans [`adr/`](./adr)).

## Documentation

- **Index** : [`docs/README.md`](./docs/README.md)
- Architecture : [`docs/architecture/overview.md`](./docs/architecture/overview.md)
- Contenu (pipeline, licences) : [`docs/content/`](./docs/content)
- Opérations (dev, déploiement) : [`docs/operations/`](./docs/operations)
- IA locale de conversation (setup Windows, services et diagnostic) :
  [`docs/operations/local-ai.md`](./docs/operations/local-ai.md)
- ADR conversation vocale locale :
  [`ADR-003-conversation-vocale-japonais-locale.md`](./ADR-003-conversation-vocale-japonais-locale.md)
- Règles pour agents de code : [`AGENTS.md`](./AGENTS.md) + [`docs/agent/guide.md`](./docs/agent/guide.md)

## Stack

- Node.js 24 LTS, TypeScript strict, pnpm workspaces
- React 19 + Vite 8 + Tailwind CSS 4 (apps/web)
- NestJS 11 + Fastify (apps/api)
- MariaDB 11.4 LTS+ + Prisma ORM 7 (provider `mysql`) — testée avec MariaDB 12.x
- **Sans Docker** : MariaDB est installé en local

## Structure

```text
apps/
  web/        frontend React
  api/        API NestJS + Prisma
packages/
  contracts/       types et schémas partagés (API)
  domain/          règles métier (FSRS, maîtrise)
  content-schema/  schémas Zod du contenu pédagogique
  ui/              composants React partagés
tools/
  content/    pipeline de contenu (download → publish)
content/      raw, normalized, curated, generated, manifests, licenses, reports
```

## Prérequis

- Node.js ≥ 24
- pnpm ≥ 11 (`npm install -g pnpm`)
- MariaDB 11.4+ installé en local (pas de Docker)

## Démarrage rapide (recommandé)

```bash
.\dev.bat        # ou : pnpm dev:all
```

Le script vérifie les outils, démarre MariaDB, crée les bases, installe les
dépendances, applique les migrations puis lance web + API. Détails :
[`docs/operations/development.md`](./docs/operations/development.md).

## Installation manuelle

1. Lancer le service MariaDB local (service Windows ou `mysqld`).

2. Créer les bases (via HeidiSQL ou CLI) :

```sql
CREATE DATABASE kanjipath CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE kanjipath_test CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

3. Copier `.env.example` vers `.env` et adapter `DATABASE_URL` / `DATABASE_URL_TEST`
   (utilisateur, mot de passe, port).

4. Installer et initialiser :

```bash
pnpm install
pnpm db:generate        # génère le client Prisma
pnpm db:migrate         # crée les migrations sur kanjipath (mode dev)
```

5. Lancer en développement :

```bash
pnpm dev                # web sur http://localhost:5173, API sur http://localhost:3001
```

## Scripts racine

| Commande | Description |
|---|---|
| `.\dev.bat` / `pnpm dev:all` | setup complet + lancement des serveurs |
| `pnpm dev:setup` | setup complet sans lancer les serveurs |
| `pnpm dev` | lance web + api en parallèle |
| `pnpm build` | build de tous les packages/apps |
| `pnpm typecheck` | vérification TypeScript de tout le monorepo |
| `pnpm test` | tests (unitaires + intégration si DB configurée) |
| `pnpm lint` / `pnpm lint:fix` | Biome |
| `pnpm db:migrate` | `prisma migrate dev` |
| `pnpm db:deploy` | `prisma migrate deploy` |
| `pnpm content:build` | pipeline de contenu complet (download → publish) |
| `pnpm content:validate` | validation seule du contenu |
| `pnpm content:load` | charge le pack publié dans MariaDB (DATABASE_URL) |

## Tests d'intégration

Les tests d'intégration de l'API nécessitent la base `kanjipath_test` et des migrations
appliquées :

```bash
pnpm --filter @kanjipath/api exec prisma migrate deploy
# avec DATABASE_URL pointant sur kanjipath_test, ou :
pnpm db:deploy
pnpm test
```

Sans `DATABASE_URL_TEST`, les tests d'intégration sont automatiquement ignorés.

## Contenu

Le contenu pédagogique est versionné, sourcé et validé (aucun LLM au runtime du
pipeline ou des exercices).
Licences : EDRDG CC BY-SA 4.0 (KANJIDIC2, JMdict, KRADFILE), CC BY-SA 3.0 (KanjiVG),
Tatoeba (CC BY 2.0 FR avec attribution), kanji-data (MIT, croisement des niveaux),
contenu éditorial KanjiPath (phrases et mini-textes curatés, CC BY-SA 4.0).

Premier remplissage de la base de contenu :

```bash
pnpm content:build   # download → publish (raw/, normalized/, generated/, manifests/)
pnpm content:load    # charge le pack publié dans MariaDB (DATABASE_URL)
```

Détails : [`docs/content/pipeline.md`](./docs/content/pipeline.md),
[`docs/content/licensing.md`](./docs/content/licensing.md),
`adr/2-content-pipeline/README.md`.

## Conversation vocale locale

La page `/conversation` propose N5/N4 et fonctionne au clavier sans service IA. Quand
`LOCAL_AI_ENABLED=true`, l'API relaie le micro vers faster-whisper et la synthèse
japonaise vers VOICEVOX ; le navigateur ne joint jamais ces services. Le LLM local ne
sert qu'au dialogue sous contraintes contrôlées par l'application et ne génère aucun
exercice. Voir ADR-003 et [`docs/operations/local-ai.md`](./docs/operations/local-ai.md).
L'historique des sessions et les événements de vocabulaire/nouveaux éléments sont visibles
sur la même page. Le conteneur faster-whisper fourni est dans `services/stt/`.

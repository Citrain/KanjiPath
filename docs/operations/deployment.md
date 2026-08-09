# Déploiement et environnements

Référence : `adr/10-testing-deployment/README.md`.

## Environnements

- `local` — développement sans Docker (voir `development.md`).
- `test` — base `kanjipath_test` locale (voir `development.md`).
- `staging` — préproduction.
- `production`.

Le contenu publié doit être **identique** entre staging et production pour une version
donnée.

## Vérifications avant déploiement

Pas de CI configurée. Avant tout déploiement, lancer localement :

```bash
pnpm db:generate   # client Prisma généré (requis avant le build sur un clone frais)
pnpm lint
pnpm typecheck
pnpm test
pnpm content:build
```

## Production (recommandé)

- **Frontend** : build Vite statique servi par CDN.
- **API** : Node dans un conteneur ou process managé par systemd.
- **Base** : MariaDB managé ou installé sur serveur avec sauvegardes régulières.
- **TLS** : reverse proxy (terminaison TLS) devant l'API.
- Migrations exécutées **avant** bascule (`prisma migrate deploy` ; depuis Prisma 7,
  la connexion CLI vient de `apps/api/prisma.config.ts`, qui lit `DATABASE_URL` dans
  l'environnement du processus).
- Sauvegarde quotidienne de la base.
- `COOKIE_SECURE=true` (cookies `Secure`), `CORS_ORIGIN` restreint au domaine du site.

## Services IA locaux (conversation planifiée)

Le mode conversation d'ADR-003 est prévu pour une instance locale. Ollama, STT,
VOICEVOX et le TTS français éventuel restent liés a `127.0.0.1` et ne sont pas exposés
par le reverse proxy. Une installation qui ne les fournit pas doit conserver le mode
texte et rendre un diagnostic explicite. Voir [local-ai.md](./local-ai.md).

## Variables de production

```env
DATABASE_URL="mysql://<user>:<secret>@<host>:3306/kanjipath"
PORT=3001
CORS_ORIGIN=https://<domaine>
COOKIE_SECURE=true
SESSION_TTL_DAYS=30
```

## Checklist de mise en production

1. Build frontend (`pnpm --filter @kanjipath/web build`) et publication CDN.
2. Déploiement de l'API (image/conteneur ou process).
3. `prisma migrate deploy` sur la base de production.
4. Vérification de `GET /api/v1/health`.
5. Contrôle des en-têtes de sécurité cookies (`Secure`, `HttpOnly`, `SameSite=Lax`).
6. Plan de sauvegarde/restauration de la base validé.

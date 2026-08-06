# Déploiement et environnements

Référence : `adr/10-testing-deployment/README.md`.

## Environnements

- `local` — développement sans Docker (voir `development.md`).
- `test` — CI GitHub Actions (service MariaDB éphémère).
- `staging` — préproduction.
- `production`.

Le contenu publié doit être **identique** entre staging et production pour une version
donnée.

## CI (GitHub Actions)

`.github/workflows/ci.yml` :

- service MariaDB 11.4 (conteneur, uniquement côté CI) ;
- `pnpm install --frozen-lockfile` ;
- `prisma generate` + `prisma migrate deploy` sur la base de test ;
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm content:build`.

Le Docker utilisé ici ne concerne **que la CI** ; le développement local reste sans
Docker.

## Production (recommandé)

- **Frontend** : build Vite statique servi par CDN.
- **API** : Node dans un conteneur ou process managé par systemd.
- **Base** : MariaDB managé ou installé sur serveur avec sauvegardes régulières.
- **TLS** : reverse proxy (terminaison TLS) devant l'API.
- Migrations exécutées **avant** bascule (`prisma migrate deploy`).
- Sauvegarde quotidienne de la base.
- `COOKIE_SECURE=true` (cookies `Secure`), `CORS_ORIGIN` restreint au domaine du site.

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

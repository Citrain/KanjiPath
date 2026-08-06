# Développement local (sans Docker)

L'environnement de développement n'utilise **pas** Docker. MariaDB est installé en
local et lancé comme service système.

## Prérequis

- Node.js ≥ 24 (LTS)
- pnpm ≥ 11 (`npm install -g pnpm`)
- MariaDB 11.4+ installé en local (testé avec MariaDB 12.x)

## Démarrage rapide

```bash
.\dev.bat          # ou : pnpm dev:all
```

Le script `dev.ps1` (appelé par `dev.bat`) fait tout dans l'ordre :

1. vérifie `node`, `pnpm`, et localise `mysql.exe` ;
2. lit `.env` (et le crée depuis `.env.example` s'il est absent) ;
3. démarre le service `MariaDB` s'il est arrêté (peut demander les droits admin) ;
4. crée `kanjipath` et `kanjipath_test` si absentes ;
5. `pnpm install` ;
6. génère le client Prisma et applique les migrations sur les deux bases ;
7. lance web (`http://localhost:5173`) et API (`http://localhost:3001`).

Arrêt : **Ctrl+C**.

Variantes :

```bash
pnpm dev:setup     # tout le setup SANS lancer les serveurs
pnpm dev           # lance seulement web + api (DB déjà à jour)
```

## Configuration (`.env`)

```env
DATABASE_URL="mysql://root:root@localhost:3306/kanjipath"
DATABASE_URL_TEST="mysql://root:root@localhost:3306/kanjipath_test"
PORT=3001
CORS_ORIGIN=http://localhost:5173
COOKIE_SECURE=false
SESSION_TTL_DAYS=30
```

- `COOKIE_SECURE=true` en production uniquement (HTTPS).
- `.env` est gitignoré ; ne jamais committer de secret.

## Scripts utiles

```bash
pnpm dev            # web + api en parallèle
pnpm build          # build de tous les packages/apps
pnpm typecheck      # vérification TypeScript
pnpm test           # build + tests (unitaires + intégration)
pnpm lint           # Biome
pnpm lint:fix       # Biome avec corrections
pnpm db:generate    # régénère le client Prisma
pnpm db:migrate     # prisma migrate dev (crée une migration si schéma modifié)
pnpm db:deploy      # prisma migrate deploy (applique les migrations commitées)
pnpm content:build  # pipeline de contenu (squelette)
```

## Migrations

- Le schéma est dans `apps/api/prisma/schema.prisma`.
- Les migrations sont commitées dans `apps/api/prisma/migrations/`.
- Après modification du schéma : `pnpm db:migrate` (dev), puis committer la migration.
- Ne jamais écraser silencieusement une migration existante.

## Tests d'intégration

Les tests d'intégration (`apps/api/test/*.e2e-spec.ts`) nécessitent la base
`kanjipath_test` migrée et `DATABASE_URL_TEST` défini. Sans cela ils sont ignorés.

```bash
pnpm dev:setup      # prépare aussi kanjipath_test
pnpm test
```

## Dépannage

| Symptôme | Cause probable / solution |
|---|---|
| `Access denied for user 'root'` | Mot de passe incorrect dans `.env` |
| Le service MariaDB ne démarre pas | Relancer en administrateur |
| `pnpm` non reconnu | `npm install -g pnpm` puis rouvrir le terminal |
| Port 5173/3001 occupé | Un ancien `pnpm dev` tourne encore (Ctrl+C ou tuer le process) |

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
.\dev.bat -Voice   # ajoute Ollama + STT, VOICEVOX si déjà lancé
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
pnpm dev:voice     # setup + web/API + Ollama + STT local
```

`-Voice` crée au premier passage `services/stt/.venv`, installe ses dépendances et
démarre faster-whisper sur `127.0.0.1:8765`. Il démarre Ollama et télécharge le modèle
configuré s'il manque. VOICEVOX reste optionnel : le démarrer avant le script, ou fournir
son exécutable natif :

```powershell
.\dev.bat -Voice -VoicevoxPath "C:\chemin\vers\VOICEVOX.exe"
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
- Les variables `LOCAL_AI_*`, `OLLAMA_*`, `STT_*`, `VOICEVOX_*`, `FRENCH_TTS_*` et
  `CONVERSATION_*` configurent la conversation locale. Elle reste en mode texte tant que
  `LOCAL_AI_ENABLED=false`; le détail des services est dans [local-ai.md](./local-ai.md).

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
pnpm content:build  # pipeline de contenu complet (download → publish)
pnpm content:load   # charge le pack publié dans la base de développement
```

## Migrations

- Le schéma est dans `apps/api/prisma/schema.prisma`.
- Les migrations sont commitées dans `apps/api/prisma/migrations/`.
- Après modification du schéma : `pnpm db:migrate` (dev), puis committer la migration.
- Ne jamais écraser silencieusement une migration existante.

### Spécificités Prisma ORM 7

- **Client généré hors de `node_modules`** : le générateur `prisma-client` écrit le
  client dans `apps/api/src/generated/prisma/` (gitignoré). Il est régénéré par
  `pnpm db:generate` (étape incluse dans `dev.ps1`). Le code source importe depuis ce
  chemin (`../generated/prisma/client`), plus depuis `@prisma/client`.
- **Driver adapter obligatoire** : Prisma 7 n'embarque plus de moteur Rust ; la
  connexion passe par `@prisma/adapter-mariadb` (driver `mariadb`). L'adaptateur est
  créé dans `apps/api/src/infrastructure/database/prisma.adapter.ts` et injecté dans
  `PrismaService`. `tools/content/load.mjs` l'utilise aussi.
- **Config CLI dans `prisma.config.ts`** : `apps/api/prisma.config.ts` déclare le
  schéma, le dossier de migrations et la `datasource.url` (`env("DATABASE_URL")`).
  Prisma 7 ne lit plus `.env` automatiquement : les scripts API passent par
  `dotenv-cli` (`dotenv -e ../../.env -- prisma ...`).
- **`prisma migrate dev` ne régénère plus le client** : lancer `pnpm db:generate`
  explicitement après une migration qui change le schéma.

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
| Service de conversation indisponible | Le mode texte doit rester disponible ; vérifier les services loopback selon `local-ai.md` |

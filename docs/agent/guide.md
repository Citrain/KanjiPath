# Guide de l'agent de code

Ce document complète `AGENTS.md`. Il décrit les conventions, les **pièges connus**
(rencontrés réellement) et des recettes courantes. Si tu découvres un nouveau piège,
ajoute-le ici.

## Démarrer une tâche

1. Lire `AGENTS.md`, puis le dossier `adr/` du thème concerné.
2. Lire le(s) document(s) `docs/` du module touché.
3. Vérifier l'état : `pnpm typecheck && pnpm lint && pnpm test`.
4. Travailler, puis repasser ces trois commandes.
5. Mettre à jour la doc (humaine + agent) dans le même changement.

## Conventions

- **TypeScript strict** partout (`strict`, `noUncheckedIndexedAccess`). Pas de `any`.
- **Pas de commentaires** dans le code sauf demande explicite ; le code doit être
  lisible par ses noms. Les explications vont dans la doc.
- **Imports** : Biome organise les imports (`pnpm lint:fix`). Respecter l'ordre.
- **Modules internes** préfixés `@kanjipath/*` (`contracts`, `domain`,
  `content-schema`, `ui`).
- **Nommage** : fichiers kebab-case, composants React PascalCase, hooks `use*`.
- **Erreurs** : lever des exceptions Nest (`BadRequestException`, etc.) ; le client
  reçoit un payload `{ error: { code, message, details } }`.
- **Pas de secret** dans le dépôt ; `.env` est gitignoré.
- **Formulation JLPT** : toujours « Parcours aligné sur le JLPT », jamais « officiel ».

## Cartographie rapide

| Besoin | Emplacement |
|---|---|
| Une route API | `apps/api/src/modules/<domaine>/` |
| Schéma / tables | `apps/api/prisma/schema.prisma` |
| Types/schémas partagés | `packages/contracts/src/` |
| Règles métier (FSRS, maîtrise) | `packages/domain/src/` |
| Schémas de contenu | `packages/content-schema/src/` |
| Composants UI | `packages/ui/src/` |
| Client HTTP front | `apps/web/src/lib/api.ts` |
| Une page front | `apps/web/src/features/<domaine>/` |
| Pipeline de contenu | `tools/content/run.mjs` |

## Pièges connus (IMPORTANT)

1. **Fastify épinglé en 5.10.0** dans `apps/api`. `@nestjs/platform-fastify` embarque
   sa propre copie ; une version différente crée des types incompatibles
   (`setCookie is not a function`). Ne pas « monter » Fastify sans aligner le platform.

2. **Hooks Fastify = `fastify-plugin` obligatoire.** Un plugin qui ajoute un hook
   (`addHook('onRequest', ...)`) doit être enveloppé de `fp(...)` (voir
   `csrf-cookie.plugin.ts`). Sinon le hook reste encapsulé et ne s'applique à aucune
   route (le cookie n'est jamais posé).

3. **`packages/ui` est consommé en SOURCE** (`main` → `src/index.ts`). Ne pas le
   rebuilder en CJS `dist/` pour le front : Vite importe en ESM et échouerait
   (`does not provide an export named 'Button'`). `resolve.dedupe: ['react','react-dom']`
   est déjà configuré dans `apps/web/vite.config.ts` pour éviter deux React.

4. **`apiFetch` ne met `content-type: application/json` que s'il y a un body.**
   Fastify rejette un body JSON vide (400). C'était le bug du logout. Ne pas remettre
   le header inconditionnellement.

5. **`light-my-request` 6.6 : `response.cookies` est un TABLEAU**, pas un objet indexé
   par nom. Utiliser `findCookie(response, 'nom')` (voir `apps/api/test/auth.e2e-spec.ts`).

6. **`ts-fsrs` 5.4 : `Card` exige `learning_steps`** (nombre). Le modèle `ReviewCard`
   du domaine le porte (`learningSteps`). Indexer `repeat()` avec le type `Grade`
   (pas `Rating`, qui inclut `Manual`).

7. **Prisma lit `.env` via `dotenv-cli`** dans les scripts `apps/api`
   (`dotenv -e ../../.env -- prisma ...`). Lancer `prisma` directement depuis la
   racine sans charger l'env échoue (`Environment variable not found: DATABASE_URL`).

8. **MariaDB, pas PostgreSQL.** Provider Prisma `mysql`. Pas de fonctionnalités
   MySQL 8+ non supportées par MariaDB (CTE récursives, JSON avancé).

9. **Biome + NestJS** : `unsafeParameterDecoratorsEnabled: true` est requis dans
   `biome.json` (décorateurs de paramètre `@Body()`, `@Res()`…). `useImportType` est
   désactivé car l'injection de dépendances Nest utilise la classe au runtime.

10. **Windows / PowerShell** : `pnpm` est un shim `.ps1`; `Start-Process pnpm` échoue
    (« not a valid Win32 application »). Utiliser `pnpm.cmd` ou `node`/`cmd`. Les
    sorties `stderr` de pnpm apparaissent en rouge dans une capture `2>&1` sans être
    des erreurs.

## Recettes

### Ajouter une route API

1. Créer/modifier le contrôleur dans `apps/api/src/modules/<domaine>/`.
2. Si la route est une mutation, elle est automatiquement soumise au `CsrfGuard`.
   Pour l'exempter : décorateur `@SkipCsrf()` (à justifier).
3. Définir/mettre à jour les types de réponse dans `packages/contracts`.
4. Ajouter un test d'intégration dans `apps/api/test/`.
5. `pnpm --filter @kanjipath/api test`.

### Ajouter une table

1. Modifier `apps/api/prisma/schema.prisma`.
2. `pnpm db:migrate` (crée + applique la migration en dev).
3. Committer la migration.
4. Si la table reflète un concept du modèle ADR, mettre à jour
   `adr/3-data-model/README.md` et `docs/architecture/overview.md`.

### Ajouter une page front

1. Créer le composant dans `apps/web/src/features/<domaine>/`.
2. Déclarer la route dans `apps/web/src/app/app.tsx` (protéger avec `RequireAuth` si besoin).
3. Utiliser `apiFetch` (`apps/web/src/lib/api.ts`) pour les appels.
4. `pnpm --filter @kanjipath/web typecheck`.

### Lancer les tests d'intégration seuls

```bash
pnpm dev:setup                    # prépare kanjipath_test
pnpm --filter @kanjipath/api test
```

## Commandes de vérification finales

```bash
pnpm typecheck
pnpm lint
pnpm test
pnpm content:validate
```

Ne pas déclarer une tâche terminée si l'une de ces commandes échoue ou si la doc n'est
pas à jour (voir « Définition de terminé » dans `AGENTS.md`).

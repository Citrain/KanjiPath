# Guide de l'agent de code

Ce document complète `AGENTS.md`. Il décrit les conventions, les **pièges connus**
(rencontrés réellement) et des recettes courantes. Si tu découvres un nouveau piège,
ajoute-le ici.

## Démarrer une tâche

1. Lire `AGENTS.md`, puis le dossier `adr/` du thème concerné.
2. Lire le(s) document(s) `docs/` du module touché.
3. Vérifier l'état : `pnpm typecheck && pnpm lint && pnpm test`.
4. Travailler, puis repasser ces trois commandes (+ `pnpm content:validate` si le
   contenu a changé).
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
- **Id contenu = id DB** : les id du pack (`k-04e00`, `v-…`, `s-tatoeba-…`, `x-…`)
  sont utilisés tels quels comme clés primaires en base (upsert idempotent).

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
| Appels API contenu/progression | `apps/web/src/features/content/api.ts` |
| Une page front | `apps/web/src/features/<domaine>/` |
| Pipeline de contenu | `tools/content/run.mjs` (stages dans `tools/content/stages/`) |
| Gabarits d'exercices | `tools/content/lib/generators.mjs` |
| Chargement du pack en base | `tools/content/load.mjs` (`pnpm content:load`) |
| Données curatées N5 | `content/curated/n5/kanji.json`, `vocabulary.json`, `sentences.json` |

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

11. **`pnpm exec` avale certains flags** (`--name`, etc.). Pour passer des options à
    l'outil, séparer avec `--` : `pnpm --filter @kanjipath/api exec -- dotenv -e
    ../../.env -- prisma migrate dev --name x`.

12. **`prisma migrate dev` est interactif** : dans un shell non interactif il demande
    le nom de migration même avec `--name` si le flag s'est perdu, ou échoue
    (« non-interactive environment »). Recette fiable : `prisma migrate diff
    --from-url <DATABASE_URL> --to-schema-datamodel prisma/schema.prisma --script`
    écrit dans un dossier `migrations/<ts>_nom/migration.sql`, puis `prisma migrate
    deploy` (dev + test). Penser à retirer le BOM si le fichier est écrit par
    PowerShell (`Set-Content -Encoding UTF8` ajoute un BOM).

13. **`prisma generate` peut échouer en EPERM** (rename de
    `query_engine-windows.dll.node`) si un serveur dev/watcher tient la DLL :
    arrêter les processus `node` (`Get-Process node | Stop-Process`) puis régénérer.

14. **`unbzip2-stream` n'est pas async-itérable** (`stream is not async iterable`) :
    consommer via événements `data/end/error` avec une file (voir `bz2Lines` et
    `tarBz2Lines` dans `tools/content/lib/importers.mjs`).

15. **Tatoeba** : l'export `sentences_CC0` ne contient quasiment **aucune** phrase
    japonaise. Utiliser les exports détaillés par langue (6 colonnes : id, lang,
    texte, auteur, dates) + `links.tar.bz2`. Licence retenue : **CC BY 2.0 FR**,
    attribution obligatoire (auteur, sinon « Tatoeba »).

16. **KANJIDIC2 contient déjà des sens français** (`<meaning m_lang="fr">`) : ne pas
    les traduire ni les écraser ; filtrer les sens « radical … » (bruit pour les
    kanji radicaux). Les lectures kun portent des marqueurs `-` (okurigana) : les
    nettoyer (`cleanReading`) et dédupliquer.

17. **KanjiVG** : le zip contient `kanji/<codepoint 5 hex minuscules>.svg`.
    L'index (`kanjivg-index.json`) stocke les codepoints **sans** `.svg` ; les SVG
    sont assainis au build (ne garder que `svg/g/path` + attributs autorisés) dans
    `content/generated/kanjivg/`.

18. **Session d'étude : les options QCM doivent arriver mélangées AVEC la bonne
    réponse** (`options` dans `StudyQueueItem`). Ne renvoyer que les distracteurs
    rend l'exercice impossible ; renvoyer `acceptedAnswers` séparément exposerait la
    réponse de façon trop évidente dans le payload.

19. **`SessionAuthGuard` injecte `SessionService`** : tout module qui utilise le guard
    doit importer `AuthModule` (qui exporte `SessionService`), sinon erreur DI au
    bootstrap (`Nest can't resolve dependencies of the SessionAuthGuard`).

20. **JMdict FR : mots composés basiques quasi absents.** Le sous-ensemble à glosses
    françaises n'a presque aucun mot de type mois/heures/compteurs (一月, 七時,
    三人…), et les entrées dont `keb[0]` contient un chiffre (１月) sont écartées par
    `hasOnlyKanjiKana`. Ces mots de base N5 doivent être apportés par
    `content/curated/n5/vocabulary.json`. Ne jamais créer deux entrées de même
    `writtenForm` avec lectures différentes (ex. 何時 いつ/なんじ) : les QCM de
    lecture deviendraient ambigus (une lecture réelle en distracteur d'une autre).

21. **Contraintes du curaté kanji** : (a) les `confusions` ne doivent référencer que
    des kanji publiés — le web les rend en liens `/kanji/<literal>` (lien mort sinon),
    et le générateur filtre celles hors référentiel ; (b) les clés de `componentRoles`
    doivent exister dans la décomposition krad du kanji (sinon ignorées
    silencieusement) ; (c) tout composant d'une décomposition krad sans entrée dans
    `content/curated/components-fr.json` s'affiche sans nom sur la fiche — vérifier la
    complétude après chaque ajout.

22. **kuromoji** : le token expose `surface_form` (pas `surface`), `word_position`
    (offset de début **1-based**) et `reading` en **katakana** (converti en hiragana
    pour le furigana). La particule は a `reading=ハ` mais `pronunciation=ワ` : le
    romaji des tokens kana utilise `pronunciation`. Le dictionnaire IPAdic couvre les
    lectures des tokens kanji, mais un token inconnu (UNK) n'en a pas : `normalize`
    échoue alors (choisir une autre phrase ou compléter le curaté).

23. **Fuite de réponse par furigana/romaji** : tout exercice dont la réponse est une
    lecture (`kanji_to_reading_qcm`, `reading_input_kana`, `vocab_reading_qcm`,
    `sentence_cloze_reading`) ne doit jamais afficher le furigana/romaji du mot ou du
    kanji cible. Utiliser `sentencePromptTokens` (`hideSpan`/`blankLiteral`) ; le
    masquage se fait par **position** (offsets des tokens), car le mot cible peut être
    découpé en plusieurs tokens (ex. 一人 → 一 + 人, lu ひとり).

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
2. `pnpm db:migrate` (interactif) ou la recette `migrate diff` + `deploy` (piège 12).
3. Committer la migration.
4. Si la table reflète un concept du modèle ADR, mettre à jour
   `adr/3-data-model/README.md` et `docs/architecture/overview.md`.

### Ajouter une page front

1. Créer le composant dans `apps/web/src/features/<domaine>/`.
2. Déclarer la route dans `apps/web/src/app/app.tsx` (protéger avec `RequireAuth` et
   envelopper de `AppLayout`).
3. Utiliser `apiFetch` (`apps/web/src/lib/api.ts`) pour les appels.
4. Suivre le design system : tokens de `styles/index.css` (`bg-card`, `text-ink`,
   `border-line`, `text-accent`…), composants `packages/ui`, animations Motion.
   Jamais de couleurs `zinc-*`/hexadécimales en dur. Voir
   `docs/architecture/overview.md#design-system-web`.
5. `pnpm --filter @kanjipath/web typecheck`.

### Modifier le contenu N5 (curaté)

1. Éditer `content/curated/n5/kanji.json` (ordre, radicaux, confusions,
   mnémotechniques) ou `vocabulary.json` / `sentences.json` (complétion).
2. Relancer `pnpm content:normalize && pnpm content:generate && pnpm content:validate`.
3. `pnpm content:report` pour vérifier la couverture (≥ 40 exercices, ≥ 6 mots,
   ≥ 6 phrases par kanji).
4. `pnpm content:publish && pnpm content:load` pour publier et recharger en base.

### Régénérer le contenu depuis zéro

```bash
node tools/content/run.mjs import --force   # reparse les sources brutes
pnpm content:build                          # normalize → publish
pnpm content:load
```

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

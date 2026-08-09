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
| Statistiques détaillées | `apps/api/src/modules/progress/progress.service.ts#stats` |
| Révision ciblée (file) | `apps/api/src/modules/study/study.service.ts#buildTargetedQueue` |
| Équilibrage charge (nouveaux kanji) | `apps/api/src/modules/study/study.service.ts#computeNewKanjiCount` |
| Mini-textes (routes) | `apps/api/src/modules/content/content.service.ts#textList/textDetail` |
| Validation body session | `packages/contracts/src/schemas/study.ts` (zod) |
| Schéma / tables | `apps/api/prisma/schema.prisma` |
| Config CLI Prisma (v7) | `apps/api/prisma.config.ts` |
| Client Prisma généré | `apps/api/src/generated/prisma/` (gitignoré, `pnpm db:generate`) |
| Types/schémas partagés | `packages/contracts/src/` |
| Règles métier (FSRS, maîtrise) | `packages/domain/src/` |
| Schémas de contenu | `packages/content-schema/src/` |
| Composants UI (design system) | `packages/ui/src/` |
| Composants domaine web (KanjiTile, badges, graphe) | `apps/web/src/components/` |
| Client HTTP front | `apps/web/src/lib/api.ts` |
| Appels API contenu/progression | `apps/web/src/features/content/api.ts` |
| Une page front | `apps/web/src/features/<domaine>/` |
| Tracé d'écriture (validation géométrique) | `apps/web/src/features/kanji/stroke-match.ts` (pur, testé) |
| Série (jours consécutifs) | `apps/web/src/lib/progress.ts` (calcul côté client) |
| Pipeline de contenu | `tools/content/run.mjs` (stages dans `tools/content/stages/`) |
| Filtre kanji avec audio | `hasAudio` dans `ContentService#kanjiList`, consommé par `features/kanji/kanji-list-page.tsx` |
| Ajouts éditoriaux de kanji (hors listes jlpt_new) | `IMPORT_EXTRA` dans `tools/content/lib/importers.mjs` |
| Gabarits d'exercices | `tools/content/lib/generators.mjs` |
| Chargement du pack en base | `tools/content/load.mjs` (`pnpm content:load`) |
| Données curatées par niveau | `content/curated/<niveau>/kanji.json`, `vocabulary.json`, `sentences.json`, `texts.json` (`n5/`→`n1/`) + `components-fr.json`, `radicals-fr.json`, `confusions-fr.json` |
| Squelette curaté N1 (généré) | `tools/content/n1-scaffold.mjs` (reconstruit `content/curated/n1/kanji.json` ; mnémotechniques dans `content/curated/n1/mnemonics/*.json`) |

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
   **`packages/contracts` est l'inverse** : consommé via son `dist/` CJS (nécessaire
   à l'API Nest). Le web ne doit y faire que des `import type` (éradiqués à la
   compilation) ; importer une **valeur** runtime (`JLPT_LEVELS`…) échoue dans Vite
   (`does not provide an export named 'JLPT_LEVELS'`) et tire tout le dist + zod
   dans le bundle. Les constantes utiles au web sont redéfinies dans
   `apps/web/src/lib/` (ex. `lib/levels.ts`).

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
   Depuis Prisma 7, le CLI ne lit **plus** `.env` tout seul : la `datasource.url`
   vient de `apps/api/prisma.config.ts` (`env("DATABASE_URL")`), alimentée par
   `dotenv-cli`. Ne pas supprimer `dotenv-cli` des scripts.

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
    (« non-interactive environment »). Recette fiable (Prisma 7 : `--from-url` et
    `--to-schema-datamodel` n'existent plus) : `prisma migrate diff
    --from-config-datasource --to-schema prisma/schema.prisma --script` (url lue
    depuis `prisma.config.ts`, donc via `dotenv -e ../../.env`) écrit dans un dossier
    `migrations/<ts>_nom/migration.sql`, puis `prisma migrate deploy` (dev + test).
    Penser à retirer le BOM si le fichier est écrit par PowerShell
    (`Set-Content -Encoding UTF8` ajoute un BOM).

13. **`prisma generate` n'écrit plus de DLL moteur** (Prisma 7 « Rust-free ») : le
    piège EPERM sur `query_engine-windows.dll.node` n'existe plus. Le client est
    généré en TypeScript dans `apps/api/src/generated/prisma/` (gitignoré). Si un
    outil tient des fichiers verrouillés sous Windows, arrêter les processus `node`
    puis régénérer.

13a. **Prisma 7 : client généré + driver adapter.** Le générateur est `prisma-client`
    (pas `prisma-client-js`) avec `output = "../src/generated/prisma"`,
    `moduleFormat = "cjs"` (l'API compile en CommonJS ; `esm` émettrait
    `import.meta`, incompatible avec `tsc` ici) et `importFileExtension = "ts"`.
    Tout import du client se fait depuis `src/generated/prisma/client` (jamais
    `@prisma/client`, qui n'est plus qu'un runtime). La connexion exige un driver
    adapter : `createDbAdapter()` (`infrastructure/database/prisma.adapter.ts`,
    `@prisma/adapter-mariadb` qui accepte directement l'URL `mysql://`) est passé au
    constructeur de `PrismaClient` dans `PrismaService`. Les tsconfig de `apps/api`
    portent `allowImportingTsExtensions` + `rewriteRelativeImportExtensions`
    (imports générés en `.ts`, réécrits `.js` à l'émission) : ne pas les retirer.

13b. **`tools/content/load.mjs` importe le client généré en TypeScript directement**
    (`../../apps/api/src/generated/prisma/client.ts` + `prisma.adapter.ts`) via le
    type stripping natif de Node 24 — pas de build nécessaire. Le warning
    `MODULE_TYPELESS_PACKAGE_JSON` à l'exécution est bénin (Node repasse le fichier
    en ESM par détection de syntaxe). Ne pas remettre d'import `@prisma/client` dans
    les outils.

13c. **`pnpm migrate deploy` sur la base de test** : `dev.ps1` injecte
    `$env:DATABASE_URL = <url kanjipath_test>` puis lance `prisma migrate deploy`
    (sans `dotenv-cli`). Avec Prisma 7 cela fonctionne car `prisma.config.ts` lit
    `env("DATABASE_URL")` du processus. Conserver cet ordre (generate → deploy dev →
    deploy test).

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
    `content/generated/kanjivg/`. **Piège (déjà rencontré)** : ne garder **aucun**
    attribut préfixé `kvg:` (ex. `kvg:element`) ni la déclaration `xmlns:kvg`.
    Un préfixe `kvg:` sans namespace déclaré rend le XML invalide : le
    `DOMParser` du web n'y trouve plus aucun `<path>` → « Tracé indisponible »
    partout, alors que l'API renvoie bien le fichier en 200. Les attributs `kvg:*`
    sont donc retirés à l'assainissement (seuls `id`/`class`/`transform`/`d`
    subsistent). Test de non-régression : `tools/content/test/sanitize-svg.test.mjs`.

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
    Les mois avec chiffre arabe sont un cas à corriger : kuromoji découpe `6月` en `6`
    et `月` (lu isolément `つき`). `annotateSentence` les fusionne en un token `6月`
    lu `ろくがつ`; conserver ce correctif et son test.

23. **Fuite de réponse par furigana/romaji** : tout exercice dont la réponse est une
    lecture (`kanji_to_reading_qcm`, `reading_input_kana`, `vocab_reading_qcm`,
    `sentence_cloze_reading`) ne doit jamais afficher le furigana/romaji du mot ou du
    kanji cible. Utiliser `sentencePromptTokens` (`hideSpan`/`blankLiteral`) ; le
    masquage se fait par **position** (offsets des tokens), car le mot cible peut être
    découpé en plusieurs tokens (ex. 一人 → 一 + 人, lu ひとり).

24. **`packages/ui` : résolution `bundler` obligatoire.** Les primitives Radix
    (dialog, dropdown-menu, tooltip) n'exposent leurs types que via la condition
    `exports` ; le tsconfig du package utilise donc `module: ESNext` +
    `moduleResolution: bundler`. Ne pas revenir à `node` (erreur TS2307 sur
    `@radix-ui/*`). Le package reste consommé **en source** par Vite (piège 3).

25. **Tokens design system renommés (refonte UI 2026-08).** Les anciennes classes
    n'existent plus : `bg-card`→`bg-surface`, `bg-card-2`→`bg-surface-2`,
    `bg-panel`→`bg-surface` (+ décor), `bg-bg-soft`→`bg-surface-2`,
    `font-kanji`→`font-jp`, et les utilitaires `text-glow`, `gradient-accent`,
    `gradient-text`, `card-hover`, `ring-track` ont été supprimés (remplacés par
    `shadow-1/2`, `shadow-glow`, les variantes `hover:` des composants et
    `stroke-line`). Toujours vérifier `styles/index.css` avant d'inventer une token.

26. **Toasts : `useToast` exige `<ToastProvider>`**, monté dans `AppLayout`. Les
    pages hors layout (login/register) n'y ont pas accès ; y afficher les erreurs
    en inline.

27. **Nouvelle page front = `React.lazy`.** Les pages sont chargées en code-split
    dans `apps/web/src/app/app.tsx` (`lazy(() => import(...).then(m => ...))`) et
    rendues sous le `<Suspense>` de `AppLayout`. Ajouter la route au même endroit,
    enveloppée de `<Protected>`.

28. **La série (streak) est calculée côté client** (`lib/progress.ts`) à partir de
    `/progress/history`, qui ne renvoie que les jours actifs (dates UTC `YYYY-MM-DD`).
    Ne pas la présenter comme une donnée serveur ; l'API ne compte pas encore les
    jours consécutifs.

29. **Un `pnpm build` / `pnpm test` complet pendant que la stack dev tourne
    provoque des 500 intermittentes.** `nest start --watch` redémarre quand
    `apps/api/dist` est réécrit ; pendant le redémarrage le proxy Vite renvoie 500
    sur `/api/v1/*`. Un `pnpm install` en cours de dev a le même effet côté Vite
    (ré-optimisation des dépendances : 500 transitoires sur le proxy). Préférer les
    commandes scopées (`pnpm --filter @kanjipath/web typecheck`,
    `pnpm --filter @kanjipath/web build`) quand l'environnement dev de
    l'utilisateur tourne, et réserver `pnpm test`/`pnpm build` complets à un moment
    sans utilisation interactive (ou prévenir l'utilisateur).

30. **Écriture (`/kanji/:literal/ecriture`) : la validation des traits est
     déterministe et locale.** `stroke-match.ts` échantillonne le tracé KanjiVG
     (commandes `M/L/H/V/C/S/Q/T/Z`, relatives et absolues) puis compare le trait
     dessiné (départ, direction, forme, couverture). Aucune IA, aucun appel réseau.
     Les tolérances sont dans `STROKE_TOLERANCE`. Les SVG assainis n'utilisent en
     pratique que `M`, `c` et `s`. Si la validation semble trop stricte/laxiste,
     ajuster ces seuils et relancer `pnpm --filter @kanjipath/web test`. Le pad
     utilise les Pointer Events avec capture ; l'état du tracé en cours vit dans une
     `ref` (pas d'effet de bord dans un updater `setState` — StrictMode double-invoque).

31. **Pipeline multi-niveaux (N5, N4, N3, N2, N1).** La liste des niveaux vit à DEUX endroits à
    garder alignés : `LEVELS` dans `tools/content/stages/normalize.mjs` et
    `IMPORT_LEVELS` dans `tools/content/lib/importers.mjs`. Chaque niveau a son curaté
    (`content/curated/<niveau>/`) et ses seuils dans `LEVEL_MINIMUMS`
    (`stages/validate.mjs`). Le vocabulaire/phrases est sélectionné niveau par niveau
    (N5 d'abord) avec un `seen` partagé pour éviter les doublons. Le quota de
    vocabulaire JMdict par kanji est dans `VOCAB_QUOTA` (`normalize.mjs`) : 8 mots
    (N5→N3), 10 mots (N2), 15 mots (N1). **Piège** : les seuils N4/N3/N2/N1 sont plus
    bas que N5 (32 exercices / 5 mots / 5 phrases par kanji, total ≥ 5000 / ≥ 10000) —
    ne pas appliquer les seuils N5 à un autre niveau.

32. **Id curatés stables (hash, pas position).** Les mots/phrases curatés ont un id
    `curatedVocabId(writtenForm, reading)` / `curatedSentenceId(japanese)` dérivé d'un
    hash FNV-1a — pas `v-curated-${index}`. Un id par position décalerait tous les
    suivants à chaque ajout et laisserait des orphelins en base au rechargement.
    `content:load` nettoie les orphelins (exercices/mots/phrases absents du pack),
    mais **conserve** les exercices référencés par une session ou un historique de
    révision, et met à `null` les références vers mots/phrases supprimés.

33. **Confusions kanji : filtrées côté API.** Le web rend chaque confusion comme un
    lien `/kanji/<literal>` ; l'API (`content.service.ts#kanjiDetail`) ne renvoie que
    les confusions correspondant à un kanji **publié**. On peut donc laisser dans le
    curaté des confusions vers des kanji d'un niveau pas encore publié (elles
    apparaîtront automatiquement à la publication du niveau). Ne pas créer de lien
    côté web sans cette garantie.

34. **Révision ciblée (`mode: 'targeted'`) : au moins un filtre exigé.** Le body de
    `POST /study/sessions` est validé par `createSessionSchema` (zod, dans
    `contracts`). Le mode `targeted` requiert `target` avec au moins un de
    `level` / `skill` / `kanjiIds` (sinon 400) ; `kanjiIds` est borné à 50. La file
    est construite par `buildTargetedQueue` : cartes dues puis erreurs récentes
    (restreintes aux filtres), puis remplissage par difficulté croissante en variant
    kanji × compétence, plafonné à 20 items. Le ciblage est stocké dans
    `study_sessions.target_json` et renvoyé par `/study/resume`. **Ne pas** réutiliser
    `buildQueue` (il injecte de nouveaux kanji, hors sujet pour une révision ciblée).
    Une session ouverte peut être **abandonnée** via `POST /study/sessions/:id/abandon`
    (items `pending` → `skipped`, `ended_at` posé) ; le web l'expose dans une modale
    « Quitter » de la session. Sans issue (finish/abandon), `/etude` reprend
    indéfiniment la dernière session ouverte. À noter : `stats.totals.sessionsCompleted`
    ne compte que les sessions clôturées avec au moins une réponse.

35. **Statistiques détaillées : la rétention vient du domaine.** `GET /progress/stats`
    calcule la rétention estimée via `FsrsReviewScheduler.retrievability` ( FSRS ),
    uniquement pour les cartes avec `stability > 0` et `reps > 0` (sinon `null`).
    Les ventilations par compétence/niveau lisent `review_logs.exerciseItem.skill` /
    `.level` ; une réponse sans exercice lié n'est comptée que dans les totaux. La
    prévision de charge (`forecast`) compte les cartes actives dues sur 7 jours.
    Côté web, l'onglet Statistiques de la page progression ne charge les données que
    s'il est actif (`enabled: tab === 'stats'`).

36. **Ajout d'un niveau (appliqué pour N3).** (a) Le radical curaté de chaque kanji
    doit être cohérent avec le radical classique de KANJIDIC2 : la correspondance
    numéro → caractère se déduit empiriquement (membres du radical dans KANJIDIC2 ∩
    décompositions krad des kanji cibles). (b) `estimatedLevel` d'un mot est le
    niveau **le plus haut** de ses kanji publiés (`estimatedLevelOf` dans
    `normalize.mjs`) — ne pas revenir au test binaire « tout N5 sinon N4 ».
    (c) Le vocabulaire curaté peut référencer des kanji **non publiés** (ex. 繁 dans
    繁忙期) : les liens kanji sont filtrés sur le référentiel publié à la
    normalisation, le mot reste valide tant qu'un lien au moins survit.
    (d) Un changement de version de pack modifie les seeds des distracteurs : des
    exercices changent d'id et le nettoyage de `content:load` supprime les anciens
    (sauf historique utilisateur) — c'est attendu.

37. **Mini-textes : kanji bornés au niveau.** Chaque `texts.json` curaté est validé :
    tout kanji du corps doit être **publié** et de niveau **inférieur ou égal** au
    niveau du texte (les mots non couverts s'écrivent en kana). La validation échoue
    sinon (`validate.mjs`). `normalize` lit `texts.json` pour **chaque** niveau de
    `LEVELS` : l'absence du fichier fait échouer l'étape. Id stable
    `curatedTextId(title, body)` (hash) — modifier le corps change l'id.

38. **Phrases curatées prioritaires.** Depuis la Phase 3, les phrases curatées
    (`sentences.json`) sont insérées **avant** la sélection Tatoeba par niveau et
    comptent dans le quota par kanji. Conséquence : la sélection Tatoeba diminue
    légèrement (les phrases remplacées deviennent orphelines et sont nettoyées au
    `load`). Ne pas remettre les phrases curatées après la boucle Tatoeba, cela
    annulerait la priorité dans les exercices de contexte.

39. **Équilibrage de la charge (`autoBalance`).** `buildQueue` compte les cartes dues
    (`dueCount`) puis calcule les nouveaux kanji via `computeNewKanjiCount` :
    `min(base, max(0, reviewLimit − dueCount))`. Le mode `free` et
    `autoBalance: false` ignorent la limite. `reviewLimit` borne aussi le `take` des
    cartes dues. Les valeurs par défaut (40 / true) reproduisent le comportement
    historique tant que ≤ 35 révisions sont dues. Tester via
    `study-queue.spec.ts` plutôt qu'en session réelle.

40. **Tailwind ne scanne PAS `packages/ui` automatiquement.** Sans directive
    `@source` dans `apps/web/src/styles/index.css`, les classes utilisées uniquement
    dans `packages/ui/src` ne sont jamais générées (silencieusement absentes du CSS :
    le composant perd sa hauteur, son padding, son dégradé…). C'est resté invisible
    tant que `packages/ui` n'employait que des classes aussi présentes dans
    `apps/web`. La ligne `@source "../../../../packages/ui/src";` (chemin relatif au
    fichier CSS) est **obligatoire**. Après tout ajout de classe dans `packages/ui`,
    vérifier sa présence dans le CSS produit (`vite build` puis grep du `.css` de
    `dist/assets`) : une classe manquante ne produit aucune erreur.

41. **Tatoeba : tokens inconnus de kuromoji.** Une phrase dont un token kanji n'a
    pas de lecture dans IPAdic (ex. 隕石) ne peut pas être annotée. Les phrases
    **Tatoeba** illisibles sont écartées de la sélection (et marquées « utilisées »
    pour ne pas être re-testées aux niveaux suivants) ; une phrase **curatée**
    illisible fait échouer `normalize` — réécrire la phrase avec des mots du
    dictionnaire (ex. préférer 乾燥 à 燥ぐ, 家畜 à 畜う, 肯定 à 肯く).

42. **KANJIDIC2 : lectures non-kana.** Certaines lectures kun sont des mots
    étrangers en katakana (ex. 粉 « デシメートル »). `normalize` filtre : kun
    hiragana uniquement, on katakana uniquement (`KUN_ONLY_RE`/`KATAKANA_ONLY_RE`).
    Ne pas assouplir ce filtre sans mettre à jour `validate.mjs` en face.

43. **Toujours re-générer les exercices après `normalize`.** La sélection des
    phrases/vocabulaire change à chaque `normalize` (quotas, phrases curatées qui
    prennent la priorité). Si l'on lance `validate` sur un `exercises.json` périmé,
    il signale des exercices référençant des phrases « inexistantes ». Enchaîner
    systématiquement `normalize → generate → validate`.

44. **Sélection du vocabulaire (Phase 4a).** `selectVocabulary` score les tags de
    priorité JMdict (`ichi1`, `news1`…) **plus le rang de fréquence journalière
    `nfXX`** (nf01 = le plus fréquent). Un mot n'est éligible qu'au niveau de son
    `estimatedLevel` (le kanji publié le plus haut du mot) : il ne remplit les
    quotas qu'à ce niveau. Une passe « bonus » (`VOCAB_BONUS`, 60 mots/niveau)
    repêche ensuite les mots fréquents dont tous les kanji sont publiés. La
    couverture compte chaque mot pour **tous** ses kanji publiés (agrégation tous
    niveaux). Conséquences : (a) un kanji peut manquer de mots malgré un gros
    quota — vérifier le rapport et compléter en curaté (ex. 千) ; (b) les mots
    contenant un kanji **non publié** gardent une pénalité −150 et ne passent
    jamais la passe bonus ; (c) ne pas réintroduire la sélection « premier niveau
    qui prend » : les mots d'un niveau supérieur polluaient les quotas inférieurs
    (説明 prenait une place de 明 en N5).

45. **`IMPORT_EXTRA` : kanji de l'école primaire absents de `jlpt_new`.**
    kanji-data/kanjiapi laissent `jlpt_new=null` pour certains kanji des grades
    1-6 (分 里 身 畑 的 無 可 孝). Ils sont ajoutés explicitement par niveau dans
    `IMPORT_EXTRA` (`lib/importers.mjs`) et DOIVENT figurer dans le
    `content/curated/<niveau>/kanji.json` correspondant (radical, confusions,
    mnémotechnique) avec une note « ajout éditorial ». Tout nouvel ajout impose
     `import --force` (le jeu de kanji cibles change) puis le cycle complet
     normalize → publish ; vérifier les phrases (un kanji rare comme 孝 n'a presque
     rien dans Tatoeba → phrases curatées obligatoires).

46. **N1 : publication progressive + squelette généré.** Les données FR ne couvrent
    pas tout le N1 : 227 kanji (surtout des kanji de prénoms : 翔 蓮 綾 駿 葵…) n'ont
    **aucune** entrée JMdict à glose française, 401 aucune phrase Tatoeba FR liée.
    Le pack N1 ne publie donc que les kanji couverts (≥ 5 mots ET ≥ 5 phrases,
    mesurés dans `content/normalized/`) : `tools/content/n1-scaffold.mjs` reconstruit
    `content/curated/n1/kanji.json` (ordre traits/fréquence, radicaux par numéro
    classique KANJIDIC2, confusions depuis `content/curated/confusions-fr.json`) et
    écrit `kanji-pending.json` (le reste, avec comptes mots/phrases). **Ne pas éditer
    `content/curated/n1/kanji.json` à la main** : mettre les mnémotechniques dans
    `content/curated/n1/mnemonics/*.json` (`{ littéral: texte }`) puis relancer le
    squelette. Pour mesurer un kanji pending, il doit être temporairement dans le
    référentiel : après sa curation, lancer `n1-scaffold.mjs --all` → normalize →
    `n1-scaffold.mjs` (le pack filtré s'élargit) → normalize une seconde fois avant
    generate → validate. Sans ce second `normalize`, `generate` traite les 1232 kanji
    N1 amorcés au lieu du pack filtré. 219 kanji N1 sans
    sens FR dans KANJIDIC2 : sens curatés dans `content/curated/n1/meanings-fr.json`
    (repli si KANJIDIC2 n'a rien, `stages/normalize.mjs`). Pour vérifier un brouillon
     de mini-texte avant de l'écrire : `node tools/content/check-texts.mjs`
     (référentiel + lecture kuromoji complète).

47. **`content:load` : pas de `notIn`/`in` massif (P2029).** Avec 73k exercices,
    `cleanupOrphans` dépassait la limite de paramètres de requête de MariaDB
    (`P2029: query parameter limit exceeded`). Le nettoyage charge désormais les ids
    en base, fait la différence contre le pack **en JS**, puis requête par lots de
     `CLEANUP_CHUNK` (4000). Ne jamais réintroduire de `notIn` sur la liste complète
     du pack.

48. **Audio Phase 5 : licence par clip, jamais par présomption de corpus.** Le snapshot
    Tatoeba `jpn_sentences_with_audio.tsv.bz2` est importé dans
    `normalized/imported/tatoeba-audio.json` et ne conserve que CC BY 4.0 ou CC BY-NC
    4.0. Chaque clip de `content/curated/audio.json` doit correspondre au snapshot
    (id audio, id phrase, locuteur, licence) et à une entrée checksummée de
    `tools/content/sources.mjs`. Le téléchargement compare le SHA-256 attendu ; la
    normalisation copie seulement les fichiers validés dans `generated/audio/`. Ne pas
    importer les licences ND, vides ou inconnues. Une dictée utilise
    `audio_dictation_kana`, compétence `listening`, carte `AUDIO_DICTATION`, et le
    transcript ne doit jamais apparaître dans le prompt.

49. **Exception audio personnelle (ADR-002).** Pour cette instance privée uniquement,
    les clips Tatoeba CC BY-NC 4.0 sont autorisés avec attribution complète. Ne jamais
    publier les fichiers, le pack ou l'application tant qu'un clip CC BY-NC est chargé ;
    une version distribuée doit revenir aux seules licences compatibles commercialement.

50. **Sélection audio CC BY-NC.** Le snapshot Tatoeba japonais du 2026-08-08 reste la
    source des candidats. `normalize` retient une ressource par phrase avec traduction
    française et annotation kuromoji, privilégie CC BY 4.0, télécharge le clip et
    consigne son SHA-256 dans `reports/audio-selection.json`. Les téléchargements audio
    sont limités à quatre requêtes parallèles pour respecter l'API Tatoeba. Les échecs de
    téléchargement sont consignés mais non publiés. Au second passage, tout checksum
    modifié bloque le pipeline. Le snapshot actuel produit 645 clips automatiques ; ne
    pas figer ce nombre, lire le rapport. Ne créer une entrée dans `audio.json` que pour une
    exception éditoriale ou une dictée dont la réponse kana a été validée. Terminer par
    `content:normalize`, `content:generate`, `content:validate`, `content:publish` et
    `content:load`.

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
2. `pnpm db:migrate` (interactif) ou la recette `migrate diff` + `deploy` (piège 12),
   puis `pnpm db:generate` (Prisma 7 ne régénère plus le client automatiquement).
3. Committer la migration.
4. Si la table reflète un concept du modèle ADR, mettre à jour
   `adr/3-data-model/README.md` et `docs/architecture/overview.md`.

### Ajouter une page front

1. Créer le composant dans `apps/web/src/features/<domaine>/` (export nommé).
2. Déclarer la route dans `apps/web/src/app/app.tsx` : import `lazy` (piège 27),
   route enveloppée de `<Protected>` (qui applique `RequireAuth` + `AppLayout`).
3. Utiliser `apiFetch` (`apps/web/src/lib/api.ts`) pour les appels.
4. Suivre le design system : tokens de `styles/index.css` (`bg-surface`,
   `text-ink`, `border-line`, `text-accent`…), composants `packages/ui`,
   états loading (`Skeleton`), vide (`EmptyState`) et erreur (`ErrorState`).
   Jamais de couleurs `zinc-*`/hexadécimales en dur. Voir
   `docs/architecture/overview.md#design-system-web`.
5. Si la page contient de la logique pure (calcul, parsing, géométrie), la mettre
   dans un module dédié et la tester avec Vitest :
   `pnpm --filter @kanjipath/web test`.
6. `pnpm --filter @kanjipath/web typecheck`.

### Modifier le contenu curaté d'un niveau (N5, N4, N3, N2)

1. Éditer `content/curated/<niveau>/kanji.json` (ordre, radicaux, confusions,
   mnémotechniques) ou `vocabulary.json` / `sentences.json` / `texts.json`
   (complétion). Les mini-textes ne doivent employer que des kanji du niveau ou
   inférieurs (piège 37). **Exception N1** : le kanji.json est généré par
   `tools/content/n1-scaffold.mjs` (piège 46) — éditer `mnemonics/*.json`,
   `meanings-fr.json`, `vocabulary.json`, `sentences.json`, `texts.json` puis
   relancer le squelette.
2. Relancer `pnpm content:normalize && pnpm content:generate && pnpm content:validate`.
   Pour N1, suivre la séquence d'amorçage complète du piège 46.
3. `pnpm content:report` pour vérifier la couverture (seuils par niveau dans
   `LEVEL_MINIMUMS` : N5 ≥ 40 exercices / 6 mots / 6 phrases, N4 et N3 ≥ 32 / 5 / 5).
4. `pnpm content:publish && pnpm content:load` pour publier et recharger en base.

### Ajouter un nouveau niveau (ex. N1 — recette appliquée pour N3 puis N2, voir piège 36)

1. Croiser deux listes reconnues (kanji-data `jlpt_new=<n>` + miroir kanjiapi) et
   vérifier contre le champ `jlpt` historique de KANJIDIC2 ; consigner les divergences.
2. Ajouter le niveau à `IMPORT_LEVELS` (`lib/importers.mjs`) et `LEVELS`
   (`stages/normalize.mjs`) ; définir ses seuils dans `LEVEL_MINIMUMS`
   (`stages/validate.mjs`) et les quotas (`SENTENCES_PER_KANJI`, `MIN_WORDS`,
   `MIN_SENTENCES` dans `normalize.mjs`).
3. Incrémenter la version du curriculum dans `stages/normalize.mjs`
   (ex. `2026.08.3` → `2026.08.4`) : elle nomme le manifeste et seede les exercices.
4. Créer `content/curated/<niveau>/kanji.json` (ordre pédagogique, radical +
   `nameFr`/`meaningFr`, confusions, mnémotechniques) et `vocabulary.json` /
   `sentences.json` (vides au départ, à compléter selon `content:report`).
5. Compléter `content/curated/components-fr.json` pour tout nouveau composant krad
   (sinon affiché sans nom sur la fiche).
6. `node tools/content/run.mjs import --force` (le jeu de kanji cibles change), puis
   `pnpm content:build && pnpm content:load`.

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

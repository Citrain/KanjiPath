# Guide de l'agent de code

Ce document complète `AGENTS.md`. Il décrit les conventions, les **pièges connus**
(rencontrés réellement) et des recettes courantes. Si tu découvres un nouveau piège,
ajoute-le ici.

## Démarrer une tâche

1. Lire `AGENTS.md`, puis le dossier `adr/` du thème concerné. Pour la conversation,
   lire aussi ADR-003 et `docs/operations/local-ai.md`.
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
| Conversation vocale locale | `apps/api/src/modules/conversation/`, `apps/web/src/features/conversation/`, contrats `conversation.ts` ; ADR-003 ensuite |
| Quiz IA local | `apps/api/src/modules/ai-quiz/`, `apps/web/src/features/ai-quiz/`, contrats `ai-quiz.ts` ; ADR-004 ensuite |
| Extensions produit acceptees | ADR-005 a ADR-011 a la racine : mission, carte kanji, carnet, shadowing, immersion, timeline, mode zen |
| Mission quotidienne | `StudyService#createDailyMission/dailyMission`, contrats `daily-mission.ts`, tables `daily_missions` / `daily_mission_steps`, page `/mission` |
| Carte visuelle des kanji | `ContentService#kanjiMap`, contrat `KanjiMapResponse`, page `/kanji/:literal/carte` |

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

48a. **Réponses kana : supprimer les caractères invisibles au contrôle.** Le clavier ou
    le copier-coller peut introduire `U+200B` à `U+200D`, `U+2060` ou `U+FEFF`, invisibles
    dans le champ mais distincts pour JavaScript. `normalizeAnswer` dans
    `apps/api/src/modules/study/grader.ts` les retire, comme les espaces et la ponctuation.
    Conserver ce comportement pour que deux réponses identiques à l'écran ne soient jamais
    évaluées différemment.

48b. **Dictées audio automatiques : lecture tokenisée seulement.** `generate.mjs` dérive la
    réponse depuis les tokens de la phrase audio, jamais depuis le transcript kanji. Une dictée
    est créée seulement si la lecture concaténée est entièrement en hiragana/katakana après
    retrait de la ponctuation et fait au plus 36 caractères. Ce filtre conserve des corrections
    vérifiables et évite les phrases avec chiffres ou lectures manquantes.

51. **Conversation locale : LLM borné par l'application.** ADR-003 autorise Ollama
    seulement pour le dialogue oral ; les exercices restent fixes. Le frontend ne doit
    appeler ni Ollama, ni faster-whisper, ni VOICEVOX. Le backend utilise des providers
    injectables, valide strictement la sortie JSON du LLM et ne retente qu'une fois. Une seconde
    sortie invalide échoue sans persistance, jamais avec une fausse réplique générique. Les
    services sont limités à `127.0.0.1`; aucun audio ou transcript n'est envoyé à un tiers par
    défaut.

52. **Conversation locale : partial != final.** Seul `stt.final` est persisté et
    transmis au LLM. `stt.partial` est une hypothèse UI instable. Ne pas conserver les
    audios par défaut ; limiter taille des chunks, durée des tours et historique afin
    de borner mémoire et données utilisateur. Consulter `docs/operations/local-ai.md`
     avant de modifier le setup GPU, Docker, STT ou TTS.

53. **Conversation locale : WebSocket API uniquement.** La route navigateur est
    `/api/v1/conversations/:id/live`, authentifiée par le cookie de session et proxyfiée
    par Vite en développement (`ws: true`). Les chunks PCM mono 16 kHz sont limités à
    64 KiB et 2 MiB par tour; ne pas exposer une URL des services locaux au web.

54. **Conversation locale : démarrage STT.** `services/stt/` contient le conteneur
    faster-whisper et son protocole HTTP/WebSocket. Dans Docker, Uvicorn écoute
    `0.0.0.0` seulement dans le conteneur; la publication Docker DOIT rester
    `-p 127.0.0.1:8765:8765`. Le gateway met en file au plus huit messages avant
    l'authentification, puis relaie les partials sans persistance.

55. **Démarrage vocal Windows.** `dev.ps1 -Voice` et `pnpm dev:voice` préparent le venv
    `services/stt/.venv`, démarrent Ollama/STT et activent `LOCAL_AI_ENABLED` seulement
    pour ce processus de développement. Ne pas lancer cette option par défaut : elle peut
    télécharger un modèle Ollama et consommer CPU/GPU. VOICEVOX demande un port 50021 déjà
    actif ou le paramètre explicite `-VoicevoxPath`.

56. **Venv STT local.** `services/stt/.venv` est un environnement généré, ignoré par Git
    et Biome via `.venv/`. Ne jamais y appliquer de formatage ni y committer une dépendance.
    `dev.ps1 -Voice` transmet `STT_MODEL`, `STT_DEVICE` et `STT_COMPUTE_TYPE` de `.env`
    au processus séparé : modifier ces variables impose un redémarrage du STT.
    `ctranslate2.get_cuda_device_count()` peut détecter un GPU même si les DLL CUDA 12/
    cuDNN 9 ne sont pas accessibles : `cublas64_12.dll` absent impose le retour CPU.
    Sous Windows, installer les wheels NVIDIA CUDA Runtime, NVRTC, cuBLAS et cuDNN dans le
    venv STT; `dev.ps1` ajoute leurs répertoires `nvidia/*/bin` au `PATH` seulement pour
    le processus STT. Les versions installées sont consignées dans
    `docs/operations/local-ai.md`.

57. **Délai LLM local.** La génération Ollama attend 120 secondes et le modèle reste dix
    minutes en mémoire après une réponse. Les health checks restent bornés à huit secondes.
    Augmenter explicitement `OLLAMA_TIMEOUT_SECONDS` pour un modèle exécuté sur CPU plutôt que
    de coder un délai différent dans le provider. Le STT `large-v3-turbo` sur CPU a un délai de
    tour distinct de 60 secondes; ne pas le réduire à 15 secondes.

58. **Qwen en conversation.** Envoyer `think: false` à Ollama pour les tours structurés
    de conversation : le raisonnement interne augmente la latence et peut empêcher une
    réponse JSON courte d'arriver avant le délai, sans apporter de valeur pédagogique.

59. **Sessions conversationnelles.** Les sessions et tours restent persistés pour le suivi
    pédagogique, mais `/conversation` n'affiche ni historique ni reprise. La route
    `POST /conversations/:id/reopen` reste disponible côté API et clôture toute autre
    session active du même utilisateur.

60. **Champs de réponse japonais.** La validation Zod exige un caractère japonais dans
    `reply.ja` et uniquement du latin imprimable dans `reading`. Ne pas imposer ce schéma
    complet au décodeur Ollama: sur Qwen 14B il peut bloquer la génération; utiliser son
    mode JSON natif, puis valider et réparer une seule fois côté API.

60a. **Relance conversationnelle : ne jamais renvoyer la question courante.** Une question
    de suivi doit différer de la question de l'utilisateur et de celles déjà posées par le
    partenaire (`conversationReplyIssue`). Sinon l'échange peut boucler. Une régénération est
    tentée; si elle échoue ou reproduit encore la question, le tour échoue sans persistance. Le
    test de régression est dans `conversation.orchestrator.spec.ts`.

61. **WebSocket STT et Node 24.** Le `final` de `startLive` peut être rejeté par une
    fermeture socket avant que `finish()` ne l'attende. Toujours lui attacher un `catch`
    neutre à sa création, sinon Node traite ce rejet comme non géré et arrête NestJS.
    Si le streaming échoue, envoyer uniquement le buffer mémoire du tour terminé vers
    `POST /transcribe`; ne jamais le persister.

62. **Retour microphone navigateur.** Le vu-mètre de `/conversation` est calculé sur les
    échantillons `getUserMedia` avant leur envoi. Il atteste seulement la capture locale,
    jamais la réception STT; conserver cette distinction dans son libellé.

63. **Tour conversationnel optimiste.** Après un envoi texte ou l'arrêt du micro, afficher
    immédiatement une bulle utilisateur et un loader partenaire, puis verrouiller le
    formulaire jusqu'à `assistant.text` ou `error`. Pour la voix, la bulle commence par
    l'état de transcription et est remplacée par `stt.final`.

64. **VOICEVOX Windows.** Installer l'édition CPU avec Winget (`HiroshibaKazuyuki.VOICEVOX.CPU`)
    quand Ollama et le STT occupent la VRAM. `dev.ps1 -Voice` recherche l'installation Winget
    via le registre utilisateur et démarre `VOICEVOX.exe`; conserver cette détection comme
    secours au paramètre explicite `-VoicevoxPath`.

65. **Libellés VOICEVOX.** L'API retourne des noms et styles japonais. Le sélecteur web les
    romanise et traduit les styles connus; utiliser `Voix <id>` et `Style <id>` comme
    fallback plutôt que d'afficher un libellé uniquement japonais.

66. **Révision grammaticale conversationnelle.** Une demande libre de réviser une forme
    (ex. `〜ている`) reste une instruction de dialogue, pas la création d'un exercice LLM.
    Le prompt doit maintenir cette forme, corriger les essais et relancer; ne jamais répondre
    par une formule d'abandon après une erreur partielle.

67. **Réponses contextualisées.** Le partenaire doit interpréter toute réponse brève,
    elliptique ou en romaji à partir de l'échange précédent. La correction appartient à sa
    carte dédiée; la réplique doit apporter une information ou réaction nouvelle, jamais
    seulement répéter la réponse utilisateur. Une question de suivi est optionnelle : une
    politesse ou une instruction qui poursuit naturellement une mise en scène est valide.

68. **Historique conversationnel complet.** Le prompt reçoit tous les tours de la session,
    pas une fenêtre des derniers tours. Les tours sont fournis à Ollama comme messages
    `user`/`assistant`, pas sérialisés dans le prompt système. Avant de répondre, le LLM reçoit
    l'instruction de relire ce contexte complet. Prévoir un `OLLAMA_CONTEXT_LENGTH` suffisant;
    cette instance locale utilise 32 768 tokens.

69. **Sévérité des corrections.** Une omission lexicale, une forme incomplète ou une phrase
    non naturelle est `important`, même si le sens reste devinable. Ainsi le mode de correction
    « Importantes » ne masque pas les essais que l'apprenant doit retravailler.

70. **Relecture romaji.** Si une entrée tout en romaji reçoit `correction: null`, faire une
    seule relecture locale avec le même historique. N'adopter son résultat que s'il contient une
    correction réellement nécessaire; sinon préserver la réponse initiale.

71. **Relances non répétitives.** Une relance doit développer le sujet et ne pas redemander
    une information déjà donnée. Rejeter une sortie dont la question est identique à une
    question assistant présente dans l'historique, puis régénérer une seule fois avec ce
    contexte.

72. **Romaji elliptique.** Les petits modèles confondent facilement une réponse incomplète et
    une salutation. Le prompt de conversation doit donc inclure un exemple contrasté : ne jamais
    corriger `genki desu ka`, mais corriger `ki desu` en `元気です` seulement après une question
    assistant qui rend cette intention non ambiguë. La relecture romaji emploie un prompt court
    distinct du prompt de dialogue et un mini-contrat (`needed`, `corrected`, `explanationFr`),
    pour éviter que ses nombreuses règles masquent la correction. L'API valide ce contrat puis
    ajoute la correction a une reponse deja validee. Ne pas coder cette association comme une
    règle métier : conserver la validation JSON et la relecture romaji du backend.

73. **JSON LLM partiellement structuré.** Qwen peut fournir `corrected` sans `needed`,
    `severity` ni `explanationFr`. Le backend accepte seulement cette forme de correction
    identifiable, complète les métadonnées et une explication française minimale, puis valide le
    résultat final avec le schéma Zod public. Ne pas accepter arbitrairement des champs inconnus
    ni contourner la validation du contrat API.

74. **Fausse correction.** Si `corrected` est identique au transcript après normalisation NFKC,
    casse, espaces et ponctuation, supprimer la correction avant de répondre : le web doit
    afficher l'état vert `Phrase correcte.`, pas une carte de correction vide ou redondante.

75. **Correction lisible débutant.** `correction.corrected` est affiché directement dans
    `A dire`: le prompt doit donc exiger uniquement du hiragana ou katakana, sans kanji. Les
    kanji restent possibles dans `reply.ja`, mais pas dans la reformulation ni les exemples
    japonais de l'explication française.

76. **Romaji correct.** Ne jamais créer une correction uniquement parce que le modèle réécrit du
    romaji en kana. Les conventions simplifiées de voyelles longues et les emprunts tels que
    `menu` sont acceptés tant que la grammaire et le sens sont corrects.

77. **Qualité de la réplique avant persistance.** Une réponse générique, une réplique déjà
    produite ou une question identique à celle du tour courant ou de l'historique déclenche une
    unique régénération. Si elle reste insatisfaisante, lever une erreur réessayable sans créer de
    tour. Ne jamais réintroduire un fallback conversationnel statique : il polluerait l'historique
    et donnerait une fausse impression de réussite.

78. **Contrat génératif minimal.** Le LLM produit seulement `reply`, `correction` et
    `conversation`. Le backend ajoute `learning` vide et reste seul propriétaire des identifiants
    de progression. Le schéma des nouvelles sorties impose une correction en kana; le schéma de
    lecture des tours persistés reste compatible avec les anciennes corrections contenant des
    kanji.

79. **Évaluation locale du prompt.** Le test opt-in
    `conversation.local-eval.spec.ts` utilise le vrai `OllamaProvider` et l'orchestrateur complet.
    Lancer depuis `apps/api` avec
    `$env:RUN_LOCAL_AI_EVAL='true'; $env:LOCAL_AI_ENABLED='true'; pnpm exec dotenv -e ../../.env -- vitest run src/modules/conversation/conversation.local-eval.spec.ts`.
    Il lit `OLLAMA_MODEL` dans `.env`; avec `gemma4:26b`, les scénarios loisirs multi-tour et
    restaurant doivent passer avant toute modification majeure du prompt ou du modèle.

80. **Situation conversationnelle libre.** L'UI propose les scénarios spécialisés mais sélectionne
    `free` par défaut. Le champ « Situation ou objectif » est envoyé dans `goals` et peut préciser
    ou remplacer ce cadre. Le guide de prompt `free` ne force ni présentation ni rôle; garder ce
 scénario en première position dans `CONVERSATION_SCENARIOS` et dans le catalogue API.

81. **Quiz IA local : snapshot et correction séparés.** Le LLM produit uniquement le contenu
    conforme à `aiQuizModelOutputSchema`; l'API le matérialise puis valide `aiQuizDraftSchema`.
    Ne jamais retourner le champ `correct` dans `AiQuizSessionDto`, ne jamais rappeler le LLM lors
    d'une réponse et ne
    jamais transformer une session IA en `ExerciseItem`, carte FSRS ou contenu du pipeline. Une
    question invalide reçoit au plus quatre générations atomiques puis la création échoue sans
    persistance. Les autres questions valides ne sont pas redemandées. Les questions d'écoute
    passent par `AiQuizOrchestrator#audio` et VOICEVOX, sans
    stockage audio.
    Pour `pair_match`, le grader doit comparer l'ensemble exact des paires : une paire dupliquée
    ne doit jamais faire passer une association incomplète.

82. **Quiz IA local désactivé.** Ollama peut répondre sur `127.0.0.1:11434` tout en restant
    inutilisable par l'API : `LOCAL_AI_ENABLED` doit explicitement valoir `true` dans `.env`,
    puis l'API doit être redémarrée. Le générateur retourne alors le code
    `LOCAL_AI_DISABLED` plutôt qu'un message générique.

83. **Génération Quiz IA bornée.** Ne pas réutiliser la limite courte de conversation
    `OLLAMA_MAX_TOKENS`, mais fixer `maxTokens` à 1024 tokens par question. Ne jamais remettre
    `unlimited: true` / `num_predict: -1` : pendant l'évaluation réelle, `gemma4:26b` a continué
    après un JSON complet avec des commentaires jusqu'à faire durer deux générations près de dix
    minutes. Chaque question est un appel séparé borné à 1024 tokens; une sortie invalide autorise
    jusqu'à quatre tentatives de cette question avec son diagnostic. Ne jamais réintroduire la
    génération du quiz entier en un appel ni une boucle de tentatives.

84. **Contrat compact Quiz IA.** Le LLM produit exactement cinq champs par question : `japanese`,
    `kana`, `options`, `answerIndex` et `explanationFr`. Il ne produit jamais type, titre de mission,
    consigne, aide, tag, identifiant, compétence, difficulté ou étape. `materializeQuiz` construit
    ces données et la clé de correction. Ne pas revenir au contrat riche précédent :
    `gemma4:26b` corrompt des clés et continue parfois après le JSON quand la structure est longue.
    Le test opt-in `ai-quiz.local-eval.spec.ts` valide une génération réelle N5 de cinq questions.

85. **Lectures Quiz IA.** Chaque `japanese` possède un `kana` sans kanji. Pour l'écoute,
    `japanese` devient le texte audio interne et n'est pas exposé avant lecture. Les options sont en
    français ou en kana sans tableau parallèle; les lectures restent une aide visuelle, jamais une
    clé de correction. `reading_qcm`, `cloze_qcm` et `conjugation_qcm` exigent quatre options
    distinctes entièrement en kana; refuser le romaji plutôt que de tenter de le convertir.
    En génération active, `reading_qcm` ne vient pas du LLM :
    `buildDeterministicReadingQuestion` choisit un mot pertinent et trois autres lectures publiées.
    Le web masque `prompt.kana` avant le feedback. `cloze_qcm` et `conjugation_qcm` sont refusés si
    `japanese` ou `kana` ne contient pas exactement `＿＿＿`.

86. **Limite d'authentification locale.** `register` et `login` utilisent uniquement la limite
    globale de `ThrottlerGuard` (300 requêtes / 15 min par client). Ne pas ajouter de limite
    spécifique sans mécanisme clair de déblocage : elle entrave les essais manuels locaux.

87. **Compétences applicatives Quiz IA.** `normalizeQuizInput` ajoute avant génération et
    persistance la compétence imposée par chaque format. `materializeQuestion` l'assigne depuis
    `AI_QUIZ_REQUIRED_SKILL_BY_TYPE`; le modèle ne reçoit et ne retourne jamais `skill`. Garder ce
    mapping exhaustif synchronisé avec `AI_QUIZ_TYPES`.

88. **Génération QCM uniquement.** `createAiQuizSchema` accepte uniquement les sept types QCM. Le
    schéma de snapshot conserve ordre et association pour relire d'anciennes sessions, mais ces
    branches ne doivent jamais revenir dans `aiQuizModelOutputSchema`. Tout QCM porte exactement
    quatre `options` et `answerIndex`; tout `japanese` possède son `kana`. Ne pas convertir une
    sortie invalide : la correction ne peut pas être déduite honnêtement.
    Si la taille demandée permet de couvrir tous les formats sélectionnés, `parseGeneratedQuiz`
    impose aussi cette couverture; ne pas accepter silencieusement un format sélectionné absent.
    Le Quiz passe le schéma atomique produit par `createAiQuizModelQuestionJsonSchema()` au provider
    Ollama et une température `0`. Le type est planifié par l'application et injecté seulement
    après validation. Ne pas le remplacer par le simple `format: "json"`,
    qui garantit une syntaxe JSON mais pas les
    noms des propriétés. Cette contrainte structurée reste spécifique au snapshot de quiz, pas à
    la conversation.
    Le schéma transmis ne contient ni type ni tableau et décrit une seule question QCM. Le nombre
    et les types sont planifiés par l'application, qui en déduit aussi les compétences. Ne
    pas envoyer le schéma de snapshot global : avec `gemma4:26b`, quatre branches QCM concurrentes
    ont provoqué une erreur Ollama après plus de cinq minutes.
    Les options de QCM ne contiennent jamais de kanji : utiliser français ou kana. Les lectures
    associées aux options faisaient échouer les petits modèles plus souvent qu'elles n'aidaient
    l'apprenant; les kanji restent dans l'énoncé accompagné de sa lecture `kana`.
    L'UI ne présente pas les formats ni compétences bruts : ses quatre modes sélectionnent un
    sous-ensemble fiable. `Révision guidée` utilise seulement les quatre QCM usuels et cinq
    questions par défaut (dix au maximum dans l'UI). Ne réexposer ni les 20 questions ni les
    renderers avancés dans ce parcours sans refaire l'évaluation Ollama : les snapshots longs et
    hétérogènes dégradent la conformité JSON de ce modèle local.
    `parseAiQuizModelJson` accepte uniquement un objet JSON brut complet. Ne pas extraire un objet
    depuis du markdown, corriger un antislash, renommer un champ, ignorer une propriété inconnue ou
    contourner `aiQuizModelOutputSchema`. La seule récupération autorisée est une régénération
    atomique avec le diagnostic de validation et le même schéma.
    `aiQuizModelOutputSchema` est strict pour toute nouvelle génération, mais
    `aiQuizDraftSchema` lit aussi les snapshots historiques, qui peuvent ne pas avoir toutes les
    lectures kana ou compétences imposées aujourd'hui. Ne jamais durcir ce schéma de lecture sans
    migration des sessions existantes : `history()` et `get()` doivent toujours pouvoir ouvrir un
    quiz déjà persisté.

88a. **Lisibilité du Quiz IA.** Conserver la zone de question à `max-w-4xl`, les choix principaux à
    au moins 48 px de haut et les textes pédagogiques à `text-base` minimum. Les gros textes japonais
    restent responsifs (`text-4xl sm:text-5xl`) et les cartes repassent en une colonne sur mobile.
    Ne pas réduire localement ces tailles pour faire tenir davantage d'informations à l'écran.

88b. **Mission prioritaire Quiz IA.** Le texte libre n'est pas un simple thème décoratif.
    `selectRelevantConstraints` classe jusqu'à 300 mots et 120 phrases avec les termes français ou
    japonais de la mission, puis n'envoie que les correspondances (24 mots et 10 phrases maximum).
    S'il n'existe aucune correspondance, le repli reste petit (12 mots, 6 phrases). Le prompt répète
    la mission dans le système et le message utilisateur. Ne réinjecter aucune longue liste de
    fréquence non filtrée : elle détourne `gemma4` vers un quiz générique.

88c. **Diversité entre Quiz IA.** `create()` charge les trois snapshots les plus récents dont le
    `prompt` est identique. Leurs énoncés japonais sont injectés comme exclusions et revalidés par
    `parseGeneratedQuestion`; une répétition exacte consomme une tentative. Un `seed` aléatoire
    choisit l'angle pédagogique, tourne les références et décale les lectures déterministes. Garder
    `temperature: 0.35` : revenir à `0` reproduit le même quiz, mais augmenter fortement cette
    valeur dégrade le contrat JSON. Le test local opt-in génère deux fois la même mission et exige
    deux ensembles d'énoncés disjoints.

89. **Contrats compilés et API en développement.** `@kanjipath/contracts` est chargé depuis
    `dist/` et Node le met en cache. Après sa reconstruction, `nest start --watch` ne redémarre pas
    nécessairement l'API car aucun fichier sous `apps/api/src` n'a changé. Redémarrer le processus
    API pour charger le nouveau contrat; sinon il peut continuer à valider l'historique avec un
    schéma obsolète malgré un `packages/contracts/dist` correct.

90. **Exclusion de la saisie kana.** La préférence `kanaInputEnabled` est appliquée dans
    `StudyService#loadExercises` avant la construction de toute file. Lorsqu'elle est désactivée,
    exclure `reading_input_kana` et `audio_dictation_kana` dans tous les modes, mais conserver les
    QCM dont les options sont en kana : ils ne nécessitent pas de clavier japonais. Une session déjà
    créée garde sa file persistée; la préférence s'applique aux nouvelles sessions.

91. **Kanji connu manuellement.** `POST /kanji/:literal/known` fixe tous les scores à
    `1`, passe le statut à `mastered` et suspend les cartes existantes. Ajouter aussi le
    kanji à l'ensemble `discoveredIds` de `buildQueue`, sinon il serait introduit à nouveau
    en tant que nouveau kanji. Les révisions ciblées restent volontairement disponibles.

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

### Implémenter le mode conversation locale

1. Lire ADR-003, `adr/12-local-ai-conversation.md` et `docs/operations/local-ai.md`.
2. Mettre à jour contrats, schéma Prisma et migration avant les contrôleurs.
3. Créer les providers injectables et `ConversationOrchestrator` ; ne mettre aucune
   logique pédagogique dans un contrôleur HTTP/WebSocket.
4. Couvrir le mode texte et les indisponibilités STT/LLM/TTS avant le micro live.
5. Ajouter tests unitaires (politiques + JSON), intégration (providers mockés) et E2E
   sans exiger un micro physique.

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

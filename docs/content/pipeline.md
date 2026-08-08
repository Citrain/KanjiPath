# Pipeline de contenu

Le contenu pédagogique est une partie du produit : il possède un schéma, une
provenance, une version, une licence, un état de validation et des tests. Aucun LLM
n'est appelé au runtime : les exercices sont fixes, versionnés, validés.

Référence : `adr/2-content-pipeline/README.md`.

## Étapes

```text
download → import → normalize → generate → validate → report → publish → load
```

Chaque étape est invocable individuellement ou en chaîne :

```bash
pnpm content:download
pnpm content:import
pnpm content:normalize
pnpm content:generate
pnpm content:validate
pnpm content:report
pnpm content:publish
pnpm content:build        # enchaîne download → publish (sans load)
pnpm content:load         # charge le pack publié dans MariaDB (DATABASE_URL)
```

L'étape `import` est **réutilisable** : chaque artefact (`kanjidic.json`, `krad.json`,
`jmdict.json`, `tatoeba.json`, `kanjivg-index.json`) n'est recalculé que s'il est
absent ou avec `--force`. Les téléchargements (`content/raw/`) sont conservés et
réutilisés tant qu'ils existent.

## Implémentation (Phase 1)

| Étape | Rôle | Sorties |
|---|---|---|
| `download` | télécharge KANJIDIC2, JMdict, KRADFILE (JSON), KanjiVG, Tatoeba, kanji-data ; calcule les checksums sha256 | `content/raw/*`, `content/reports/download.json` |
| `import` | parse les sources brutes (XML KANJIDIC2, XML JMdict en flux, TSV Tatoeba + liens, zip KanjiVG) | `content/normalized/imported/*.json` |
| `normalize` | fusionne avec le curaté (`content/curated/`), sélectionne vocabulaire (JMdict FR) et phrases (Tatoeba), **annote les phrases** (tokenisation kuromoji : lecture kana + romaji par token), calcule le **romaji** des lectures de kanji et du vocabulaire, extrait et **assainit** les SVG KanjiVG | `content/normalized/{kanji,vocabulary,sentences,curriculum,sources}.json`, `content/generated/kanjivg/*.svg` |
| `generate` | génère les exercices de façon **déterministe** (seed = gabarit + kanji + variante + version du pack) | `content/generated/exercises.json` |
| `validate` | applique les règles ADR (doublons, réponses, distracteurs, seuils de couverture **par niveau**, licences, provenance) ; échec bloquant | `content/reports/validate.json` |
| `report` | rapport de couverture par kanji et par niveau | `content/reports/report.json` |
| `publish` | pack final (`editorialStatus: published`) + manifeste versionné | `content/generated/pack/*.json`, `content/manifests/<version>.json` |
| `load` | upsert idempotent du pack dans MariaDB via Prisma (les id pack deviennent les id DB) + **nettoyage des contenus orphelins** (sans écraser l'historique utilisateur) | base `kanjipath` |

### Dépendances du pipeline

- Node natif : `fetch`, `zlib`, `node:crypto`.
- Paquets racine : `fast-xml-parser` (XML), `unbzip2-stream` (bz2), `tar` (archives),
  `yauzl` (zip KanjiVG), `kuromoji` (tokenisation japonaise, dictionnaire IPAdic
  embarqué).
- Étape `load` : réutilise le **client Prisma généré** de l'API
  (`apps/api/src/generated/prisma/client.ts`) et `createDbAdapter`
  (`@prisma/adapter-mariadb`), importés en direct par Node 24 (type stripping).
  Lancer `pnpm db:generate` avant si le client n'existe pas.
- `pnpm build` doit avoir été lancé au moins une fois si vous validez contre les
  schémas Zod de `@kanjipath/content-schema` (le pipeline lui-même n'en dépend pas).

### Lectures et romaji

- Le **romaji** (Hepburn modifié) est calculé au build par
  `tools/content/lib/romaji.mjs` (déterministe, testé) : lectures des kanji,
  vocabulaire, tokens de phrases. Jamais calculé au runtime.
- Les **phrases** sont tokenisées par kuromoji au build : chaque token porte
  `surface`, `reading` (hiragana), `romaji`, `startOffset`/`endOffset`. Une phrase
  dont un token kanji n'a pas de lecture fait échouer `normalize`.
- Les exercices qui **demandent une lecture** n'incluent jamais le furigana/romaji
  du mot cible (masquage par position, voir `sentencePromptTokens` dans
  `tools/content/lib/generators.mjs`) pour ne pas donner la réponse.

## Sources et choix des niveaux (N5, N4, N3)

Le pipeline est **multi-niveaux** : la liste des niveaux est portée par
`LEVELS = ['N5', 'N4', 'N3']` dans `tools/content/stages/normalize.mjs` et
`IMPORT_LEVELS = [5, 4, 3]` dans `tools/content/lib/importers.mjs`. Chaque niveau a
son curaté (`content/curated/n5/`, `content/curated/n4/`, `content/curated/n3/`),
ses seuils (voir plus bas) et sa sélection propre de vocabulaire/phrases. Le
vocabulaire et les phrases sont sélectionnés **niveau par niveau** (N5 d'abord),
sans doublon entre niveaux.

- **Liste N5** : 79 kanji, croisement de deux jeux dérivés de kanjiapi.dev
  (`kanji-data`, MIT, et son miroir) — identiques — vérifiés contre le champ `jlpt`
  historique de KANJIDIC2 (niveau 4, 103 kanji : les 24 supplémentaires sont
  signalés comme divergence et classés N4). Voir
  `content/curated/n5/kanji.json` (ordre pédagogique, radical, confusions,
  mnémotechniques) et `content/normalized/imported/jlpt_cross.json`.
- **Liste N4** : 166 kanji, même croisement kanji-data / kanjiapi — identiques —
  vérifiés contre le champ `jlpt` historique de KANJIDIC2 (niveau 3 : 143 des 166 y
  figurent ; les 23 autres sont signalés comme divergence). Voir
  `content/curated/n4/kanji.json`.
- **Liste N3** : 367 kanji, même croisement kanji-data / kanjiapi — identiques —
  vérifiés contre le champ `jlpt` historique de KANJIDIC2 (niveau 2 : 339 des 367 y
  figurent ; les 28 autres sont signalés comme divergence). Voir
  `content/curated/n3/kanji.json`.
- **Vocabulaire** : glosses françaises de JMdict, priorité aux mots courants
  (`ichi1`, `spec1`, `news1`…) composés de kanji du niveau ; complété si besoin par
  `content/curated/<niveau>/vocabulary.json`.
- **Phrases** : paires japonais→français de Tatoeba (export détaillé + `links`),
  licence **CC BY 2.0 FR** (l'export CC0 ne contient quasiment aucune phrase
  japonaise). Auteur conservé ; si le compte a disparu, attribution « Tatoeba ».
- **KanjiVG** : SVG nettoyés au build (balises `svg/g/path` et attributs autorisés
  uniquement ; aucun attribut préfixé `kvg:` afin de produire un XML valide sans
  déclaration de namespace), servis par `GET /kanji/:literal/svg`.

## Arborescence `content/`

```text
content/
  raw/          # sources brutes téléchargées (checksum dans reports/download.json)
  normalized/   # imported/ (parsé) + kanji|vocabulary|sentences|curriculum|sources.json
  curated/      # enrichissement français rédigé/validé manuellement (versionné)
  generated/    # exercices, SVG KanjiVG, pack publié (reproduit par le pipeline)
  manifests/    # manifeste de chaque pack publié (versionné)
  licenses/     # textes de licence / attribution (versionné)
  reports/      # rapports d'étape (JSON)
```

Seuls `manifests/`, `curated/` et `licenses/` sont versionnés par `.gitkeep` ;
`raw/`, `normalized/`, `generated/` et `reports/` sont gitignorés (reproduits par le
pipeline).

## Règles de génération

- Les exercices sont produits par des **gabarits déterministes** pendant le build :
  le même pack produit exactement les mêmes exercices (seed stable).
- Interdit : générer une réponse aléatoire non validée pendant une session utilisateur.
- Répartition par kanji : sens, lecture, vocabulaire, contexte, composants/traits,
  confusion (voir `tools/content/lib/generators.mjs`).
- **Seuils validés par niveau** (`LEVEL_MINIMUMS` dans
  `tools/content/stages/validate.mjs`) :
  | Niveau | Exercices/kanji | Mots/kanji | Phrases/kanji | Total exercices |
  |---|:---:|:---:|:---:|:---:|
  | N5 | 40 | 6 | 6 | ≥ 3000 |
  | N4 | 32 | 5 | 5 | ≥ 5000 |
  | N3 | 32 | 5 | 5 | ≥ 10000 |

## Validation

Le pipeline refuse le build en cas d'identifiant dupliqué, kanji sans niveau/sens
français, lecture invalide (kana/katakana), exercice sans correction, distracteur
identique à la réponse, options dupliquées après normalisation, phrase sans kanji
cible ou sans attribution (CC BY), seuils non atteints, licence manquante, contenu
`draft` dans le pack, SVG manquant, référence vers ressource inexistante.
Liste complète : `adr/2-content-pipeline/README.md#tests-automatiques-de-contenu`.

## Manifeste de publication

Chaque pack publié produit un manifeste (version, sources + checksums, comptes,
résultat de validation, commit git). Exemple : `content/manifests/2026.08.1.json`.

## Chargement en base (`content:load`)

- Idempotent : upsert par id stables (les id du pack deviennent les id DB), donc la
  progression des utilisateurs (cartes FSRS, historiques) survive aux rechargements.
  Les `exercise_items` existants sont mis à jour sur **toutes** leurs colonnes
  (références vocabulaire/phrase/kanji incluses), pas seulement le contenu.
- Les enfants éditoriaux (sens, lectures, composants, liens curriculum/vocabulaire)
  sont remplacés ; les `review_logs` conservent l'historique (`exercise_items`
  référencés par `external_id`).
- **Nettoyage des orphelins** : après chargement, tout exercice / mot / phrase absent
  du pack publié est supprimé, **sauf** les exercices référencés par une session ou
  un historique de révision (conservés pour ne pas casser la progression). Les
  références d'exercices vers des mots/phrases supprimés sont mises à `null`.
- **Id curatés stables** : les mots et phrases curatés ont un id dérivé d'un hash de
  leur contenu (`curatedVocabId`, `curatedSentenceId`), pas de leur position — un
  ajout ne décale plus les id des suivants (pas d'orphelins au rechargement).
- Ordre : sources → version → radicaux → kanji → curriculum → vocabulaire →
  phrases → gabarits → exercices → nettoyage.

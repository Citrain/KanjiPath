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
| `download` | télécharge KANJIDIC2, JMdict, KRADFILE (JSON), KanjiVG, Tatoeba, kanji-data, le snapshot audio Tatoeba et les clips explicitement sélectionnés ; calcule les checksums sha256 et refuse un checksum audio inattendu | `content/raw/*`, `content/reports/download.json` |
| `import` | parse les sources brutes (XML KANJIDIC2, XML JMdict en flux, TSV Tatoeba + liens + audio, zip KanjiVG) | `content/normalized/imported/*.json` |
| `normalize` | fusionne avec le curaté (`content/curated/`), sélectionne vocabulaire (JMdict FR) et phrases (Tatoeba), matérialise les ressources audio validées, **annote les phrases et les mini-textes** (tokenisation kuromoji : lecture kana + romaji par token), calcule le **romaji** des lectures de kanji et du vocabulaire, extrait et **assainit** les SVG KanjiVG | `content/normalized/{kanji,vocabulary,sentences,texts,audio,curriculum,sources}.json`, `content/generated/{kanjivg,audio}/*` |
| `generate` | génère les exercices de façon **déterministe** (seed = gabarit + kanji + variante + version du pack), dont les dictées audio | `content/generated/exercises.json` |
| `validate` | applique les règles ADR (doublons, réponses, distracteurs, seuils de couverture **par niveau**, kanji des mini-textes bornés au niveau, licences, provenance) ; échec bloquant | `content/reports/validate.json` |
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
- Les **phrases** et les **mini-textes** sont tokenisés par kuromoji au build : chaque
  token porte `surface`, `reading` (hiragana), `romaji`, `startOffset`/`endOffset`.
  Une phrase ou un texte dont un token kanji n'a pas de lecture fait échouer `normalize`.
- Les mois numériques sont corrigés après tokenisation : kuromoji découpe parfois
  `6月` en `6` + `月` et donnerait à tort `つき`; le pipeline les fusionne avec leur
  lecture contextuelle (`6月` → `ろくがつ`).
- Les exercices qui **demandent une lecture** n'incluent jamais le furigana/romaji
  du mot cible (masquage par position, voir `sentencePromptTokens` dans
  `tools/content/lib/generators.mjs`) pour ne pas donner la réponse.
- Les lectures de KANJIDIC2 qui ne sont pas de purs kana (ex. la lecture kun
  « デシメートル » de 粉) sont **filtrées** à la normalisation : kun en hiragana
  uniquement, on en katakana uniquement.

## Sources et choix des niveaux (N5, N4, N3, N2)

Le pipeline est **multi-niveaux** : la liste des niveaux est portée par
`LEVELS = ['N5', 'N4', 'N3', 'N2']` dans `tools/content/stages/normalize.mjs` et
`IMPORT_LEVELS = [5, 4, 3, 2]` dans `tools/content/lib/importers.mjs`. Chaque niveau a
son curaté (`content/curated/n5/`, `content/curated/n4/`, `content/curated/n3/`,
`content/curated/n2/`), ses seuils (voir plus bas) et sa sélection propre de
vocabulaire/phrases. Le vocabulaire et les phrases sont sélectionnés **niveau par
niveau** (N5 d'abord), sans doublon entre niveaux.

- **Liste N5** : 80 kanji, croisement de deux jeux dérivés de kanjiapi.dev
  (`kanji-data`, MIT, et son miroir) — identiques — vérifiés contre le champ `jlpt`
  historique de KANJIDIC2 (niveau 4, 103 kanji : les 24 supplémentaires sont
  signalés comme divergence et classés N4). **1 ajout éditorial** (`IMPORT_EXTRA`) :
  分 (grade 2, jlpt historique 4), absent des listes `jlpt_new` de kanji-data. Voir
  `content/curated/n5/kanji.json` (ordre pédagogique, radical, confusions,
  mnémotechniques) et `content/normalized/imported/jlpt_cross.json`.
- **Liste N4** : 166 kanji, même croisement kanji-data / kanjiapi — identiques —
  vérifiés contre le champ `jlpt` historique de KANJIDIC2 (niveau 3 : 143 des 166 y
  figurent ; les 23 autres sont signalés comme divergence). Voir
  `content/curated/n4/kanji.json`.
- **Liste N3** : 373 kanji, même croisement kanji-data / kanjiapi — identiques —
  vérifiés contre le champ `jlpt` historique de KANJIDIC2 (niveau 2 : 339 des 367 y
  figurent ; les 28 autres sont signalés comme divergence). **6 ajouts éditoriaux**
  (`IMPORT_EXTRA`) : 里 身 畑 的 無 可 (grades 2-5, jlpt historique 1-2), absents des
  listes `jlpt_new` de kanji-data. Voir `content/curated/n3/kanji.json`.
- **Liste N2** : 368 kanji, même croisement kanji-data / kanjiapi — identiques —
  vérifiés contre le champ `jlpt` historique de KANJIDIC2 (niveau 2 : 349 des 367 y
  figurent ; 12 de niveau historique 3 et 6 de niveau 1 sont signalés comme
  divergence). **1 ajout éditorial** (`IMPORT_EXTRA`) : 孝 (grade 6). Ordre curaté :
  traits croissants puis fréquence (type dictionnaire). Voir
  `content/curated/n2/kanji.json`.
- **Vocabulaire** : glosses françaises de JMdict, priorité aux mots courants
  (`ichi1`, `spec1`, `news1`…, **plus le rang de fréquence journalière `nfXX`**)
  composés de kanji du niveau ; un mot n'est sélectionné qu'au niveau de son
  `estimatedLevel` (le kanji publié le plus haut du mot), quota par kanji
  (`VOCAB_QUOTA`) : 8 mots (N5→N3), 10 mots (N2), complété par une passe « bonus »
  (`VOCAB_BONUS`, 60 mots/niveau) qui repêche les mots fréquents dont tous les kanji
  sont publiés ; complété si besoin par `content/curated/<niveau>/vocabulary.json`.
  Le décompte de couverture compte un mot pour **tous** ses kanji publiés, quel que
  soit le niveau de sélection.
- **Phrases** : paires japonais→français de Tatoeba (export détaillé + `links`),
  licence **CC BY 2.0 FR** (l'export CC0 ne contient quasiment aucune phrase
  japonaise). Auteur conservé ; si le compte a disparu, attribution « Tatoeba ».
  Une phrase Tatoeba dont l'annotation kuromoji échoue (token inconnu sans lecture)
  est **écartée** de la sélection (comptabilisée dans le rapport de `normalize`) ;
  une phrase curatée non annotable fait en revanche échouer l'étape.
  Les **phrases curatées** (`content/curated/<niveau>/sentences.json`, rédigées par
  KanjiPath, CC BY-SA 4.0) sont insérées **avant** la sélection Tatoeba : elles sont
  donc servies en priorité dans les exercices de contexte (phrases plus naturelles).
- **Mini-textes** : courts textes de lecture graduée rédigés par KanjiPath
  (`content/curated/<niveau>/texts.json`, CC BY-SA 4.0). Chaque texte n'utilise que
  des kanji du niveau ou d'un niveau inférieur (les autres mots restent en kana) ; la
  validation refuse tout kanji hors référentiel ou de niveau supérieur. Annotés
  (furigana + romaji) au build, servis par `GET /texts` et `GET /texts/:id`.
- **KanjiVG** : SVG nettoyés au build (balises `svg/g/path` et attributs autorisés
  uniquement ; aucun attribut préfixé `kvg:` afin de produire un XML valide sans
  déclaration de namespace), servis par `GET /kanji/:literal/svg`.

### Audio Tatoeba

- Le snapshot `jpn_sentences_with_audio.tsv.bz2` est téléchargé et importé dans
  `content/normalized/imported/tatoeba-audio.json`. Seuls les enregistrements dont la
  licence individuelle est exactement `CC BY 4.0` ou `CC BY-NC 4.0` sont retenus comme
  candidats ; tous les autres sont écartés.
- Le pipeline sélectionne une ressource par phrase japonais-français annotable, en
  préférant CC BY 4.0 à CC BY-NC 4.0 lorsqu'une phrase possède plusieurs clips. Il
  télécharge chaque fichier depuis l'API Tatoeba, enregistre son SHA-256 dans
  `content/reports/audio-selection.json` et refuse toute modification ultérieure du
  checksum. Les refus de téléchargement restent consignés dans ce rapport et ne sont pas
  publiés.
- `content/curated/audio.json` ne contient que les clips ou les dictées nécessitant une
  validation éditoriale explicite. Chaque clip manuel doit correspondre au snapshot sur
  l'identifiant audio, l'identifiant de phrase, le locuteur et la licence.
- Les clips CC BY-NC 4.0 ne sont utilisables que dans l'instance privée définie par
  ADR-002. Leur présence interdit tout partage du pack, publication de l'application ou
  usage commercial.
- Un clip associé à une dictée porte une réponse kana vérifiée manuellement. Le
  transcript est conservé dans la ressource et l'explication, jamais dans le prompt.

## Arborescence `content/`

```text
content/
  raw/          # sources brutes téléchargées (checksum dans reports/download.json)
  normalized/   # imported/ (parsé) + kanji|vocabulary|sentences|texts|curriculum|sources.json
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
- Répartition par kanji : sens, lecture, vocabulaire, **lecture avancée**, contexte,
  composants/traits, confusion (voir `tools/content/lib/generators.mjs`). Le gabarit
  `vocab_reading_advanced_qcm` cible les mots à lecture irrégulière (rendaku, sokuon)
  et propose en distracteur la lecture « régulière » dé-sonorisée.
- **Seuils validés par niveau** (`LEVEL_MINIMUMS` dans
  `tools/content/stages/validate.mjs`) :
  | Niveau | Exercices/kanji | Mots/kanji | Phrases/kanji | Mini-textes | Total exercices |
  |---|:---:|:---:|:---:|:---:|:---:|
  | N5 | 40 | 6 | 6 | 2 | ≥ 3000 |
  | N4 | 32 | 5 | 5 | 2 | ≥ 5000 |
  | N3 | 32 | 5 | 5 | 2 | ≥ 10000 |
  | N2 | 32 | 5 | 5 | 2 | ≥ 10000 |

## Validation

Le pipeline refuse le build en cas d'identifiant dupliqué, kanji sans niveau/sens
français, lecture invalide (kana/katakana), exercice sans correction, distracteur
identique à la réponse, options dupliquées après normalisation, phrase sans kanji
cible ou sans attribution (CC BY), mini-texte dont les tokens ne couvrent pas le
corps ou contenant un kanji hors référentiel / de niveau supérieur, seuils non
atteints, licence manquante, contenu `draft` dans le pack, SVG manquant, référence
vers ressource inexistante.

Pour l'audio, le validateur exige aussi un fichier packagé, un SHA-256, une licence
autorisée, l'identifiant audio Tatoeba, l'identifiant de phrase, le locuteur, une
attribution, un chemin sous `generated/audio/` et un lien valide vers le mot ou la
phrase. Une dictée doit référencer une ressource audio, avoir une correction kana et ne
doit jamais porter le transcript dans son prompt.
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
- **Nettoyage des orphelins** : après chargement, tout exercice / mot / phrase /
  mini-texte absent du pack publié est supprimé, **sauf** les exercices référencés par
  une session ou un historique de révision (conservés pour ne pas casser la
  progression). Les références d'exercices vers des mots/phrases supprimés sont mises
  à `null`.
- **Id curatés stables** : les mots et phrases curatés ont un id dérivé d'un hash de
  leur contenu (`curatedVocabId`, `curatedSentenceId`), pas de leur position — un
  ajout ne décale plus les id des suivants (pas d'orphelins au rechargement). Les
  mini-textes curatés suivent la même règle (`curatedTextId`, hash du titre + corps).
- Ordre : sources → version → radicaux → kanji → curriculum → vocabulaire →
  phrases → mini-textes → gabarits → exercices → nettoyage.

# Suivi Phase 4b — Pack N1 (document de relais agent)

Ce fichier suit l'avancement de la Phase 4b (pack N1, 1232 kanji) afin qu'un
autre agent puisse reprendre exactement là où le travail s'est arrêté.
**Mettre à jour ce fichier à chaque étape franchie.**

## État global

- [x] Pipeline étendu N5→N1 (importers, normalize, validate)
- [x] Import forcé régénéré avec les kanji N1 (JMdict 14146 entrées, Tatoeba 85250 paires)
- [x] Squelette curaté `content/curated/n1/kanji.json` (ordre, radicaux, confusions) —
      généré par `tools/content/n1-scaffold.mjs`
- [x] Table des radicaux manquants `content/curated/radicals-fr.json` (22 entrées)
- [x] Paires de confusions `content/curated/confusions-fr.json` (~200 paires transverses)
- [x] Sens français curatés `content/curated/n1/meanings-fr.json` (219 kanji sans glose KANJIDIC2)
- [x] Mnémotechniques des 433 kanji publiés (`content/curated/n1/mnemonics/batch-01..04.json`)
- [x] Couverture mesurée → décision publication progressive (voir ci-dessous)
- [x] 2 mini-textes N1 (`content/curated/n1/texts.json` : 春の山, 夜の森)
- [x] `pnpm content:validate` vert (1420 kanji, 74009 exercices, 0 erreur, 0 avertissement)
- [x] Docs à jour : `docs/README.md`, `adr/11-phases/README.md`, `docs/agent/guide.md` (piège 46)
- [ ] **Curation des 799 kanji pending** (lots successifs) — voir tableau ci-dessous
- [x] `content:publish` (pack 2026.08.7) + `content:load` en base dev
      (1420 kanji, 10181 mots, 8532 phrases, 10 textes, 74009 exercices chargés)

## Vérifications passées (2026-08-08)

`pnpm typecheck` ✓ · `pnpm lint` ✓ · `pnpm test` ✓ (100 tests) ·
`pnpm content:validate` ✓ (0 erreur, 0 avertissement).

## Contexte utile

- Liste N1 : 1232 kanji, `kanji-data.json` (`jlpt_new === 1`) et miroir
  `kanjiapi-jlpt.json` (`jlpt === 1`) identiques, 0 divergence.
- Fichiers bruts déjà téléchargés dans `content/raw/` (pas de réseau requis).
- L'ordre pédagogique N1 retenu : **traits croissants puis rang de fréquence
  croissant** (comme N2, cf. notes de `content/curated/n2/kanji.json`).
- Le radical est dérivé du numéro classique KANJIDIC2 (`radicalClassical`) via
  le bloc Unicode Kangxi `U+2F00 + n - 1` (le script squelette le fait).
- Les mnémotechniques sont du contenu éditorial KanjiPath (CC BY-SA 4.0). Elles
  ne doivent jamais être présentées comme de l'étymologie.

## Décisions prises

- Minimums validateur N1 alignés sur N2 : `{ exercises: 32, sentences: 5,
  words: 5, texts: 2, total: 10000 }`.
- Quotas normalize N1 : vocabulaire 15 mots/kanji + bonus 100, phrases
  10/kanji (plus haut que N2 pour maximiser la couverture des kanji rares).
- **Publication progressive (décision structurante, à refléter dans l'ADR)** :
  les données FR disponibles ne couvrent pas tout le N1 —
  - 1232 kanji N1 (listes kanji-data / kanjiapi identiques) ;
  - 227 n'ont AUCUNE entrée JMdict avec glose française (surtout des kanji de
    prénoms : 翔 蓮 綾 駿 葵 楓 莉…) et 401 aucune phrase Tatoeba FR liée ;
  - avec les seuils ≥5 mots ET ≥5 phrases : **415 kanji publiables** ;
  - monter les quotas ne change rien (le problème est l'absence de candidats,
    pas la sélection).
  Donc : le pack N1 initial ne contient que les kanji couverts ; les autres
  sont listés dans `content/curated/n1/kanji-pending.json` (avec leurs
  comptes mots/phrases et mnémotechniques déjà écrites). À chaque lot de
  curation (vocabulaire + phrases), relancer normalize + squelette : le pack
  s'élargit mécaniquement. Le squelette filtre d'après la couverture mesurée
  dans `content/normalized/` (option `--all` pour désactiver le filtre).
- 219 kanji N1 sans sens français dans KANJIDIC2 : sens curatés dans
  `content/curated/n1/meanings-fr.json` (repli utilisé uniquement quand
  KANJIDIC2 n'a rien, voir `stages/normalize.mjs`). Provenance : éditorial
  KanjiPath pour ces sens, KANJIDIC2 pour le reste de la fiche.
- Confusions : `content/curated/confusions-fr.json` (paires appliquées aux
  deux membres si les deux sont au référentiel). ~130 kanji N1 couverts ;
  les autres ont des distracteurs de repli (aucune erreur validateur).
- Le squelette est rejouable : `node tools/content/n1-scaffold.mjs` reconstruit
  `content/curated/n1/kanji.json` depuis les bruts + fichiers curatés. Les
  mnémotechniques vivent dans `content/curated/n1/mnemonics/*.json`
  (objets `{ littéral: texte }`, fusionnés par le squelette).

## Avancement curation

| Lot | Contenu | État |
|---|---|---|
| mnemonics/batch-01.json | kanji d'ordre 1–104 (丁…是) | fait |
| mnemonics/batch-02.json | kanji d'ordre 105–280 (看…愚) | fait |
| mnemonics/batch-03.json | kanji d'ordre 281–415 (嫁…驚) | fait |
| mnemonics/batch-04.json | 又, 井, 丘, 玄, 克, 佐, 妥, 汽, 拒, 析, 抵, 帝, 松, 併, 卓, 苗, 盲, 伯 | fait |
| lot 01 | 13 mots et 7 phrases curatés ; 18 kanji publiés (415 → 433) | fait |
| kanji-pending.json | 799 kanji sans couverture suffisante | à curater (vocab + phrases) |

### Procédure pour publier des kanji pending (lot suivant)

1. Lancer d'abord `node tools/content/n1-scaffold.mjs --all`, puis `normalize`, pour
   mesurer les candidats pending avec le référentiel N1 complet. Choisir dans le
   `kanji-pending.json` alors régénéré ceux à 3-4 mots / 3-4 phrases, proches du seuil.
2. Curater dans `content/curated/n1/vocabulary.json` (schéma identique à
   `content/curated/n2/vocabulary.json`) et `sentences.json` jusqu'à ≥ 5 mots et
   ≥ 5 phrases par kanji. Une phrase/un mot compte pour TOUS ses kanji du
   référentiel : grouper les kanji rares dans les mêmes items.
3. Écrire leurs mnémotechniques dans `mnemonics/batch-0X.json`.
4. `node tools/content/n1-scaffold.mjs --all` puis `normalize`, ensuite
   `node tools/content/n1-scaffold.mjs` (le pack s'élargit automatiquement), puis
   `normalize` une seconde fois pour ramener les artefacts au référentiel filtré,
   avant `generate` + `validate`.
5. Mettre à jour ce fichier.

## Prochaine action

1. Lire ce fichier + `AGENTS.md` + `docs/agent/guide.md` (pièges 46, 47).
2. Reprendre la curation des kanji pending (procédure ci-dessous). Le lot 01 s'arrête
   après `伯` ; reprendre avec les kanji à 3-4 mots / 3-4 phrases du fichier pending.
   Après chaque lot : amorçage `--all` → normalize → squelette → normalize → generate
   → validate → publish → load.
3. Après toute modification : `pnpm content:validate` et mettre à jour ce fichier.
4. Le commit de la Phase 4b n'a pas été fait (à la demande implicite de workflow) :
   tout est sur le disque, prêt à committer.

## Commandes

```bash
pnpm content:import --force   # si le référentiel kanji change
node tools/content/run.mjs normalize
node tools/content/run.mjs generate
pnpm content:validate
```

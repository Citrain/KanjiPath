# Licences et provenance

Toute donnée linguistique importée conserve sa source, sa version, sa licence et
son attribution. Ne jamais modifier silencieusement une provenance ou une licence.

Référence : `adr/2-content-pipeline/README.md` (section « Sources principales »).

## Sources et licences

| Source | Usage | Licence | Fichier(s) bruts |
|---|---|---|---|
| KANJIDIC2 | caractère, traits, lectures (on/kun/nanori), sens **dont sens français**, fréquence, niveau scolaire, jlpt historique | EDRDG — CC BY-SA 4.0 | `kanjidic2.xml.gz` |
| JMdict (multilingue) | vocabulaire, graphies, lectures, glosses **françaises**, catégories grammaticales, priorités d'usage | EDRDG — CC BY-SA 4.0 | `JMdict.gz` |
| KRADFILE (EDRDG) | décomposition en composants | EDRDG — CC BY-SA (v3 via la conversion) | `krad.json`, `krad_components.json` (conversion Unicode/JSON [hoffmannjp/krad-unicode](https://github.com/hoffmannjp/krad-unicode)) |
| KanjiVG | SVG des traits, ordre, animation | CC BY-SA 3.0 | `kanjivg-main.zip` (release `r20250816`) |
| Tatoeba | phrases japonais→français avec auteur | CC BY 2.0 FR (attribution affichée) | `jpn_sentences_detailed.tsv.bz2`, `fra_sentences_detailed.tsv.bz2`, `links.tar.bz2` |
| kanji-data (David Gouveia) | croisement des niveaux JLPT (jlpt_new) | MIT | `kanji-data.json` |
| Miroir kanjiapi.dev | second croisement des niveaux JLPT | données kanjiapi.dev | `kanjiapi-jlpt.json` |

Les textes EDRDG sont sous Creative Commons Attribution-ShareAlike ; l'attribution et
le partage à l'identique sont obligatoires. Les checksums (sha256) de chaque fichier
téléchargé sont conservés dans `content/reports/download.json` et repris dans le
manifeste du pack.

## Choix de licences documentés

- **Tatoeba** : l'export `sentences_CC0` ne contient quasiment aucune phrase
  japonaise ; nous utilisons donc les phrases sous **CC BY 2.0 FR**, avec
  attribution obligatoire (auteur, ou « Tatoeba » si le compte a disparu).
- **KRADFILE** : le fichier original n'est plus distribué directement par l'EDRDG ;
  nous utilisons une conversion Unicode/JSON fidèle (même licence EDRDG), en
  documentant les deux provenances.

## Données créées pour le projet

Rédigées ou validées spécifiquement (licence projet CC BY-SA 4.0) : ordre
pédagogique, radicaux pédagogiques et noms français, confusions visuelles,
mnémotechniques, vocabulaire et phrases de complétion (`content/curated/`),
gabarits d'exercices (`tools/content/lib/generators.mjs`).

## Règles de provenance

1. Chaque item (kanji, mot, phrase, exercice) référence une `sourceId`.
2. Chaque source porte `url`, `license`, `attribution_text`, `source_version`,
   `imported_at`, `checksum` (table `content_sources`).
3. Chaque pack publié porte un `content_version_id` (table `content_versions`).
4. Une mise à jour des données EDRDG ne supprime jamais une correction éditoriale et
   produit un diff.

## Avertissements éditoriaux

- La **mnémotechnique** (`mnemonic`) ne doit jamais être présentée comme
  l'**étymologie** (`etymology`). Aucune pseudo-étymologie inventée automatiquement :
  les étymologies ne sont renseignées que pour les pictogrammes documentés, avec la
  mention « tradition paléographique documentée ».
- Les composants visibles (KRADFILE) ne sont pas toujours des radicaux
  classiques : ne jamais qualifier automatiquement un composant de « radical ».
  Le radical affiché provient du curaté (`content/curated/n5/kanji.json`).
- Les phrases Tatoeba sous CC-BY exigent l'affichage de l'auteur et de la licence
  (fiche kanji, section « Phrases d'exemple »).

## Page « Sources et licences »

La page `GET /sources` (API) et l'écran `/sources` (web) listent : source, version,
date d'import, licence, attribution, et la version du pack publié.

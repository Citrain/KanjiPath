# Licences et provenance

Toute donnée linguistique importée doit conserver sa source, sa version, sa licence et
son attribution. Ne jamais modifier silencieusement une provenance ou une licence.

Référence : `adr/2-content-pipeline/README.md` (section « Sources principales »).

## Sources et licences

| Source | Usage | Licence |
|---|---|---|
| KANJIDIC2 | caractère, traits, lectures, significations, fréquence, niveau scolaire | EDRDG — CC BY-SA 4.0 |
| JMdict | vocabulaire, graphies, lectures, sens, grammaire | EDRDG — CC BY-SA 4.0 |
| RADKFILE / KRADFILE | décomposition en composants, recherche par composants | EDRDG — CC BY-SA 4.0 |
| KanjiVG | SVG des traits, ordre/direction, animation | CC BY-SA 3.0 |
| Tatoeba | phrases (attribution conservée) | CC-BY (attribution) / CC0 privilégié |

Les textes EDRDG sont sous Creative Commons Attribution-ShareAlike ; l'attribution et
le partage à l'identique sont obligatoires.

## Données créées pour le projet

Rédigées ou validées spécifiquement (licence projet) : explications françaises,
moyens mnémotechniques, explications pédagogiques des composants, exemples simplifiés,
notes sur les pièges, listes de kanji similaires, exercices originaux, commentaires de
correction.

## Règles de provenance

1. Chaque item (kanji, mot, phrase, exercice) référence une `sourceId`.
2. Chaque source porte `url`, `license`, `attribution_text`, `source_version`,
   `imported_at`, `checksum` (table `content_sources`, Phase 1).
3. Chaque pack publié porte un `content_version_id` (table `content_versions`).
4. Une mise à jour des données EDRDG ne supprime jamais une correction éditoriale et
   produit un diff.

## Avertissements éditoriaux

- La **mnémotechnique** (`mnemonic`) ne doit jamais être présentée comme
  l'**étymologie** (`etymology`). Aucune pseudo-étymologie inventée automatiquement.
- Les composants visibles (RADKFILE/KRADFILE) ne sont pas toujours des radicaux
  classiques : ne jamais qualifier automatiquement un composant de « radical ».
- Les phrases Tatoeba sous CC-BY exigent l'affichage de l'auteur et de la licence.

## Page « Sources et licences »

Une page obligatoire (Phase 1) listera : source, version, date d'import, licence,
attribution, contenu concerné. Voir `adr/8-ux/README.md` (section « Sources et
licences »).

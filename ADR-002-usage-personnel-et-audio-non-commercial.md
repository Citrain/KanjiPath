# ADR-002 - Usage personnel et audio non commercial

- **Statut** : Accepté
- **Date** : 2026-08-08
- **Décisionnaires** : propriétaire du projet

## Contexte

KanjiPath est désormais réservé à l'usage personnel privé de son propriétaire. Il ne
sera ni publié, ni proposé comme service, ni redistribué, ni utilisé commercialement.
Le corpus audio japonais Tatoeba possède beaucoup plus de clips sous CC BY-NC 4.0 que
sous CC BY 4.0.

## Décision

Le pipeline peut importer des clips individuels Tatoeba sous CC BY-NC 4.0, uniquement
pour l'instance personnelle privée. Chaque clip conserve le fichier brut, son checksum,
son auteur, son identifiant Tatoeba, la licence et l'attribution. Les clips sans licence
explicite, sous une autre licence ou sans attribution restent interdits.

Toute publication du dépôt comprenant des fichiers audio, toute mise à disposition
publique de l'application, tout partage de pack ou tout usage commercial est interdit
tant que les clips CC BY-NC sont présents. Une éventuelle réouverture publique impose de
retirer ces clips et de revenir à des sources compatibles avec la redistribution
commerciale.

## Conséquences

- Les 1 282 clips japonais CC BY-NC 4.0 du snapshot Tatoeba du 2026-08-08 deviennent
  éligibles après validation individuelle par le pipeline.
- Les sources CC BY 4.0 restent préférées si une future redistribution est envisagée.
- Les licences et attributions restent affichées dans l'interface et documentées.

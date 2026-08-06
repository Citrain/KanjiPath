# Pipeline de contenu

Le contenu pédagogique est une partie du produit : il possède un schéma, une
provenance, une version, une licence, un état de validation et des tests. Aucun LLM
n'est appelé au runtime : les exercices sont fixes, versionnés, validés.

Référence : `adr/2-content-pipeline/README.md`.

## Étapes

```text
download → import → normalize → generate → validate → report → publish
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
pnpm content:build        # enchaîne toutes les étapes
```

## État actuel : squelette

L'implémentation actuelle (`tools/content/run.mjs`) est un **squelette** : elle crée
l'arborescence `content/` et écrit un rapport JSON par étape dans `content/reports/`.
Les importeurs réels (KANJIDIC2, JMdict, KanjiVG, KRADFILE, Tatoeba) arrivent en
Phase 1.

## Arborescence `content/`

```text
content/
  raw/          # sources brutes téléchargées (checksum vérifié)
  normalized/   # données parsées/normalisées
  curated/      # enrichissement français (rédigé/validé manuellement)
  generated/    # exercices générés de façon déterministe (commités)
  manifests/    # manifeste de chaque pack publié
  licenses/     # textes de licence / attribution
  reports/      # rapports d'étape (JSON)
```

Seuls `manifests/`, `curated/` et `licenses/` sont versionnés par `.gitkeep` ;
`raw/`, `normalized/`, `generated/` et `reports/` sont gitignorés (reproduits par le
pipeline).

## Règles de génération

- Les exercices sont produits par des **gabarits déterministes** pendant le build,
  puis commités, relus et testés.
- Interdit : générer une réponse aléatoire non validée pendant une session utilisateur.
- Répartition minimale par kanji : 20 % sens, 20 % lecture, 20 % vocabulaire,
  20 % contexte, 10 % composants/traits, 10 % confusion/synthèse.

## Validation (à terme)

Le pipeline refusera le build en cas d'identifiant dupliqué, kanji sans niveau/sens,
exercice sans correction, phrase sans kanji cible ou sans attribution, seuils non
atteints, licence manquante, contenu `draft` dans le pack de production, etc.
Liste complète : `adr/2-content-pipeline/README.md#tests-automatiques-de-contenu`.

## Manifeste de publication

Chaque pack publié produit un manifeste (version, sources + checksums, comptes,
résultat de validation). Exemple : `adr/2-content-pipeline/README.md#manifeste-de-publication`.

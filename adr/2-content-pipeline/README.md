# Pipeline de contenu

Sources de données, licences, pipeline d'import et règles de qualité du contenu.

---

## Sources principales

### KANJIDIC2

- caractère, nombre de traits, lectures japonaises, significations
- fréquence, niveau scolaire japonais, codes de dictionnaire, variantes
- Licence : EDRDG, CC BY-SA 4.0

### JMdict

- vocabulaire, graphies, lectures, sens, informations grammaticales
- fréquence et restrictions de lecture
- Licence : EDRDG, CC BY-SA 4.0

### RADKFILE / KRADFILE

- décomposition visuelle en composants, recherche par composants
- relations entre caractères visuellement proches
- Licence : EDRDG, CC BY-SA 4.0

### KanjiVG

- SVG des traits, ordre des traits, direction, animation
- regroupement structurel, identification du radical
- Licence : CC BY-SA 3.0

### Tatoeba

- phrases japonaises avec attribution
- Chaque phrase : identifiant, auteur, langue, licence, traduction, date d'import
- Privilégier CC0, attribution obligatoire pour CC-BY

### Données créées pour le projet

- explications françaises, moyens mnémotechniques
- explications pédagogiques des composants
- exemples simplifiés, traductions pédagogiques
- notes sur les pièges, listes de kanji similaires
- exercices originaux, commentaires de correction

---

## Classement N5 à N1

Type requis pour chaque association kanji ↔ niveau :

```ts
type CurriculumAssignment = {
  kanjiId: string
  curriculum: 'JLPT_ALIGNED'
  level: 'N5' | 'N4' | 'N3' | 'N2' | 'N1'
  sourceName: string
  sourceUrl?: string
  sourceVersion?: string
  confidence: 'high' | 'medium' | 'low'
  reviewedBy?: string
  reviewedAt?: string
  notes?: string
}
```

### Règles de classement

1. croiser au moins deux listes reconnues
2. signaler les divergences
3. permettre une correction manuelle
4. ne jamais remplacer silencieusement un niveau
5. conserver l'ancienne association dans l'historique
6. afficher « aligné JLPT » dans l'interface
7. ordre pédagogique interne distinct du niveau possible

### Ordre pédagogique interne

À l'intérieur d'un niveau, ordonner par :
- fréquence
- utilité dans le vocabulaire du niveau
- simplicité graphique
- composants déjà appris
- nombre de mots utiles débloqués
- risque de confusion avec des kanji voisins

**Ne jamais** calculer directement depuis le code Unicode.

---

## Pipeline

```text
Téléchargement
  → vérification checksum
  → conservation source brute
  → parsing
  → normalisation
  → fusion des sources
  → classement JLPT aligné
  → enrichissement français
  → génération déterministe
  → validations automatiques
  → rapport de couverture
  → validation éditoriale
  → publication pack versionné
```

### Commandes

```bash
pnpm content:download
pnpm content:import
pnpm content:normalize
pnpm content:generate
pnpm content:validate
pnpm content:report
pnpm content:publish
pnpm content:build   # commande complète
```

### Manifest de publication

```json
{
  "version": "2026.08.1",
  "createdAt": "2026-08-06T00:00:00Z",
  "sources": [{ "name": "KANJIDIC2", "version": "2026-08-01", "checksum": "sha256:..." }],
  "counts": { "kanji": 0, "vocabulary": 0, "sentences": 0, "exercises": 0 },
  "validation": { "errors": 0, "warnings": 0 }
}
```

---

## Volume de contenu

### Minimum par kanji publié

| Niveau | Exercices atomiques | Phrases | Mots |
|--------|:---:|:---:|:---:|
| N5 | 40 | 6 | 6 |
| N4 | 32 | 5 | 5 |
| N3 | 24 | 4 | 4 |
| N2 | 20 | 3 | 3 |
| N1 | 18 | 3 | 3 |

Depuis la Phase 3, chaque niveau doit aussi fournir au moins **2 mini-textes** de
lecture graduée (`content/curated/<niveau>/texts.json`).

### Répartition obligatoire

- 20 % sens
- 20 % lecture
- 20 % vocabulaire
- 20 % contexte
- 10 % composants/traits
- 10 % confusion/synthèse

### Génération déterministe

Les variantes sont générées à partir de gabarits pendant le build. Les fichiers produits sont commités, relus et testés.

```json
{
  "template": "sentence_cloze_kanji",
  "targetKanji": "食",
  "sentence": "毎朝、パンを___べます。",
  "answer": "食",
  "acceptedAnswers": ["食"],
  "distractors": ["飲", "見", "買"],
  "explanation": "食べます signifie manger.",
  "difficulty": "N5"
}
```

**Interdit** : générer une réponse aléatoire non validée pendant une session utilisateur.

---

## Règles de qualité

### Réponse unique

- une seule réponse incontestablement correcte
- distracteurs : plausibles, même type, même difficulté, non ambigus, différents

### Lectures contextuelles

- ne pas tester une lecture sans contexte si plusieurs réponses sont valides
- pour un mot, la correction porte sur la lecture du mot entier

### Réponses libres

- hiragana/katakana équivalents acceptés
- espaces et ponctuation facultatifs
- variantes explicitement autorisées
- Unicode normalisé NFC
- romaji accepté seulement si l'exercice l'autorise

### Phrases

- naturelle, compréhensible au niveau annoncé
- traduction obligatoire
- contient le kanji cible
- segmentation furigana vérifiée
- pas de vocabulaire inutilement avancé
- source et licence conservées

---

## Tests automatiques de contenu

Le pipeline doit refuser le build en cas de :

- identifiant dupliqué
- kanji sans niveau, sans sens français
- lecture invalide
- exercice sans correction
- distracteur identique à la réponse
- réponse correcte absente des choix
- plusieurs réponses identiques après normalisation
- phrase sans kanji cible
- phrase sans attribution (si nécessaire)
- mini-texte contenant un kanji hors référentiel ou de niveau supérieur au texte
- mini-texte dont les tokens ne couvrent pas le corps
- nombre minimum non atteint
- référence vers ressource inexistante
- fichier SVG absent
- licence manquante
- contenu `draft` dans le pack production

---

## Mises à jour des sources

- ne pas supprimer automatiquement une correction éditoriale
- produire un diff
- détecter les changements de lecture, sens, métadonnées
- validation avant publication
- conserver la version utilisée par chaque exercice
- ne pas supprimer les historiques de révision

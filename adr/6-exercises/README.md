# Exercices

Regroupés par compétence, tous fixes et validés (aucun LLM au runtime).

---

## 6.1 Reconnaissance du sens

1. kanji → sens
2. sens → kanji
3. choix multiple
4. réponse libre
5. association de paires
6. vrai ou faux avec pièges plausibles

---

## 6.2 Reconnaissance des lectures

1. kanji → lecture
2. lecture → kanji
3. identifier on'yomi ou kun'yomi
4. choisir la lecture correcte parmi plusieurs
5. saisir la lecture en kana
6. reconnaître une lecture valide mais peu fréquente

---

## 6.3 Vocabulaire

1. choisir la lecture d'un mot
2. saisir la lecture d'un mot
3. choisir le sens du mot
4. choisir le kanji manquant
5. distinguer deux mots proches
6. reconstruire un mot
7. associer mot, lecture et sens

---

## 6.4 Mise en contexte

1. texte à trou dans une phrase
2. choisir le kanji correct
3. choisir la lecture correcte dans la phrase
4. choisir la traduction correcte
5. repérer le mot contenant le kanji
6. comprendre la nuance du mot
7. remettre une phrase courte dans l'ordre
8. sélectionner la phrase où le kanji est employé correctement

---

## 6.5 Composants et traits

1. identifier le radical principal
2. sélectionner les composants visibles
3. choisir le bon ordre des traits
4. repérer le trait suivant
5. comparer deux kanji proches
6. choisir la structure correcte
7. retrouver les kanji ayant un composant commun

---

## 6.6 Écoute et dictée (Phase 5)

- `audio_dictation_kana` : prompt audio sans transcript, réponse libre normalisée NFC,
  katakana/hiragana équivalents, espaces et ponctuation facultatifs ; variantes seulement
  si explicitement déclarées dans le pack.
- compétence `listening`, carte `AUDIO_DICTATION` ; les items sont matérialisés et
  validés au build.
- La préférence `kanaInputEnabled=false` retire `reading_input_kana` et
  `audio_dictation_kana` de toutes les files d'étude. Les QCM dont les choix sont en
  kana restent disponibles puisqu'ils ne nécessitent pas de clavier japonais.

## 6.7 Exercices futurs (post-V1)

- tracé libre
- comparaison du tracé avec KanjiVG
- lecture chronométrée
- mini-textes
- mode examen blanc
- import de listes personnelles

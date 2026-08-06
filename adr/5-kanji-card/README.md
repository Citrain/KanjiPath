# Fiche kanji

Chaque fiche doit contenir toutes les sections ci-dessous.

---

## 5.1 En-tête

- kanji en très grand
- niveau aligné JLPT
- état personnel : nouveau, en apprentissage, en révision, maîtrisé
- progression globale
- prochaine révision
- nombre de traits
- fréquence
- niveau scolaire japonais (si disponible)

---

## 5.2 Sens

- sens principal en français
- sens secondaires
- nuances d'usage
- mots-clés
- distinction signification caractère isolé vs dans les mots composés

---

## 5.3 Lectures

- on'yomi en katakana
- kun'yomi en hiragana
- okurigana clairement séparé
- lectures courantes mises en avant
- lectures rares repliées (section avancée)
- nanori séparées
- exemples de mots pour chaque lecture

> **Romaji masqué par défaut** — activable dans les préférences.

---

## 5.4 Radical et composants

Afficher séparément :

- radical principal
- nom du radical
- sens pédagogique du radical
- numéro ou classification (si disponible)
- position : gauche, droite, haut, bas, enveloppant, etc.
- composants visibles
- sous-composants
- kanji partageant le même composant
- avertissement si composant phonétique plutôt que sémantique

> **Ne jamais** appeler automatiquement chaque composant « radical ».

---

## 5.5 Traits et écriture

- nombre de traits
- SVG complet
- animation trait par trait
- lecture lente, normale et pas à pas
- boutons précédent, suivant, recommencer
- surbrillance du trait actif
- numéro des traits
- direction du trait
- grille de pratique
- mode fantôme (aide progressive réduite)

> La reconnaissance d'écriture manuscrite est hors V1, mais le modèle doit permettre de l'ajouter.

---

## 5.6 Structure

- type de composition
- composant sémantique
- composant phonétique (si donnée fiable)
- caractères similaires
- différences visuelles mises en évidence
- erreurs fréquentes

---

## 5.7 Étymologie et mnémotechnique

Deux champs distincts :

- `etymology` : information historique sourcée
- `mnemonic` : aide artificielle à la mémorisation

> Une mnémotechnique ne doit **jamais** être présentée comme l'étymologie réelle.
> Aucune pseudo-étymologie ne doit être inventée automatiquement.

---

## 5.8 Vocabulaire associé

Pour chaque mot :

- graphie
- lecture avec furigana
- traduction française
- catégorie grammaticale
- niveau estimé
- fréquence
- lecture du kanji cible dans ce mot
- exemple de phrase
- audio (futur)
- état personnel du mot

### Minimum recommandé

| Niveau | Mots utiles par kanji |
|--------|:---:|
| N5 | 6 |
| N4 | 5 |
| N3 | 4 |
| N2 | 3 |
| N1 | 3 |

---

## 5.9 Phrases

- phrase japonaise
- furigana segmenté
- traduction française
- kanji cible surligné
- lecture du mot cible
- explication grammaticale courte
- niveau de difficulté
- source et attribution
- bouton pour masquer/afficher les aides

# Expérience utilisateur

Écrans, aides pédagogiques et contraintes mobile.

---

## 10.1 Écrans

### Tableau de bord

- niveau actif et progression
- révisions dues
- bouton « Continuer »
- objectif quotidien
- activité récente et points faibles
- calendrier de régularité
- aperçu de la charge à venir

### Parcours par niveau

- onglets N5 à N1
- unités ou chapitres
- kanji par état
- progression et filtres
- ordre recommandé
- recherche

### Fiche kanji

Toutes les sections définies dans `5-kanji-card/`.

### Session d'apprentissage

1. découverte guidée
2. sens
3. lectures
4. animation des traits
5. mots
6. phrases
7. mini-quiz de sortie

### Session de révision

- interface rapide
- raccourcis clavier
- affichage progressif des aides
- correction détaillée
- bouton « Signaler un problème »

### Conversation vocale locale (ADR-003)

- sélection du niveau, difficulté, voix et mode de correction ; le sujet se construit
  librement au fil du dialogue ;
- mode texte toujours disponible ;
- état micro et diagnostic explicite si le STT local est indisponible ;
- transcript partiel visuellement distinct du transcript final ;
- fil de messagerie, correction française mise en avant et réponse japonaise texte/audio ;
- contrôle indépendant de l'audio français et de la vitesse japonaise.

### Statistiques

- précision et rétention
- temps passé
- progression par compétence
- kanji faibles et confusion fréquente
- historique des sessions

### Recherche

Par : kanji, lecture, sens français, composant, radical, nombre de traits, niveau, mot.

### Sources et licences (page obligatoire)

- source, version, date d'import
- licence, attribution
- contenu concerné

---

## 10.2 Aides pédagogiques

Réglages disponibles :

- furigana : toujours / au survol / jamais
- afficher le romaji
- masquer la traduction
- vitesse d'animation
- nombre de nouveaux kanji par jour
- objectif de rétention
- mode clavier
- thème
- son (futur)

---

## 10.3 Mobile

L'application est **mobile-first**.

Contraintes :

- zone tactile suffisante
- aucune interaction dépendante du survol
- exercices utilisables à une main
- dessin SVG responsive
- reprise après mise en veille
- session persistée à chaque réponse

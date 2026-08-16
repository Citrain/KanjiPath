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

### Carte visuelle des kanji (ADR-006)

- accessible depuis une fiche, centrée sur le kanji choisi ;
- filtres par composant partagé, confusion visuelle, mot partagé et voisin du parcours ;
- nœuds cliquables et focusables au clavier, état de progression libellé en plus de la couleur ;
- liste textuelle équivalente à la vue graphique, avec les mêmes liens vers les fiches ;
- disposition calculée localement, aucun réglage de carte persisté en V1.

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

### Mission quotidienne (ADR-005)

- point d'entree depuis le tableau de bord, preparation explicite puis reprise de la
  meme mission pendant la journee locale ;
- etapes courtes : sous-session de revision, mot en contexte et lecture graduee ;
- toute etape peut etre terminee ou passee, sans perdre la progression deja enregistree ;
- la sous-session ouvre le renderer d'etude existant pour conserver raccourcis, feedback
  et accessibilite.

### Conversation vocale locale (ADR-003)

- sélection du niveau, difficulté, voix et mode de correction ; le sujet se construit
  librement au fil du dialogue ;
- mode texte toujours disponible ;
- état micro et diagnostic explicite si le STT local est indisponible ;
- transcript partiel visuellement distinct du transcript final ;
- fil de messagerie, correction française mise en avant et réponse japonaise texte/audio ;
- contrôle indépendant de l'audio français et de la vitesse japonaise.

### Carnet de vocabulaire personnel (ADR-007)

- liste des mots actifs et archivés, avec lecture, sens, extrait et provenance publiée
  affichable ;
- bouton d'enregistrement commun dans la lecture/lookup et les tours de conversation ;
- session FSRS personnelle courte, avec rappel du sens, saisie de lecture ou
  auto-évaluation explicite ;
- archivage réversible et suppression confirmée qui annonce la suppression des cartes
  et journaux ;
- toutes les actions restent utilisables au tactile comme au clavier.

### Laboratoire de shadowing (ADR-008)

- choix d'une phrase publiée : clip audio sous licence autorisée (attribution et licence
  affichées) ou lecture par la voix locale (TTS), niveau N5 à N1 ;
- écoute, enregistrement micro (20 s max), transcription finale locale et comparaison
  présentée comme une aide de correspondance — jamais une note ni un verdict de
  prononciation, d'accent, de rythme ou d'intonation ;
- segments à réécouter libellés en texte, pas seulement en couleur, avec bouton de
  réécoute ; répétition libre sans effet sur les cartes, scores ou progression ;
- diagnostic explicite si le STT local est indisponible : l'écoute reste possible ;
- conservation d'un résultat uniquement sur action explicite, avec suppression
  unitaire ou globale ;
- contrôles utilisables au clavier et au tactile (cibles d'au moins 48 px).

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
- saisie en japonais activable ou exclue globalement pour tous les modes d'étude
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

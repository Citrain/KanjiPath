# Plan d'implémentation et critères

Phases de livraison, critères d'acceptation et décisions refusées.

---

## Phases

### Phase 0 — Fondations

- monorepo, CI, NestJS, React, MariaDB (local, sans Docker), Prisma
- authentification, documentation, conventions de code
- premier pipeline vide

### Phase 1 — MVP N5 complet

- référentiel N5, fiches complètes, KanjiVG
- vocabulaire, phrases, exercices fixes
- FSRS, tableau de bord, progression
- reprise de session, recherche
- page sources et licences

**Critère de sortie** :

- tous les kanji N5 publiés possèdent le minimum de contenu
- au moins 3 000 exercices N5 validés
- progression persistante
- zéro erreur bloquante du validateur

### Phase 2 — N4

- pack N4, nouveaux types de contexte
- confusions visuelles, statistiques détaillées
- mode révision ciblée

**Critère de sortie** : au moins 5 000 exercices N4 validés

### Phase 3 — N3

- mini-textes, phrases plus naturelles
- lecture de vocabulaire avancée
- personnalisation de la charge

### Phase 4 — N2 et N1

- grands volumes de vocabulaire, nuances, mots composés
- lecture en contexte, filtres de fréquence
- textes plus longs

### Phase 5 — Écriture et audio

- tracé, comparaison de traits
- dictée, audio sous licence
- exercices d'écoute

---

## Critères d'acceptation fonctionnels

### Fiche

- affiche sens, lectures, radical, composants, traits, mots et phrases
- ordre des traits animé
- lectures courantes distinguées des lectures rares
- provenance disponible
- mnémotechniques distinguées de l'étymologie

### Révision

- exercices fixes, disponibles sans IA
- session mélange plusieurs compétences
- chaque réponse met à jour la progression
- une erreur affiche une explication
- prochaine révision calculée
- session reprise possible

### Progression

- progression par niveau et par kanji visible
- points faibles identifiés
- progression persiste après déconnexion
- correction de niveau ne supprime pas l'historique

### Contenu

- chaque item possède une source
- chaque source possède une licence
- seuils de couverture respectés
- aucun contenu brouillon publié
- mise à jour des données sans écraser les enrichissements éditoriaux

---

## Décisions explicitement refusées

| Décision | Raison |
|----------|--------|
| JSON direct servi par React | progression difficile à synchroniser, pas de modèle éditorial |
| Une seule table `kanji` en JSON | requêtes complexes, duplication, pas de contraintes |
| Champ `mastered: boolean` | maîtrise multidimensionnelle et évolutive |
| Exercices générés par LLM à chaque session | coût, latence, erreurs, non-reproductibilité, dépendance |
| Niveaux présentés comme officiels | le JLPT ne publie pas de liste exhaustive officielle |
| Node.js Current en production | doit utiliser une version LTS |
| Microservices | le projet ne le justifie pas |

---

## Conséquences positives

- contenu fiable et vérifiable
- progression réellement utile
- utilisable sans coût d'IA
- architecture compatible N5 → N1
- compatible future app mobile
- données actualisables
- tests automatiques du contenu
- historique utilisateur robuste
- écriture et audio ajoutables plus tard

## Conséquences négatives

- coût initial élevé de préparation du contenu
- gestion de plusieurs licences
- pipeline d'import nécessaire
- validation humaine requise
- modèle de données plus riche
- temps de développement supérieur à une simple app de flashcards
- classement JLPT forcément approximatif et versionné

> Ces coûts sont acceptés : la qualité pédagogique et la pérennité sont centrales.

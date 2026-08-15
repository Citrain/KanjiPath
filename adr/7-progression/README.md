# Progression et répétition espacée

Moteur SRS, cartes par compétence, calcul de maîtrise et déblocage.

---

## 9.1 Moteur

Utiliser `ts-fsrs` pour la planification des révisions.

Le moteur est encapsulé derrière une interface du domaine :

```ts
interface ReviewScheduler {
  preview(card: ReviewCard, now: Date): ReviewOption[]
  review(
    card: ReviewCard,
    rating: 'again' | 'hard' | 'good' | 'easy',
    now: Date
  ): ReviewResult
}
```

> Le domaine ne doit **pas** dépendre directement des structures internes de la bibliothèque.

---

## 9.2 Une carte par compétence

Un kanji peut posséder plusieurs cartes de révision :

- `KANJI_MEANING_RECOGNITION`
- `MEANING_TO_KANJI`
- `KANJI_READING`
- `VOCAB_READING`
- `VOCAB_MEANING`
- `CONTEXT_CLOZE`
- `RADICAL_RECOGNITION`
- `STROKE_ORDER`

> Réussir le sens ne masque pas une faiblesse sur la lecture.

---

## 9.3 États

- `NEW`
- `LEARNING`
- `REVIEW`
- `MASTERED`
- `SUSPENDED`

> `MASTERED` est un statut produit calculé, différent de l'état interne FSRS.

---

## 9.4 Calcul de maîtrise

### Pondération

| Compétence | Poids |
|---|---:|
| sens | 20 % |
| lecture | 20 % |
| vocabulaire | 25 % |
| contexte | 25 % |
| composants et traits | 10 % |

### Conditions de maîtrise

Un kanji est maîtrisé lorsque :

- score pondéré ≥ 85 %
- chaque compétence principale ≥ 70 %
- au moins deux révisions réussies sur plusieurs jours
- aucune carte principale en échec récent

> Ces seuils sont **configurables**.

### Marquage manuel

Un utilisateur qui connaît déjà un kanji peut le marquer comme connu depuis sa fiche.
Cette action fixe ses scores à 100 %, le place dans l'état produit `MASTERED` et suspend
ses cartes FSRS existantes. Il n'est plus introduit dans les sessions automatiques, mais
reste disponible en révision ciblée.

---

## 9.5 Progression d'un niveau

Afficher :

- kanji découverts, en apprentissage, en révision, maîtrisés
- pourcentage de maîtrise pondérée
- rétention estimée
- exercices réalisés
- précision sur 7, 30 et 90 jours
- prochaine charge de révision

---

## 9.6 Déblocage

Par défaut :

- les 10 premiers kanji du niveau sont disponibles
- nouveaux kanji proposés quand la charge de révision reste acceptable
- l'utilisateur peut forcer le déblocage
- le niveau suivant est consultable à tout moment
- le mode guidé recommande 80 % de maîtrise du niveau précédent

> Aucun verrou ne doit empêcher un utilisateur motivé d'explorer.

---

## 9.7 Session quotidienne

La session recommandée mélange :

1. cartes en retard
2. cartes dues aujourd'hui
3. points faibles
4. nouveaux kanji
5. exercices contextuels de consolidation

### Répartition initiale

- 50 % révisions dues
- 20 % erreurs récentes
- 20 % nouveaux contenus
- 10 % variation ou défi

> Si la file de révision est importante, les nouveaux contenus sont réduits automatiquement.

### Mission quotidienne (ADR-005)

La mission materialise une sous-session courte et deterministe : revisions dues, erreurs
recentes, nouveaux kanji seulement si `autoBalance` le permet, puis consolidation de
contexte. Elle reutilise les cartes et logs FSRS existants ; vocabulaire et lecture sont
des etapes informatives sans carte. Une mission conserve sa file pour reprise et ne
modifie pas les regles de maitrise.

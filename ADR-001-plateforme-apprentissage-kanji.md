# ADR-001 — Plateforme web d’apprentissage progressif des kanji

- **Statut** : Accepté
- **Date** : 2026-08-06
- **Version** : 1.1
- **Décisionnaires** : propriétaire du projet
- **Portée** : architecture produit, technique, données pédagogiques et progression
- **Nom de travail** : `KanjiPath`

### Historique des versions

- **1.1** (2026-08-06) : PostgreSQL 18 remplacé par **MariaDB 11.4 LTS**
  (déjà installé en local, Prisma provider `mysql`) ; suppression de Docker
  Compose pour le développement local.
- **1.0** (2026-08-06) : version initiale.

---

## 1. Contexte

Le projet doit fournir une application web moderne permettant d’apprendre les kanji du niveau débutant au niveau avancé, en suivant un parcours aligné sur les niveaux du JLPT : N5, N4, N3, N2 et N1.

L’application doit permettre :

- d’apprendre chaque kanji au moyen d’une fiche extrêmement complète ;
- de réviser avec répétition espacée ;
- de faire de nombreux exercices de reconnaissance ;
- de travailler les kanji dans des mots et dans des phrases ;
- de suivre précisément la progression de l’utilisateur ;
- de reprendre une session exactement là où elle a été arrêtée ;
- de distinguer la connaissance du sens, des lectures, du vocabulaire et du contexte ;
- d’intégrer un très grand volume d’exercices fixes, sans appel à une IA au moment où l’utilisateur révise.

### 1.1 Point important concernant le JLPT

Le JLPT possède cinq niveaux officiels, de N5 à N1. Cependant, l’organisme du JLPT ne publie plus de liste exhaustive officielle des kanji, du vocabulaire et de la grammaire exigés pour chaque niveau.

L’application ne doit donc jamais présenter ses listes comme des « listes officielles du JLPT ». Elle doit utiliser la formulation :

> **Parcours aligné sur le JLPT**

Chaque association entre un kanji et un niveau doit être traçable, versionnée et accompagnée de sa provenance.

### 1.2 Public initial

- interface en français ;
- utilisateur principal débutant ou intermédiaire en japonais ;
- usage ordinateur et mobile ;
- application pensée d’abord pour une utilisation individuelle ;
- architecture compatible avec plusieurs utilisateurs dès la première version.

---

## 2. Décision

Construire une application web en monorepo TypeScript, séparant clairement :

1. le client web ;
2. l’API ;
3. le domaine pédagogique ;
4. le moteur de répétition espacée ;
5. les données linguistiques importées ;
6. le contenu pédagogique éditorial ;
7. les scripts de génération et de validation des exercices.

### 2.1 Stack retenue

#### Runtime et dépôt

- **Node.js 24 LTS**
- **TypeScript strict**
- **pnpm workspaces**
- monorepo léger, sans microservices
- **Pas de Docker** : services installés en local (MariaDB local lancé comme service système)

#### Frontend

- **React 19.2**
- **Vite 8.1**
- **React Router**
- **TanStack Query**
- **Tailwind CSS 4.3**
- composants accessibles basés sur Radix UI
- PWA installable
- IndexedDB uniquement pour le cache et la continuité hors connexion, pas comme source principale de vérité

#### Backend

- **NestJS 11**
- adaptateur **Fastify**
- API REST documentée par OpenAPI
- validation des entrées par Zod ou DTO Nest stricts
- authentification par session sécurisée en cookie HTTP-only

#### Données

- **MariaDB 11.4 LTS ou supérieure** (installée en local, sans Docker ; testée en 12.x)
- **Prisma ORM v6 stable** avec le provider `mysql` (compatible MariaDB)
- migrations SQL versionnées
- Redis non obligatoire en V1
- stockage objet facultatif pour de futurs fichiers audio

Note : Prisma ne fournit pas de connector MariaDB dédié ; le provider `mysql`
est utilisé. Les fonctionnalités MySQL 8+ non supportées par MariaDB (CTE récursives,
JSON avancé) doivent être évitées dans les requêtes applicatives.

#### Qualité

- Vitest pour les tests unitaires ;
- Supertest pour les tests d’intégration API ;
- Playwright pour les tests end-to-end ;
- ESLint ou Biome ;
- Prettier si Biome n’est pas retenu ;
- GitHub Actions ou GitLab CI ;
- Renovate pour les mises à jour contrôlées.

### 2.2 Pourquoi ne pas utiliser Node.js 26

À la date de cette décision, Node.js 26 est encore en statut `Current`, tandis que Node.js 24 est en LTS. Une application de production doit utiliser une version LTS.

### 2.3 Pourquoi séparer React et NestJS

Une application uniquement construite dans un framework full-stack serait plus rapide à amorcer, mais la séparation retenue apporte :

- un domaine métier testable indépendamment de l’interface ;
- une API stable pour une future application mobile ;
- un pipeline de contenu et d’import plus propre ;
- une meilleure isolation des règles de progression ;
- une architecture plus facile à faire évoluer par un agent de code ;
- une documentation OpenAPI exploitable automatiquement.

Il ne faut toutefois pas créer de microservices. Une seule API modulaire suffit.

---

## 3. Principes structurants

### 3.1 Aucun appel à une IA pendant les exercices

La première version ne doit dépendre d’aucun LLM au runtime.

Tous les exercices sont :

- écrits manuellement ;
- importés depuis une source autorisée ;
- ou générés de manière déterministe pendant le développement ou le build.

Le résultat généré doit être enregistré dans des fichiers versionnés ou en base, relisible et testable.

Une IA peut éventuellement aider le développeur à créer du contenu, mais rien ne doit être publié sans validation linguistique et sans être stocké comme contenu fixe.

### 3.2 Le contenu est une partie du produit

Le contenu n’est pas un simple `seed.ts` géant.

Il doit posséder :

- un schéma ;
- une provenance ;
- une version ;
- une licence ;
- un état de validation ;
- un historique des corrections ;
- des tests automatiques ;
- un responsable éditorial, même si cette personne est initialement le propriétaire du projet.

### 3.3 Une progression multidimensionnelle

Un kanji ne doit pas être considéré comme « connu » uniquement parce que l’utilisateur reconnaît son sens.

La progression est séparée en compétences :

- reconnaissance visuelle ;
- sens ;
- lecture on’yomi ;
- lecture kun’yomi ;
- lecture dans un mot ;
- choix du kanji dans un mot ;
- compréhension en contexte ;
- ordre des traits ;
- écriture, dans une phase ultérieure.

### 3.4 Les niveaux sont versionnés

Un kanji peut changer de niveau dans le curriculum sans perdre l’historique utilisateur.

Les données de progression sont attachées au kanji et aux compétences, pas uniquement au niveau JLPT.

---

## 4. Sources de données et licences

## 4.1 Sources principales

### KANJIDIC2

Utilisé pour :

- caractère ;
- nombre de traits ;
- lectures japonaises ;
- significations ;
- fréquence ;
- niveau scolaire japonais ;
- codes de dictionnaire ;
- variantes disponibles.

Licence : EDRDG, Creative Commons Attribution-ShareAlike 4.0.

### JMdict

Utilisé pour :

- vocabulaire ;
- graphies ;
- lectures ;
- sens ;
- informations grammaticales ;
- fréquence et restrictions de lecture lorsqu’elles sont disponibles.

Licence : EDRDG, Creative Commons Attribution-ShareAlike 4.0.

### RADKFILE / KRADFILE

Utilisé pour :

- décomposition visuelle en composants ;
- recherche par composants ;
- relations entre caractères visuellement proches.

Attention : les composants visibles ne sont pas toujours des radicaux classiques.

Licence : EDRDG, Creative Commons Attribution-ShareAlike 4.0.

### KanjiVG

Utilisé pour :

- SVG des traits ;
- ordre des traits ;
- direction des traits ;
- animation ;
- regroupement structurel ;
- identification du radical dans le dessin.

Licence : Creative Commons Attribution-ShareAlike 3.0.

### Tatoeba

Utilisé uniquement pour les phrases dont la licence et l’attribution sont correctement conservées.

Chaque phrase importée doit garder :

- l’identifiant Tatoeba ;
- l’auteur ;
- la langue ;
- la licence ;
- la relation avec la traduction ;
- la date d’import.

Les phrases sous CC-BY nécessitent une attribution. Les phrases CC0 sont à privilégier lorsqu’elles sont adaptées.

### Données créées pour le projet

Doivent être rédigés ou validés spécifiquement pour l’application :

- explications françaises ;
- moyens mnémotechniques ;
- explications pédagogiques des composants ;
- exemples simplifiés ;
- traductions pédagogiques ;
- notes sur les pièges ;
- listes de kanji similaires ;
- exercices originaux ;
- commentaires de correction.

## 4.2 Classement N5 à N1

Le classement doit être obtenu par un pipeline distinct des données lexicales.

Pour chaque kanji :

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

Règles :

1. croiser au moins deux listes reconnues lorsqu’elles sont disponibles ;
2. signaler les divergences ;
3. permettre une correction manuelle ;
4. ne jamais remplacer silencieusement un niveau ;
5. conserver l’ancienne association dans l’historique ;
6. afficher dans l’interface « aligné JLPT » ;
7. ajouter éventuellement un ordre pédagogique interne distinct du niveau.

### 4.2.1 Ordre pédagogique

À l’intérieur d’un niveau, les kanji sont ordonnés selon :

- fréquence ;
- utilité dans le vocabulaire du niveau ;
- simplicité graphique ;
- composants déjà appris ;
- nombre de mots utiles débloqués ;
- risque de confusion avec des kanji voisins.

Le champ `curriculumOrder` ne doit pas être calculé directement depuis le code Unicode.

---

## 5. Contenu d’une fiche kanji

Chaque fiche doit contenir les informations suivantes.

### 5.1 En-tête

- kanji en très grand ;
- niveau aligné JLPT ;
- état personnel : nouveau, en apprentissage, en révision, maîtrisé ;
- progression globale ;
- prochaine révision ;
- nombre de traits ;
- fréquence ;
- niveau scolaire japonais lorsque disponible.

### 5.2 Sens

- sens principal en français ;
- sens secondaires ;
- nuances d’usage ;
- mots-clés ;
- distinction entre signification du caractère isolé et signification dans les mots composés.

### 5.3 Lectures

- on’yomi en katakana ;
- kun’yomi en hiragana ;
- okurigana clairement séparé ;
- lectures courantes mises en avant ;
- lectures rares repliées dans une section avancée ;
- nanori séparées ;
- exemples de mots pour chaque lecture.

Le romaji est masqué par défaut et activable dans les préférences.

### 5.4 Radical et composants

Afficher séparément :

- radical principal ;
- nom du radical ;
- sens pédagogique du radical ;
- numéro ou classification si disponible ;
- position : gauche, droite, haut, bas, enveloppant, etc. ;
- composants visibles ;
- sous-composants ;
- kanji partageant le même composant ;
- avertissement lorsque le composant est phonétique plutôt que sémantique.

Ne jamais appeler automatiquement chaque composant « radical ».

### 5.5 Traits et écriture

- nombre de traits ;
- SVG complet ;
- animation trait par trait ;
- lecture lente, normale et pas à pas ;
- boutons précédent, suivant, recommencer ;
- surbrillance du trait actif ;
- numéro des traits ;
- direction du trait ;
- grille de pratique ;
- mode fantôme montrant progressivement moins d’aide.

La reconnaissance automatique d’une écriture manuscrite est hors V1, mais le modèle doit permettre de l’ajouter.

### 5.6 Structure

- type de composition ;
- composant sémantique ;
- composant phonétique lorsque la donnée est fiable ;
- caractères similaires ;
- différences visuelles mises en évidence ;
- erreurs fréquentes.

### 5.7 Étymologie et mnémotechnique

Deux champs différents :

- `etymology` : information historique sourcée ;
- `mnemonic` : aide artificielle à la mémorisation.

Une mnémotechnique ne doit jamais être présentée comme l’étymologie réelle.

Aucune pseudo-étymologie ne doit être inventée automatiquement.

### 5.8 Vocabulaire associé

Pour chaque mot :

- graphie ;
- lecture avec furigana ;
- traduction française ;
- catégorie grammaticale ;
- niveau estimé ;
- fréquence ;
- lecture du kanji cible dans ce mot ;
- exemple de phrase ;
- audio futur ;
- état personnel du mot.

Minimum recommandé :

- N5 : 6 mots utiles par kanji ;
- N4 : 5 ;
- N3 : 4 ;
- N2 : 3 ;
- N1 : 3.

Il est acceptable de dépasser ces minima.

### 5.9 Phrases

Chaque fiche doit posséder plusieurs phrases :

- phrase japonaise ;
- furigana segmenté ;
- traduction française ;
- kanji cible surligné ;
- lecture du mot cible ;
- explication grammaticale courte ;
- niveau de difficulté ;
- source et attribution ;
- bouton pour masquer ou afficher les aides.

---

## 6. Types d’exercices

Les exercices sont regroupés par compétence.

### 6.1 Reconnaissance du sens

1. kanji vers sens ;
2. sens vers kanji ;
3. choix multiple ;
4. réponse libre ;
5. association de paires ;
6. vrai ou faux avec pièges plausibles.

### 6.2 Reconnaissance des lectures

1. kanji vers lecture ;
2. lecture vers kanji ;
3. identifier on’yomi ou kun’yomi ;
4. choisir la lecture correcte parmi plusieurs ;
5. saisir la lecture en kana ;
6. reconnaître une lecture valide mais peu fréquente.

### 6.3 Vocabulaire

1. choisir la lecture d’un mot ;
2. saisir la lecture d’un mot ;
3. choisir le sens du mot ;
4. choisir le kanji manquant ;
5. distinguer deux mots proches ;
6. reconstruire un mot ;
7. associer mot, lecture et sens.

### 6.4 Mise en contexte

1. texte à trou dans une phrase ;
2. choisir le kanji correct ;
3. choisir la lecture correcte dans la phrase ;
4. choisir la traduction correcte ;
5. repérer le mot contenant le kanji ;
6. comprendre la nuance du mot ;
7. remettre une phrase courte dans l’ordre ;
8. sélectionner la phrase où le kanji est employé correctement.

### 6.5 Composants et traits

1. identifier le radical principal ;
2. sélectionner les composants visibles ;
3. choisir le bon ordre des traits ;
4. repérer le trait suivant ;
5. comparer deux kanji proches ;
6. choisir la structure correcte ;
7. retrouver les kanji ayant un composant commun.

### 6.6 Exercices futurs

- tracé libre ;
- comparaison du tracé avec KanjiVG ;
- dictée audio ;
- lecture chronométrée ;
- mini-textes ;
- mode examen blanc ;
- import de listes personnelles.

---

## 7. Volume de contenu

Le produit doit contenir un volume élevé d’exercices, mais sans sacrifier la qualité.

### 7.1 Minimum par kanji publié

| Niveau | Exercices atomiques minimum | Phrases minimum | Mots minimum |
|---|---:|---:|---:|
| N5 | 40 | 6 | 6 |
| N4 | 32 | 5 | 5 |
| N3 | 24 | 4 | 4 |
| N2 | 20 | 3 | 3 |
| N1 | 18 | 3 | 3 |

Ces nombres sont des seuils de publication et non des objectifs maximums.

### 7.2 Répartition obligatoire

Chaque kanji doit avoir au minimum :

- 20 % d’exercices de sens ;
- 20 % de lecture ;
- 20 % de vocabulaire ;
- 20 % de contexte ;
- 10 % de composants ou de traits ;
- 10 % de confusion ou de synthèse.

### 7.3 Génération déterministe

Les variantes peuvent être générées à partir de gabarits, par exemple :

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

Le générateur doit produire des fichiers matérialisés :

```text
content/generated/N5/exercises/*.json
```

Ces fichiers sont commités, relus et testés.

Il est interdit de générer une nouvelle réponse aléatoire non validée pendant une session utilisateur.

---

## 8. Règles de qualité des exercices

### 8.1 Réponse unique

Un QCM doit avoir une seule réponse incontestablement correcte.

Les distracteurs doivent être :

- plausibles ;
- du même type que la réponse ;
- proches en difficulté ;
- non ambigus ;
- différents les uns des autres.

### 8.2 Lectures contextuelles

Une lecture ne doit pas être testée sans contexte lorsque plusieurs réponses sont valides.

Pour un exercice portant sur un mot, la correction porte sur la lecture du mot entier, pas sur une lecture théorique isolée.

### 8.3 Réponses libres

La normalisation accepte :

- hiragana ou katakana lorsqu’ils sont équivalents pour l’exercice ;
- espaces facultatifs ;
- ponctuation facultative ;
- variantes explicitement autorisées ;
- caractères Unicode normalisés en NFC.

Le romaji ne doit être accepté que si l’exercice l’autorise.

### 8.4 Phrases

Une phrase publiée doit :

- être naturelle ;
- être compréhensible au niveau annoncé ;
- posséder une traduction ;
- contenir le kanji cible ;
- avoir une segmentation furigana vérifiée ;
- ne pas contenir de vocabulaire inutilement beaucoup plus avancé ;
- conserver sa source et sa licence.

### 8.5 Tests automatiques de contenu

Le pipeline doit refuser le build en cas de :

- identifiant dupliqué ;
- kanji sans niveau ;
- kanji sans sens français ;
- lecture invalide ;
- exercice sans correction ;
- distracteur identique à la réponse ;
- réponse correcte absente des choix ;
- plusieurs réponses identiques après normalisation ;
- phrase sans kanji cible ;
- phrase sans attribution lorsque nécessaire ;
- nombre minimum d’exercices non atteint ;
- référence vers un kanji, un mot ou une phrase inexistant ;
- fichier SVG absent ;
- licence manquante ;
- contenu marqué `draft` inclus dans le pack de production.

---

## 9. Progression et répétition espacée

## 9.1 Moteur

Utiliser `ts-fsrs` pour la planification des révisions.

Le moteur de répétition espacée est encapsulé derrière une interface du domaine :

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

Le domaine ne doit pas dépendre directement des structures internes de la bibliothèque.

### 9.2 Une carte par compétence

Un kanji peut posséder plusieurs cartes de révision :

- `KANJI_MEANING_RECOGNITION`
- `MEANING_TO_KANJI`
- `KANJI_READING`
- `VOCAB_READING`
- `VOCAB_MEANING`
- `CONTEXT_CLOZE`
- `RADICAL_RECOGNITION`
- `STROKE_ORDER`

Ainsi, réussir systématiquement le sens ne masque pas une faiblesse sur la lecture.

### 9.3 États

- `NEW`
- `LEARNING`
- `REVIEW`
- `MASTERED`
- `SUSPENDED`

`MASTERED` est un statut produit calculé, différent de l’état interne FSRS.

### 9.4 Calcul de maîtrise

Exemple de pondération :

| Compétence | Poids |
|---|---:|
| sens | 20 % |
| lecture | 20 % |
| vocabulaire | 25 % |
| contexte | 25 % |
| composants et traits | 10 % |

Un kanji est considéré maîtrisé lorsque :

- le score pondéré est supérieur ou égal à 85 % ;
- chaque compétence principale est supérieure ou égale à 70 % ;
- au moins deux révisions réussies ont eu lieu sur plusieurs jours ;
- aucune carte principale n’est en échec récent.

Ces seuils doivent être configurables.

### 9.5 Progression d’un niveau

La progression de niveau ne doit pas être un simple compteur de fiches ouvertes.

Afficher :

- kanji découverts ;
- kanji en apprentissage ;
- kanji en révision ;
- kanji maîtrisés ;
- pourcentage de maîtrise pondérée ;
- rétention estimée ;
- exercices réalisés ;
- précision sur 7, 30 et 90 jours ;
- prochaine charge de révision.

### 9.6 Déblocage

Par défaut :

- les 10 premiers kanji du niveau sont disponibles ;
- de nouveaux kanji sont proposés lorsque la charge de révision reste acceptable ;
- l’utilisateur peut forcer le déblocage ;
- le niveau suivant peut être consulté à tout moment ;
- le mode guidé recommande de maîtriser 80 % du niveau précédent.

Aucun verrou ne doit empêcher un utilisateur motivé d’explorer.

### 9.7 Session quotidienne

La session recommandée mélange :

1. cartes en retard ;
2. cartes dues aujourd’hui ;
3. points faibles ;
4. nouveaux kanji ;
5. exercices contextuels de consolidation.

Répartition initiale :

- 50 % révisions dues ;
- 20 % erreurs récentes ;
- 20 % nouveaux contenus ;
- 10 % variation ou défi.

Si la file de révision est importante, les nouveaux contenus sont réduits automatiquement.

---

## 10. Expérience utilisateur

## 10.1 Écrans

### Tableau de bord

- niveau actif ;
- progression ;
- révisions dues ;
- bouton « Continuer » ;
- objectif quotidien ;
- activité récente ;
- points faibles ;
- calendrier de régularité ;
- aperçu de la charge à venir.

### Parcours par niveau

- onglets N5 à N1 ;
- unités ou chapitres ;
- kanji par état ;
- progression ;
- filtres ;
- ordre recommandé ;
- recherche.

### Fiche kanji

Toutes les sections définies au chapitre 5.

### Session d’apprentissage

- découverte guidée ;
- sens ;
- lectures ;
- animation des traits ;
- mots ;
- phrases ;
- mini-quiz de sortie.

### Session de révision

- interface rapide ;
- raccourcis clavier ;
- affichage progressif des aides ;
- correction détaillée ;
- bouton « Signaler un problème ».

### Statistiques

- précision ;
- rétention ;
- temps passé ;
- progression par compétence ;
- kanji faibles ;
- confusion fréquente ;
- historique des sessions.

### Recherche

Recherche par :

- kanji ;
- lecture ;
- sens français ;
- composant ;
- radical ;
- nombre de traits ;
- niveau ;
- mot.

### Sources et licences

Page obligatoire listant :

- source ;
- version ;
- date d’import ;
- licence ;
- attribution ;
- contenu concerné.

## 10.2 Aides pédagogiques

Réglages :

- afficher les furigana toujours, au survol ou jamais ;
- afficher le romaji ;
- masquer la traduction ;
- vitesse d’animation ;
- nombre de nouveaux kanji par jour ;
- objectif de rétention ;
- mode clavier ;
- thème ;
- son futur.

### 10.3 Mobile

L’application est mobile-first.

Contraintes :

- zone tactile suffisante ;
- aucune interaction dépendante du survol ;
- exercices utilisables à une main ;
- dessin SVG responsive ;
- reprise après mise en veille ;
- session persistée à chaque réponse.

---

## 11. Modèle de données

Le schéma exact peut évoluer, mais les concepts suivants sont obligatoires.

### 11.1 Identité et préférences

#### `users`

- `id`
- `email`
- `password_hash`
- `display_name`
- `created_at`
- `updated_at`
- `last_login_at`

#### `user_settings`

- `user_id`
- `active_level`
- `daily_new_limit`
- `desired_retention`
- `furigana_mode`
- `romaji_enabled`
- `timezone`
- `theme`

#### `sessions`

- `id`
- `user_id`
- `token_hash`
- `expires_at`
- `created_at`
- `last_seen_at`
- `revoked_at`

### 11.2 Référentiel kanji

#### `kanji`

- `id`
- `literal`
- `unicode_codepoint`
- `stroke_count`
- `frequency_rank`
- `school_grade`
- `primary_radical_id`
- `kanjivg_path`
- `status`
- `content_version_id`

#### `kanji_meanings`

- `id`
- `kanji_id`
- `language`
- `meaning`
- `is_primary`
- `source_id`
- `editorial_status`

#### `kanji_readings`

- `id`
- `kanji_id`
- `reading`
- `reading_type`
- `okurigana`
- `commonness`
- `source_id`

#### `radicals`

- `id`
- `literal`
- `variant`
- `name_fr`
- `meaning_fr`
- `stroke_count`

#### `components`

- `id`
- `literal`
- `name_fr`
- `meaning_fr`
- `component_type`

#### `kanji_components`

- `kanji_id`
- `component_id`
- `position`
- `is_radical`
- `is_semantic`
- `is_phonetic`
- `confidence`
- `source_id`

#### `kanji_notes`

- `kanji_id`
- `mnemonic_fr`
- `etymology_fr`
- `etymology_source`
- `confusions`
- `editorial_status`

### 11.3 Curriculum

#### `curricula`

- `id`
- `code`
- `name`
- `version`
- `status`
- `published_at`

#### `curriculum_kanji`

- `curriculum_id`
- `kanji_id`
- `level`
- `order`
- `confidence`
- `source_id`
- `reviewed_at`

### 11.4 Vocabulaire et phrases

#### `vocabulary`

- `id`
- `written_form`
- `reading`
- `meaning_fr`
- `part_of_speech`
- `frequency_rank`
- `estimated_level`
- `source_id`
- `editorial_status`

#### `vocabulary_kanji`

- `vocabulary_id`
- `kanji_id`
- `position`
- `reading_in_word`

#### `sentences`

- `id`
- `japanese`
- `translation_fr`
- `difficulty`
- `source_id`
- `source_external_id`
- `author`
- `license`
- `editorial_status`

#### `sentence_tokens`

- `id`
- `sentence_id`
- `surface`
- `reading`
- `start_offset`
- `end_offset`
- `vocabulary_id`

### 11.5 Exercices

#### `exercise_templates`

- `id`
- `type`
- `skill`
- `schema_version`
- `renderer`
- `grader`

#### `exercise_items`

- `id`
- `template_id`
- `level`
- `kanji_id`
- `vocabulary_id`
- `sentence_id`
- `prompt_json`
- `answer_json`
- `explanation_json`
- `difficulty`
- `source_id`
- `content_version_id`
- `editorial_status`

### 11.6 Progression

#### `review_cards`

- `id`
- `user_id`
- `subject_type`
- `subject_id`
- `skill`
- données FSRS sérialisées ;
- `due_at`
- `last_review_at`
- `state`

#### `review_logs`

- `id`
- `review_card_id`
- `exercise_item_id`
- `rating`
- `was_correct`
- `response_time_ms`
- `answer_payload`
- état avant ;
- état après ;
- `reviewed_at`

#### `user_kanji_progress`

- `user_id`
- `kanji_id`
- `meaning_score`
- `reading_score`
- `vocabulary_score`
- `context_score`
- `stroke_score`
- `overall_score`
- `status`
- `first_seen_at`
- `mastered_at`
- `updated_at`

#### `study_sessions`

- `id`
- `user_id`
- `mode`
- `started_at`
- `ended_at`
- `answered_count`
- `correct_count`
- `duration_seconds`

### 11.7 Provenance et version

#### `content_sources`

- `id`
- `name`
- `url`
- `license`
- `attribution_text`
- `source_version`
- `imported_at`
- `checksum`

#### `content_versions`

- `id`
- `version`
- `git_commit`
- `published_at`
- `notes`

---

## 12. API

Préfixe : `/api/v1`

### Authentification

```text
POST   /auth/register
POST   /auth/login
POST   /auth/logout
GET    /auth/me
POST   /auth/password/change
```

### Curriculum

```text
GET    /curricula
GET    /curricula/:code/levels
GET    /curricula/:code/levels/:level
GET    /curricula/:code/levels/:level/progress
```

### Kanji

```text
GET    /kanji
GET    /kanji/:literal
GET    /kanji/:literal/related
GET    /kanji/:literal/vocabulary
GET    /kanji/:literal/sentences
GET    /kanji/:literal/progress
```

### Étude

```text
POST   /study/sessions
GET    /study/queue
POST   /study/answers
POST   /study/sessions/:id/finish
GET    /study/resume
```

### Progression

```text
GET    /progress/dashboard
GET    /progress/levels/:level
GET    /progress/weak-points
GET    /progress/history
```

### Paramètres

```text
GET    /settings
PATCH  /settings
```

### Contenu et signalement

```text
POST   /content/issues
GET    /sources
```

L’API d’administration n’est pas exposée publiquement en V1. Les corrections de contenu passent par le dépôt Git et le pipeline.

---

## 13. Architecture des modules

```text
apps/
  web/
    src/
      app/
      routes/
      features/
        auth/
        dashboard/
        curriculum/
        kanji/
        study/
        progress/
        settings/
      components/
      lib/
      styles/

  api/
    src/
      modules/
        auth/
        users/
        curricula/
        kanji/
        vocabulary/
        sentences/
        exercises/
        study/
        progress/
        content/
      infrastructure/
        database/
        security/
        observability/
      main.ts

packages/
  domain/
    src/
      kanji/
      curriculum/
      study/
      review/
      progress/

  contracts/
    src/
      api/
      schemas/
      enums/

  content-schema/
    src/
      kanji.schema.ts
      vocabulary.schema.ts
      sentence.schema.ts
      exercise.schema.ts

  ui/
    src/

tools/
  content/
    import-kanjidic/
    import-jmdict/
    import-kanjivg/
    import-krad/
    import-tatoeba/
    normalize/
    assign-levels/
    generate-exercises/
    validate/
    publish/

content/
  raw/
  normalized/
  curated/
  generated/
  manifests/
  licenses/
  reports/

docs/
  adr/
  architecture/
  content/
  operations/
```

---

## 14. Pipeline de contenu

### 14.1 Étapes

```text
Téléchargement
  -> vérification du checksum
  -> conservation de la source brute
  -> parsing
  -> normalisation
  -> fusion des sources
  -> classement JLPT aligné
  -> enrichissement français
  -> génération déterministe
  -> validations automatiques
  -> rapport de couverture
  -> validation éditoriale
  -> publication d’un pack versionné
```

### 14.2 Commandes attendues

```bash
pnpm content:download
pnpm content:import
pnpm content:normalize
pnpm content:generate
pnpm content:validate
pnpm content:report
pnpm content:publish
```

Commande complète :

```bash
pnpm content:build
```

### 14.3 Manifest

Chaque pack publié possède un manifest :

```json
{
  "version": "2026.08.1",
  "createdAt": "2026-08-06T00:00:00Z",
  "sources": [
    {
      "name": "KANJIDIC2",
      "version": "2026-08-01",
      "checksum": "sha256:..."
    }
  ],
  "counts": {
    "kanji": 0,
    "vocabulary": 0,
    "sentences": 0,
    "exercises": 0
  },
  "validation": {
    "errors": 0,
    "warnings": 0
  }
}
```

### 14.4 Mises à jour

Les données EDRDG doivent pouvoir être actualisées régulièrement.

Une mise à jour :

- ne supprime pas automatiquement une correction éditoriale ;
- produit un diff ;
- détecte les changements de lecture, sens ou métadonnées ;
- nécessite une validation avant publication ;
- conserve la version utilisée par chaque exercice ;
- ne supprime pas les anciens historiques de révision.

---

## 15. Sécurité

### 15.1 Authentification

- mot de passe hashé avec Argon2id ;
- cookie `HttpOnly`, `Secure`, `SameSite=Lax` ;
- rotation de session après connexion ;
- expiration et révocation ;
- limitation des tentatives ;
- protection CSRF pour les requêtes mutatives ;
- aucun token d’authentification en localStorage.

### 15.2 Données utilisateur

- export JSON de la progression ;
- suppression du compte ;
- sauvegardes ;
- journalisation sans réponses sensibles ;
- aucune publicité ou traçage tiers requis ;
- télémétrie désactivable.

### 15.3 SVG

Les fichiers KanjiVG sont traités comme des données contrôlées lors du build.

Ne jamais injecter un SVG arbitraire fourni par un utilisateur.

---

## 16. Performance et résilience

Objectifs :

- affichage initial inférieur à 2 secondes sur connexion correcte ;
- réponse API courante sous 300 ms au 95e percentile ;
- passage à l’exercice suivant perçu comme instantané ;
- préchargement des cinq exercices suivants ;
- enregistrement d’une réponse avant navigation ;
- reprise de session après rechargement ;
- cache des fiches et SVG ;
- pagination des grandes listes ;
- index MariaDB sur les files de révision et recherches fréquentes.

Index critiques :

```text
review_cards(user_id, due_at)
review_cards(user_id, subject_id, skill)
curriculum_kanji(curriculum_id, level, order)
exercise_items(level, kanji_id, skill)
kanji_readings(reading)
vocabulary(reading)
review_logs(review_card_id, reviewed_at)
```

### 16.1 Hors connexion

V1.1 peut fournir :

- téléchargement du pack N5 ou du niveau actif ;
- file locale temporaire ;
- synchronisation idempotente des réponses ;
- détection des conflits par identifiant de réponse UUID ;
- serveur comme source de vérité après synchronisation.

---

## 17. Observabilité

- logs JSON structurés ;
- identifiant de requête ;
- erreurs frontend et backend ;
- métriques de latence ;
- nombre de réponses enregistrées ;
- taux d’échec du pipeline de contenu ;
- rapport de couverture par niveau ;
- rapport des exercices signalés ;
- aucun contenu de mot de passe ou cookie dans les logs.

Événements produit internes :

```text
study_session_started
exercise_answered
exercise_failed
kanji_discovered
kanji_mastered
level_progress_changed
content_issue_reported
```

---

## 18. Tests

## 18.1 Tests unitaires

- normalisation kana ;
- comparaison des réponses ;
- calcul de maîtrise ;
- sélection de file ;
- déblocage ;
- agrégation de progression ;
- encapsulation FSRS ;
- génération des distracteurs.

## 18.2 Tests d’intégration

- inscription et connexion ;
- récupération d’une fiche ;
- création d’une session ;
- enregistrement d’une réponse ;
- mise à jour de la carte FSRS ;
- reprise de session ;
- changement de version de contenu ;
- recalcul de progression.

## 18.3 Tests end-to-end

Scénario principal :

1. créer un compte ;
2. sélectionner N5 ;
3. ouvrir une fiche ;
4. terminer la découverte ;
5. lancer une révision ;
6. répondre juste et faux ;
7. fermer l’application ;
8. se reconnecter ;
9. retrouver la progression ;
10. vérifier la prochaine révision.

## 18.4 Tests de contenu

Le contenu possède sa propre suite de tests et son propre rapport CI.

Aucun déploiement n’est autorisé avec une erreur de contenu bloquante.

---

## 19. Déploiement

### 19.1 Développement

Environnement local sans Docker :

- `web` : serveur de développement Vite (`pnpm dev`)
- `api` : API NestJS en local (`pnpm dev`)
- `mariadb` : service MariaDB local déjà installé, lancé manuellement ou comme service système
- `mailpit` facultatif

### 19.2 Production

Déploiement recommandé :

- frontend statique servi par CDN ;
- API Node sur un serveur (conteneur ou process managé par systemd) ;
- MariaDB managé ou installé sur serveur avec sauvegardes ;
- reverse proxy TLS ;
- migrations exécutées avant bascule ;
- sauvegarde quotidienne ;
- déploiement sans interruption si possible.

### 19.3 Environnements

- local ;
- test ;
- staging ;
- production.

Le contenu publié doit être identique entre staging et production pour une version donnée.

---

## 20. Plan d’implémentation

## Phase 0 — Fondations

- monorepo ;
- CI ;
- NestJS ;
- React ;
- MariaDB (local, sans Docker) ;
- Prisma ;
- authentification ;
- documentation ;
- conventions de code ;
- premier pipeline vide.

## Phase 1 — MVP N5 complet

- référentiel N5 ;
- fiches complètes ;
- KanjiVG ;
- vocabulaire ;
- phrases ;
- exercices fixes ;
- FSRS ;
- tableau de bord ;
- progression ;
- reprise de session ;
- recherche ;
- page sources et licences.

Critère de sortie :

- tous les kanji N5 publiés possèdent le minimum de contenu ;
- au moins 3 000 exercices N5 validés ;
- progression persistante ;
- zéro erreur bloquante du validateur.

## Phase 2 — N4

- pack N4 ;
- nouveaux types de contexte ;
- confusions visuelles ;
- statistiques détaillées ;
- mode révision ciblée.

Critère de sortie :

- au moins 5 000 exercices N4 validés.

## Phase 3 — N3

- mini-textes ;
- phrases plus naturelles ;
- lecture de vocabulaire avancée ;
- personnalisation de la charge.

## Phase 4 — N2 et N1

- grands volumes de vocabulaire ;
- nuances ;
- mots composés ;
- lecture en contexte ;
- filtres de fréquence ;
- textes plus longs.

## Phase 5 — Écriture et audio

- tracé ;
- comparaison de traits ;
- dictée ;
- audio sous licence ;
- exercices d’écoute.

---

## 21. Critères d’acceptation fonctionnels

### Fiche

- une fiche affiche les sens, lectures, radical, composants, traits, mots et phrases ;
- l’ordre des traits est animé ;
- les lectures courantes sont distinguées des lectures rares ;
- la provenance est disponible ;
- les mnémotechniques sont distinguées de l’étymologie.

### Révision

- les exercices sont fixes et disponibles sans IA ;
- la session mélange plusieurs compétences ;
- chaque réponse met à jour la progression ;
- une erreur affiche une explication ;
- la prochaine révision est calculée ;
- la session peut être reprise.

### Progression

- l’utilisateur voit sa progression par niveau ;
- l’utilisateur voit sa progression par kanji ;
- l’utilisateur voit ses points faibles ;
- la progression persiste après déconnexion ;
- une correction du niveau d’un kanji ne supprime pas son historique.

### Contenu

- chaque item possède une source ;
- chaque source possède une licence ;
- les seuils de couverture sont respectés ;
- aucun contenu brouillon n’est publié ;
- les données linguistiques peuvent être mises à jour sans écraser les enrichissements éditoriaux.

---

## 22. Décisions explicitement refusées

### Une simple base JSON servie directement par React

Refusée car :

- progression difficile à synchroniser ;
- absence de modèle éditorial ;
- import et versionnement fragiles ;
- faible capacité d’évolution.

### Une seule table `kanji` contenant tout en JSON

Refusée car :

- requêtes complexes ;
- duplication ;
- mauvaises contraintes ;
- impossibilité de tracer correctement les sources ;
- difficulté pour les exercices et la progression.

### Un champ `mastered: boolean`

Refusé car la maîtrise doit être multidimensionnelle et évoluer dans le temps.

### Des exercices générés par un LLM à chaque session

Refusés en première version pour :

- coût ;
- latence ;
- erreurs linguistiques ;
- réponses ambiguës ;
- non-reproductibilité ;
- difficulté de test ;
- dépendance à un fournisseur.

### Présenter les niveaux comme officiels

Refusé car le JLPT ne publie pas de liste exhaustive officielle actuelle de kanji par niveau.

### Utiliser Node.js Current en production

Refusé. Utiliser une version LTS.

### Microservices

Refusés. Le projet ne le justifie pas.

---

## 23. Conséquences positives

- contenu fiable et vérifiable ;
- progression réellement utile ;
- application utilisable sans coût d’IA ;
- architecture compatible avec N5 à N1 ;
- possibilité d’ajouter une application mobile ;
- données linguistiques actualisables ;
- tests automatiques du contenu ;
- historique utilisateur robuste ;
- possibilité d’ajouter l’écriture et l’audio plus tard.

---

## 24. Conséquences négatives

- coût initial élevé de préparation du contenu ;
- nécessité de gérer plusieurs licences ;
- besoin d’un pipeline d’import ;
- nécessité de validation humaine ;
- modèle de données plus riche ;
- temps de développement supérieur à une simple application de flashcards ;
- classement JLPT forcément approximatif et versionné.

Ces coûts sont acceptés, car la qualité pédagogique et la pérennité sont des exigences centrales.

---

## 25. Documentation obligatoire pour les agents

Tout agent modifiant le projet doit :

1. lire cet ADR ;
2. lire la documentation du module concerné ;
3. créer ou mettre à jour les migrations ;
4. mettre à jour les contrats API ;
5. ajouter les tests ;
6. mettre à jour la documentation humaine ;
7. mettre à jour la documentation agent ;
8. exécuter les validateurs de contenu ;
9. ne jamais modifier silencieusement une provenance ou une licence ;
10. ajouter un ADR si une décision structurante change.

Fichiers minimum :

```text
AGENTS.md
README.md
docs/architecture/overview.md
docs/content/pipeline.md
docs/content/licensing.md
docs/operations/development.md
docs/operations/deployment.md
docs/adr/ADR-001-kanji-learning-platform.md
```

---

## 26. Définition de terminé

Une fonctionnalité n’est terminée que si :

- le code fonctionne ;
- les types sont stricts ;
- les erreurs sont gérées ;
- les tests unitaires sont présents ;
- les tests d’intégration sont présents si nécessaire ;
- les tests E2E critiques passent ;
- l’accessibilité de base est respectée ;
- la documentation est mise à jour ;
- le contenu possède sa provenance ;
- le pipeline de contenu passe ;
- aucun secret n’est commité ;
- la migration est réversible ou documentée ;
- la fonctionnalité fonctionne sur mobile et ordinateur.

---

## 27. Références vérifiées au moment de la décision

### JLPT

- Summary of Linguistic Competence Required for Each Level  
  https://www.jlpt.jp/e/about/levelsummary.html
- JLPT FAQ — absence de listes exhaustives officielles actuelles  
  https://www.jlpt.jp/e/faq/

### Runtime et framework

- Node.js release status  
  https://nodejs.org/en/about/previous-releases
- React versions  
  https://react.dev/versions
- Vite releases  
  https://vite.dev/blog/announcing-vite8-1
- NestJS documentation  
  https://docs.nestjs.com/
- MariaDB release notes  
  https://mariadb.com/kb/en/mariadb-release-notes/
- Prisma MySQL/MariaDB support  
  https://www.prisma.io/docs/orm/overview/databases/mysql
- Prisma ORM documentation  
  https://www.prisma.io/docs/orm

### Données japonaises

- KANJIDIC2  
  https://www.edrdg.org/kanjidic/kanjd2index.html
- EDRDG licence  
  https://www.edrdg.org/edrdg/licence.html
- RADKFILE / KRADFILE  
  https://www.edrdg.org/krad/kradinf.html
- KanjiVG  
  https://kanjivg.tagaini.net/
- Tatoeba corpus usage  
  https://en.wiki.tatoeba.org/articles/show/using-the-tatoeba-corpus

### Répétition espacée

- ts-fsrs  
  https://github.com/open-spaced-repetition/ts-fsrs

---

## 28. Résumé exécutable pour l’agent de code

Construire un monorepo TypeScript composé d’un frontend React/Vite et d’une API NestJS/Fastify avec MariaDB/Prisma, sans Docker.

Commencer par un MVP N5 complet, mais concevoir toutes les structures pour N5 à N1.

Ne jamais appeler de LLM pendant une révision. Les exercices doivent être matérialisés, versionnés et validés.

Importer KANJIDIC2, JMdict, KRADFILE/RADKFILE et KanjiVG au moyen d’un pipeline reproductible. Conserver les sources, versions, checksums, licences et attributions.

Ne jamais affirmer que les listes de kanji par niveau sont officielles. Les présenter comme un curriculum aligné JLPT, avec provenance et niveau de confiance.

Modéliser la progression séparément pour le sens, les lectures, le vocabulaire, le contexte et les traits. Utiliser FSRS derrière une abstraction du domaine.

La qualité et le volume du contenu sont des critères de livraison aussi importants que le code.

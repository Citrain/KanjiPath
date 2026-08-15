# AGENTS.md

Règles pour tout agent (humain ou IA) modifiant ce projet.
Référence produit/architecture : `ADR-001-plateforme-apprentissage-kanji.md` (découpé par tâche dans `adr/`). Le mode conversation local est défini par `ADR-003-conversation-vocale-japonais-locale.md`.

## À lire avant toute modification

1. `ADR-001-plateforme-apprentissage-kanji.md` + le dossier `adr/<theme>/` concerné.
2. `docs/README.md` (index de la documentation), puis le(s) document(s) du module touché.
3. `docs/agent/guide.md` (conventions, pièges connus, recettes).
4. Pour le mode conversation : `ADR-003-conversation-vocale-japonais-locale.md`,
   `adr/12-local-ai-conversation.md` et `docs/operations/local-ai.md`.
5. Pour les extensions produit acceptees : lire l'ADR concerne parmi `ADR-005` a
   `ADR-011` avant toute implementation (mission, carte kanji, carnet, shadowing,
   immersion, timeline, mode zen).

## Obligations

1. Lire l'ADR et la documentation du module concerné.
2. Créer ou mettre à jour les migrations Prisma (jamais de migration destructive silencieuse).
3. Mettre à jour les contrats API dans `packages/contracts`.
4. Ajouter les tests (unitaires, intégration si nécessaire).
5. Exécuter les validateurs de contenu (`pnpm content:validate`).
6. Ne jamais modifier silencieusement une provenance ou une licence.
7. Ajouter un ADR si une décision structurante change.

## Obligation de documentation (humaine + agent)

Toute modification significative DOIT mettre à jour, dans le même changement :

- **Documentation humaine** (`docs/`) : architecture, contenu, opérations. Elle doit
  rester compréhensible par un nouvel arrivant sans lire le code. Voir `docs/README.md`.
- **Documentation agent** : ce fichier (`AGENTS.md`) et `docs/agent/guide.md`.
  Tout piège découvert, toute convention nouvelle, toute commande utile doit y être
  consigné pour que l'agent suivant ne retombe pas dessus.

Une tâche n'est **pas terminée** si la documentation correspondante n'est pas à jour.

## Cartographie de la documentation

| Fichier | Public | Contenu |
|---|---|---|
| `README.md` | humain | Démarrage rapide, scripts |
| `AGENTS.md` | agent | Règles obligatoires (ce fichier) |
| `docs/README.md` | les deux | Index de la documentation |
| `docs/architecture/overview.md` | humain | Stack, monorepo, flux de données, sécurité |
| `docs/content/pipeline.md` | humain | Pipeline de contenu (download → publish) |
| `docs/content/licensing.md` | humain | Sources, licences, provenance |
| `docs/operations/development.md` | humain | Environnement local (sans Docker), MariaDB |
| `docs/operations/deployment.md` | humain | Environnements, production, vérifications |
| `docs/operations/local-ai.md` | humain | Préparation des services locaux de conversation vocale |
| `docs/adr/README.md` | les deux | Pointeur vers l'ADR et son découpage |
| `docs/agent/guide.md` | agent | Conventions, pièges connus, recettes |

## Commandes de vérification

```bash
pnpm typecheck          # TypeScript strict sur tout le monorepo
pnpm lint               # Biome
pnpm test               # build + tests (unitaires + intégration MariaDB)
pnpm content:validate   # validateurs de contenu
```

Setup / lancement :

```bash
.\dev.bat               # ou pnpm dev:all  -> setup complet + serveurs
.\dev.bat -Voice        # ajoute Ollama + STT; VOICEVOX reste optionnel
pnpm dev:setup          # setup seul (DB, migrations) sans serveurs
pnpm dev                # serveurs seul (DB déjà à jour)
pnpm dev:voice          # setup + web/API + services vocaux locaux
```

## Contraintes techniques

- Node.js 24 LTS, TypeScript strict, pnpm workspaces.
- MariaDB local (pas de Docker) + Prisma provider `mysql`.
- Aucun appel LLM au runtime ; exercices fixes, versionnés, validés.
- Exception ADR-003 : un LLM **local** peut conduire le mode conversation oral, jamais
  générer des exercices ni définir le niveau. Il est appelé uniquement par un provider
  backend ; STT/LLM/TTS restent liés à `127.0.0.1`, le mode texte reste disponible et
  les transcriptions/audio sont des données utilisateur.
- Conversation locale : `apps/api/src/modules/conversation/` est l'unique relais vers
  Ollama, faster-whisper et VOICEVOX. Ne jamais persister `stt.partial` ou un buffer
  audio; un JSON LLM invalide reçoit une seule réparation, puis le tour échoue sans
  persistance. Ne jamais fabriquer ou persister une réplique de fallback générique.
- Conversation locale : les corrections de romaji restent contextuelles. Un exemple de prompt
  peut guider une ellipse connue, mais ne doit jamais devenir une règle métier codée en dur;
  conserver la validation JSON et la relecture dédiée, dont le prompt doit rester distinct et
  concis par rapport au prompt de dialogue. Elle renvoie un mini-contrat valide avant que l'API
  n'ajoute la correction a la reponse de dialogue deja validee.
- Conversation locale : une correction LLM partielle n'est normalisée que si son champ
  `corrected` est présent et valide; compléter ensuite les métadonnées manquantes et revalider le
  contrat API Zod. Une correction identique au transcript après normalisation est supprimée pour
  préserver l'état vert de phrase correcte. Ne jamais accepter une sortie JSON LLM arbitraire.
- Conversation locale : `correction.corrected` est destiné à un débutant. Le prompt doit y
  exiger du hiragana ou katakana uniquement; les kanji restent dans `reply.ja`.
- Conversation locale : le romaji simplifié reste une réponse correcte quand la grammaire et le
  sens sont justes. Ne jamais créer une correction uniquement parce que le modèle le retranscrit
  en kana, y compris pour les voyelles longues et emprunts tels que `menu`.
- Conversation locale : une réponse générique, dupliquée ou dont la question a déjà été posée
  reçoit une seule régénération. Si elle reste insatisfaisante, le tour échoue sans persistance;
  une réponse sans question reste valide quand elle fait naturellement avancer l'échange.
- Conversation locale : le LLM ne génère aucun identifiant de progression. Son contrat de sortie
  contient réplique, correction et intention; `learning` est complété et borné par l'application.
- Conversation locale : `free` est le scénario web par défaut et ne force aucun rôle. Le champ
  `goals` peut définir une situation ou un objectif; les scénarios spécialisés restent proposés.
- Quiz IA local : ce mode (ADR-004) est une exception limitée aux exercices fixes. Le LLM local
  génère un snapshot personnel validé une fois; toute correction ensuite est déterministe, sans
  LLM. Ne jamais publier ce snapshot, l'ajouter au pipeline de contenu, exposer sa clé de
  correction au frontend ou modifier les cartes FSRS automatiquement.
- Quiz IA local : le contrat génératif QCM reste compact et uniforme avec exactement quatre
  options. Le modèle ne choisit ni identifiant, ni compétence, ni difficulté, ni étape; l'API les
  calcule. L'API planifie aussi les types et génère chaque question séparément avec un schéma
  atomique sans `type`. Une question invalide reçoit au plus quatre générations strictement
  validées, jamais une réparation heuristique de champs ni une régénération du lot complet.
- Quiz IA local : les QCM de lecture sont construits déterministement depuis le vocabulaire publié;
  leur kana est masqué avant correction. `cloze_qcm` et `conjugation_qcm` exigent le marqueur
  `＿＿＿` dans `japanese` et `kana`, afin que la réponse ne soit jamais visible dans l'énoncé.
- Quiz IA local : ne jamais utiliser `num_predict: -1`. Borner la sortie à 1024 tokens par
  question; `gemma4` peut sinon continuer après un JSON complet et produire des commentaires
  jusqu'à épuisement du contexte.
- Quiz IA local : la description de mission est la contrainte pédagogique prioritaire. Filtrer le
  référentiel injecté par ses mots-clés français ou japonais; lorsqu'une correspondance existe, ne
  jamais noyer la mission sous du vocabulaire fréquent sans rapport.
- Quiz IA local : préserver la lisibilité de l'interface avec une zone de question large, des textes
  pédagogiques au moins en taille de base et des cibles tactiles d'au moins 48 px; garder les grands
  textes japonais responsifs et une seule colonne de choix sur petit écran.
- Quiz IA local : une nouvelle session de même mission exclut les énoncés japonais des trois
  sessions précédentes. Conserver la température modérée, l'angle variable et la rotation du
  référentiel; une ancienne question répétée doit être régénérée, jamais acceptée ou reformulée
  heuristiquement par l'application.
- Extensions produit ADR-005 a ADR-011 : toute implementation applique d'abord la decision
  concernee, avec migration Prisma, contrats API, tests et documentation. Elles ne peuvent ni
  publier des donnees personnelles, ni contourner FSRS, les preferences d'etude, les licences ou
  les contraintes locales de l'ADR-003.
- Carnet personnel (ADR-007) : ne jamais réutiliser `review_cards`, `review_logs`,
  `study_sessions` ou `user_kanji_progress` pour ses révisions. Les entrées, sources,
  cartes, journaux et sessions restent dans leurs tables dédiées ; une provenance
  publiée est résolue côté API et figée avec sa version, tandis qu'un tour de
  conversation doit toujours être chargé avec son propriétaire.
- Carte visuelle (ADR-006) : ne jamais persister ou inférer une relation au runtime. La vue API
  reste bornée et s'appuie uniquement sur les relations publiées du pipeline ; le web calcule la
  disposition mais conserve une liste textuelle, des filtres accessibles et un état de progression
  non indiqué par la seule couleur.
- Audio : importer uniquement des clips avec licence individuelle explicite. Pour cette
  instance personnelle privée, CC BY-NC est autorisée selon `ADR-002` ; toute
  distribution publique ou commerciale reste interdite tant que ces clips sont présents.
  Conserver fichier brut, checksum, version, attribution et licence dans le pipeline,
  et vérifier chaque clip contre le snapshot Tatoeba `jpn_sentences_with_audio`.
- Les filtres de contenu affichés sur une liste doivent être fournis par le résumé API
  (ex. `hasAudio` dans `KanjiSummary`), jamais par une requête par carte côté web.
- Les lectures affichées dans une phrase viennent des tokens de contexte générés au
  pipeline, jamais de la lecture isolée du kanji.
- Étude : `kanaInputEnabled=false` exclut `reading_input_kana` et
  `audio_dictation_kana` de toute nouvelle session, quel que soit son mode. Ne pas
  exclure les QCM qui affichent des choix en kana, car ils ne requièrent pas de clavier japonais.
- Étude : marquer un kanji comme connu fixe ses scores à 100 %, suspend ses cartes FSRS
  existantes et l'exclut des introductions automatiques. Il reste disponible en révision ciblée.
- Ne jamais présenter les listes de kanji comme « officielles JLPT » :
  formulation obligatoire « Parcours aligné sur le JLPT ».
- Authentification : Argon2id, cookie `HttpOnly` + `SameSite=Lax`, CSRF double-submit,
  aucun token en localStorage.
- La mnémotechnique ne doit jamais être présentée comme l'étymologie.
- Ne jamais appeler un composant « radical » automatiquement.

## Définition de terminé

Voir ADR-001 section 26 : code fonctionnel, types stricts, erreurs gérées, tests,
accessibilité, **documentation humaine + agent à jour**, provenance du contenu,
pipeline valide, aucun secret commité, migration réversible ou documentée,
fonctionnement mobile + ordinateur.

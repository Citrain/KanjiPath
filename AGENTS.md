# AGENTS.md

Règles pour tout agent (humain ou IA) modifiant ce projet.
Référence produit/architecture : `ADR-001-plateforme-apprentissage-kanji.md` (découpé par tâche dans `adr/`). Le mode conversation local est défini par `ADR-003-conversation-vocale-japonais-locale.md`.

## À lire avant toute modification

1. `ADR-001-plateforme-apprentissage-kanji.md` + le dossier `adr/<theme>/` concerné.
2. `docs/README.md` (index de la documentation), puis le(s) document(s) du module touché.
3. `docs/agent/guide.md` (conventions, pièges connus, recettes).
4. Pour le mode conversation : `ADR-003-conversation-vocale-japonais-locale.md`,
   `adr/12-local-ai-conversation.md` et `docs/operations/local-ai.md`.

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
- Audio : importer uniquement des clips avec licence individuelle explicite. Pour cette
  instance personnelle privée, CC BY-NC est autorisée selon `ADR-002` ; toute
  distribution publique ou commerciale reste interdite tant que ces clips sont présents.
  Conserver fichier brut, checksum, version, attribution et licence dans le pipeline,
  et vérifier chaque clip contre le snapshot Tatoeba `jpn_sentences_with_audio`.
- Les filtres de contenu affichés sur une liste doivent être fournis par le résumé API
  (ex. `hasAudio` dans `KanjiSummary`), jamais par une requête par carte côté web.
- Les lectures affichées dans une phrase viennent des tokens de contexte générés au
  pipeline, jamais de la lecture isolée du kanji.
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

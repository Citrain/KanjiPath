# ADR-003 - Conversation vocale japonaise locale pilotee par l'application

- **Statut** : Accepte
- **Date** : 2026-08-09
- **Decisionnaires** : proprietaire du projet
- **Portee** : mode conversation / 会話, services IA locaux et progression orale

## Contexte

KanjiPath doit proposer un entrainement oral en japonais. L'utilisateur choisit un
parcours aligne sur le JLPT (N5 et N4 en premier), un scenario, une difficulte, des
objectifs pedagogiques et une politique de correction. Il parle depuis le navigateur,
voit une transcription en direct, recoit une reponse japonaise ecrite et vocale, ainsi
que des corrections en francais.

Le traitement doit etre local pour preserver la confidentialite des conversations,
eviter toute dependance cloud et exploiter, lorsque disponible, le GPU NVIDIA local.
Le mode texte reste utilisable si une brique vocale est indisponible.

Cette ADR est une exception ciblee au principe d'ADR-001 interdisant les LLM pendant
les exercices : les exercices restent fixes, versionnes et valides. Le LLM local sert
uniquement a conduire une conversation dont les contraintes pedagogiques sont imposees
et verifiees par l'application.

## Decision

Le mode conversation est orchestre par l'API NestJS. Les fournisseurs techniques sont
injectables et ne sont jamais appeles directement depuis le frontend ni depuis le
domaine pedagogique.

```text
Navigateur (micro, UI, WebSocket)
  -> API / ConversationOrchestrator
       -> SpeechToTextProvider      -> faster-whisper local
       -> LLMProvider               -> Ollama / qwen3.5:9b-q8_0 local
       -> JapaneseTTSProvider       -> VOICEVOX ENGINE local
       -> FrenchTTSProvider          -> moteur local ou Web Speech configurable
  -> transcription, correction, reponse et audio
```

- **STT** : `faster-whisper`, langue forcee `ja`, VAD active, modele initial a
  benchmarker `large-v3-turbo`.
- **LLM** : Ollama local avec `qwen3.5:9b-q8_0`. L'adaptateur `LLMProvider` permet
  son remplacement sans impact sur le frontend.
- **TTS japonais** : VOICEVOX ENGINE, via son API HTTP locale.
- **TTS francais** : `FrenchTTSProvider`, avec implementation locale ou fallback
  navigateur. Le fallback navigateur n'est pas garanti hors ligne.
- **MCP** : reserve a l'agent de developpement, hors runtime de l'application.

Les services locaux sont lies a `127.0.0.1` par defaut : Ollama `11434`, VOICEVOX
`50021`, STT `8765` et, s'il est active, TTS francais `8766`.

## Pilotage pedagogique

Le LLM n'est pas la source de verite du niveau. L'application fournit pour chaque tour
les donnees structurees pertinentes : niveau, scenario, difficulte, grammaires et
vocabulaire autorises, kanji connus, objectifs de session, historique resume et
politique de correction.

Les premiers choix exposes sont :

- niveaux N5 et N4, extensibles de N3 a N1 ;
- scenarios presentation, restaurant, magasin, voyage, travail, loisirs, jeux video et
  famille ;
- difficultes `easy`, `normal` et `hard` ;
- corrections `none`, `important`, `all`, `end_of_turn` et `end_of_session` ;
- vitesse japonaise lente, normale ou naturelle.

La difficulte controle la longueur des phrases, le nombre de questions, le vocabulaire,
la vitesse du TTS et les indices. Le prompt systeme est construit au backend : le texte
ou la voix utilisateur sont des donnees utilisateur et ne peuvent pas remplacer ses
regles.

## Flux et contrat

La V1 est semi-duplex : l'IA termine de parler, l'utilisateur parle, le VAD detecte le
silence puis le tour est traite. Un bouton Terminer fournit un repli manuel.

Le frontend capture le micro avec `getUserMedia()` et Web Audio/AudioWorklet, puis
envoie des chunks au WebSocket. Le transport est normalise cote service STT (mono,
16 kHz, PCM ou format explicitement decode), sans dependre du codec implicite du
navigateur.

Deux transcriptions sont distinctes :

- `stt.partial` est instable, affichee en direct et jamais enregistree comme reponse ;
- `stt.final` est stabilisee, persistante et seule envoyee au LLM.

Evenements WebSocket : `audio.chunk`, `stt.partial`, `stt.final`, `turn.processing`,
`correction.ready`, `assistant.text`, `assistant.audio`, `turn.complete` et `error`.

Le LLM doit repondre en JSON, valide strictement par le backend. Le contrat contient au
minimum :

```ts
type ConversationModelOutput = {
  reply: { ja: string; reading: string };
  correction: {
    needed: boolean;
    severity: 'important' | 'minor';
    original: string;
    corrected: string;
    explanationFr: string;
  } | null;
  learning: {
    grammarIds: string[];
    vocabularyIds: string[];
    newItems: string[];
  };
  conversation: { shouldContinue: boolean; intent: string };
};
```

En cas de sortie invalide, l'API tente une reparation une seule fois, journalise le
probleme sans audio inutile et applique un fallback texte controle si la seconde sortie
est invalide.

## Architecture applicative prevue

La logique vit dans `ConversationOrchestrator`, pas dans les controleurs HTTP ou
WebSocket. Il compose `DifficultyPolicy`, `JlptConstraintService`, `PromptBuilder`,
`CorrectionPolicy`, les quatre providers, `SessionService` et `ProgressTracker`.

Les futures entites persistent au minimum :

- `ConversationSession` : utilisateur, niveau, scenario, difficulte, objectifs et
  dates ;
- `ConversationTurn` : transcript final, correction, reponse, donnees de contexte et
  dates ;
- `LearningEvent` : grammaire ou vocabulaire cible, resultat, type d'erreur et date.

Les audios ne sont pas conserves par defaut. Toute conservation future necessite un
choix explicite de l'utilisateur et une decision de provenance/vie privee.

Les routes prevues sous le prefixe existant `/api/v1` sont :

```text
POST   /conversations
GET    /conversations/:id
POST   /conversations/:id/end
GET    /conversation-topics
GET    /conversation-settings
GET    /voices/ja
GET    /local-ai/health
WS     /conversations/:id/live
```

## Resilience, securite et performance

- STT indisponible : micro desactive avec diagnostic, mode texte conserve.
- Ollama indisponible : transcript conserve, moteur conversationnel signale comme
  indisponible.
- VOICEVOX indisponible : reponse texte et nouvelle tentative audio proposee.
- Aucun audio ni transcript ne sort vers un service tiers par defaut.
- Les services IA ne sont pas exposes au LAN ; chunks et tours sont limites en taille
  et duree pour eviter l'accumulation memoire.
- Aucun tool calling LLM en V1.

La latence se pilote en gardant le modele en memoire, en limitant le contexte a un
resume et aux derniers tours, en utilisant le VAD, en repondant court et en profilant
separement STT, LLM et TTS. La cohabitation GPU de ces services doit etre benchmarkee :
STT CPU est un fallback et VOICEVOX peut passer sur CPU pour liberer la VRAM.

## Tests et criteres d'acceptation

Tests unitaires : politique de difficulte et correction, construction du prompt,
contraintes niveau/grammaire et validation du JSON LLM. Tests d'integration : fixture
audio japonaise vers STT, LLM mocke ou local, JSON valide et audio TTS non vide. Tests
E2E : scenario N5, transcription, correction, reponse, audio, fin de session et
progression. Le micro reel n'est pas requis pour chaque test E2E.

La V1 est livrable lorsque N5/N4, sujet et difficulte sont selectionnables ; les
transcriptions partielle/finale sont distinctes ; la reponse japonaise texte/audio et
les corrections francaises fonctionnent ; l'audio francais est configurable ;
l'historique et la progression sont sauvegardes ; le fallback texte et la page de
diagnostic sont disponibles ; aucun service cloud n'est obligatoire ; les tests
unitaires, integration et E2E nominaux passent.

## Decisions differees

Scoring de prononciation, pitch accent, full-duplex/barge-in, avatars, cache vocal,
choix automatique selon VRAM et execution distante facultative feront l'objet d'ADRs
ulterieures.

## References

- https://ollama.com/library/qwen3.5
- https://github.com/SYSTRAN/faster-whisper
- https://github.com/VOICEVOX/voicevox_engine
- https://docs.docker.com/desktop/features/gpu/
- https://modelcontextprotocol.io/

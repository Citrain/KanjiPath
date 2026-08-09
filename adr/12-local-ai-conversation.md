# ADR-003 - Conversation vocale japonaise locale

Reference complete :
[`ADR-003-conversation-vocale-japonais-locale.md`](../ADR-003-conversation-vocale-japonais-locale.md).

## Decision operationnelle

Le futur mode conversation est une fonctionnalite distincte des exercices fixes. Il
utilise une orchestration backend et des providers injectables : `SpeechToTextProvider`
(faster-whisper), `LLMProvider` (Ollama/Qwen), `JapaneseTTSProvider` (VOICEVOX) et
`FrenchTTSProvider` (local ou navigateur). Le frontend ne joint jamais ces services
directement.

Le backend garde la source de verite pedagogique : niveau, scenario, contraintes de
grammaire/vocabulaire/kanji, objectifs et politique de correction. La sortie LLM est un
JSON valide par schema, repare une fois puis remplacee par un fallback texte controle.

## Contraintes

- Services lies a `127.0.0.1`, sans cloud ni tool calling en V1.
- V1 semi-duplex, STT japonais avec transcription `partial` distincte du transcript
  final persiste.
- Mode texte maintenu si STT, LLM ou TTS est indisponible.
- Audios non conserves par defaut ; transcript et voix sont des donnees utilisateur.
- Les exercices et le pipeline de contenu restent sans LLM au runtime.

## Avant implementation

1. Lire ADR-003 et `docs/operations/local-ai.md`.
2. Ajouter les contrats API et migrations de sessions/tours/evenements de conversation.
3. Implementer dans l'ordre health check, LLM/provider, schema JSON, orchestrateur,
   mode texte, TTS, STT/WebSocket, interface, progression puis E2E.
4. Benchmarker STT, LLM et TTS separement et documenter toute dependance locale.

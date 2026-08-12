# IA locale pour la conversation vocale

Reference d'architecture :
[`ADR-003-conversation-vocale-japonais-locale.md`](../../ADR-003-conversation-vocale-japonais-locale.md).
Ce guide configure les services optionnels du mode conversation. Ils ne sont pas
obligatoires pour démarrer KanjiPath : le coeur web/API et MariaDB restent sans Docker,
et le mode texte reste disponible si l'IA locale est arrêtée.

## Architecture du poste

Configuration recommandee sous Windows avec GPU NVIDIA :

```text
Windows : pilote NVIDIA, Node.js, pnpm, Ollama
WSL2 + Docker Desktop : faster-whisper et VOICEVOX (GPU ou CPU)
KanjiPath : API, web, MariaDB locale
```

Docker est donc optionnel pour le projet courant et reserve aux services IA locaux
isoles. Ne pas l'introduire pour MariaDB ou le developpement standard.

## Prerequis

1. Mettre a jour le pilote NVIDIA puis verifier `nvidia-smi`.
2. Installer ou mettre a jour WSL2 : `wsl --install`, ou `wsl --update` et
   `wsl --status`.
3. Installer Docker Desktop avec le moteur WSL2. Verifier `docker version`.
4. Si les services doivent utiliser le GPU, verifier son exposition :

```powershell
docker run --rm --gpus all nvidia/cuda:12.3.2-base-ubuntu22.04 nvidia-smi
```

## Ollama et modele conversationnel

Installer Ollama pour Windows, puis recuperer le modele local recommande :

```powershell
ollama pull qwen3.5:9b-q8_0
ollama run qwen3.5:9b-q8_0
```

Ollama doit repondre sur `http://127.0.0.1:11434/api/tags`. Garder ce service sur
loopback ; il ne doit pas etre expose au reseau local.

Cette instance utilise `gemma4:26b` via `OLLAMA_MODEL` dans `.env`. Le test local opt-in du
prompt valide le dialogue multi-tour et une scène de restaurant avec ce modèle. Le provider reste
indépendant du modèle : toute substitution doit repasser cette évaluation avant utilisation.

## VOICEVOX (TTS japonais)

Le moteur expose son API sur `127.0.0.1:50021`. Exemple GPU :

```powershell
docker pull voicevox/voicevox_engine:nvidia-latest
docker run --rm --name voicevox-engine --gpus all -p 127.0.0.1:50021:50021 voicevox/voicevox_engine:nvidia-latest
```

Le tag `cpu-latest`, sans `--gpus all`, est le repli lorsque la VRAM est necessaire au
STT ou au LLM. Verifier le service avec :

```powershell
Invoke-RestMethod http://127.0.0.1:50021/version
Invoke-RestMethod http://127.0.0.1:50021/speakers
```

Sur Windows, l'installation CPU locale recommandée pour cette instance est :

```powershell
winget install --id HiroshibaKazuyuki.VOICEVOX.CPU --exact
```

VOICEVOX `0.25.2` est installé depuis le paquet Winget officiel
`HiroshibaKazuyuki.VOICEVOX.CPU`; Winget a vérifié le hash de l'installeur. La synthèse
reste sur CPU pour laisser la VRAM à Ollama et faster-whisper. Respecter la
[licence VOICEVOX](https://voicevox.hiroshiba.jp/term/). `dev.bat -Voice` détecte ensuite
l'installation Winget et démarre automatiquement `VOICEVOX.exe` si le port est libre.
Le sélecteur web affiche les noms de locuteurs romanisés et les styles traduits en français;
un style inconnu est affiché par son numéro, jamais uniquement en japonais.

Le choix de voix reste configurable : ne pas figer un identifiant de locuteur dans le
code metier.

## STT japonais (faster-whisper)

Le service fourni dans `services/stt/` est joint uniquement par l'API avec `GET /health`,
`POST /transcribe` et `WS /ws/transcribe` sur `127.0.0.1:8765`. Le POST reçoit
`{ audio, encoding: "pcm_s16le", sampleRate: 16000, language: "ja", vad: true }`, où
`audio` est en base64, et retourne `{ text }`. Le WebSocket renvoie des événements
`stt.partial` éphémères puis un unique `stt.final`; il utilise faster-whisper, langue
japonaise forcée, VAD activée et benchmarke initialement `large-v3-turbo`.

Construire et lancer le service CPU :

```powershell
docker build -t kanjipath-stt ./services/stt
docker run --rm --name kanjipath-stt -p 127.0.0.1:8765:8765 -e STT_DEVICE=cpu -e STT_COMPUTE_TYPE=int8 kanjipath-stt
```

Le WebSocket navigateur est `/api/v1/conversations/:id/live`, jamais le WebSocket du
service STT directement.

Sous Windows, `dev.bat -Voice` lit `STT_MODEL`, `STT_DEVICE` et
`STT_COMPUTE_TYPE` depuis `.env` lorsqu'il lance le service. Le réglage CPU portable
est `STT_DEVICE=cpu` et `STT_COMPUTE_TYPE=int8`. Pour une carte NVIDIA compatible CUDA,
utiliser `STT_DEVICE=cuda` et `STT_COMPUTE_TYPE=float16`. Avec une RTX 3090, ce dernier
profil réduit fortement la latence, à condition que CUDA 12 et cuDNN 9 soient installés et
accessibles au processus Python (`cublas64_12.dll` est requis); laisser une marge de VRAM
au modèle Ollama et à VOICEVOX. Les variables ne sont prises en compte qu'au démarrage du
STT.

Runtime GPU Windows installé pour cette instance, depuis les wheels NVIDIA PyPI dans le
venv STT : `nvidia-cuda-runtime-cu12==12.9.79`, `nvidia-cuda-nvrtc-cu12==12.9.86`,
`nvidia-cublas-cu12==12.9.2.10` et `nvidia-cudnn-cu12==9.24.0.43`. Respecter leurs
licences NVIDIA; ne pas redistribuer ces binaires dans le dépôt. Sous Python 3.8+, le
service enregistre chaque répertoire `nvidia/*/bin` avec `os.add_dll_directory` via
`STT_CUDA_LIBRARY_PATH`, car modifier uniquement `PATH` ne résout pas nécessairement les
dépendances des DLL.
Si le streaming WebSocket du STT se ferme, l'API soumet une seule fois le buffer du tour
actif à `POST /transcribe`; ce buffer reste exclusivement en mémoire et n'est jamais stocké.
Pendant l'enregistrement, `/conversation` affiche le niveau du microphone issu des
échantillons captés par le navigateur. Il permet de distinguer un micro silencieux d'un
problème STT, mais ne confirme ni la réception par l'API ni la reconnaissance de parole.
À l'arrêt de la prise vocale, ou dès l'envoi texte, le tour utilisateur et un indicateur
d'attente partenaire sont affichés de façon optimiste. Le formulaire reste désactivé jusqu'à
la réponse ou à une erreur afin d'éviter les tours concurrents.

Une demande conversationnelle en français telle que « réviser la forme 〜ている » devient un
objectif de dialogue : le partenaire doit employer la forme, corriger les essais et relancer
la conversation. Une réponse imparfaite ne doit jamais entraîner une formule d'abandon.
Un mot manquant, une forme incomplète ou une erreur qui empêche une phrase naturelle doit être
classée `important`, pour rester visible même lorsque l'utilisateur choisit les corrections
importantes seulement.
Le partenaire ne redemande pas une information déjà donnée et ne répète pas une question de
l'historique ou du tour courant. Une question n'est pas obligatoire à chaque tour : dans une
mise en scène, une politesse ou une instruction naturelle peut faire avancer le dialogue sans
interrogatoire. L'API rejette une réponse générique, une réplique déjà produite ou une question
déjà posée, puis demande une unique régénération. Si elle échoue encore, le tour reste
réessayable et rien n'est persisté : aucune phrase de fallback ne devient un faux message du
partenaire.
Chaque tour appelle le LLM avec l'historique complet de la session, sous forme de messages
`user` et `assistant` de l'API Ollama, plutôt que comme un JSON dans le prompt système. Une
réponse sans question reste valide si elle fait naturellement avancer la scène. Cette instance
utilise `OLLAMA_CONTEXT_LENGTH=32768` pour préserver cet historique; réduire cette
valeur peut faire perdre les tours les plus anciens si la conversation devient trop longue.
Chaque génération est en outre limitée à `OLLAMA_MAX_TOKENS=512` et
`OLLAMA_TIMEOUT_SECONDS=120`; un dépassement rend le tour réessayable au lieu de persister une
réponse artificielle.
Quand une entrée entièrement en romaji reçoit une sortie sans correction, l'API effectue aussi
une relecture locale dédiée aux erreurs de romaji, aux omissions et à la grammaire. La première
réponse est conservée si cette relecture ne détecte aucune erreur.
Le prompt conserve un exemple de contraste pour les réponses elliptiques : `genki desu ka` est
une question correcte, tandis que `ki desu` après `あなたは元気ですか？` est interprété comme
une tentative incomplète de `genki desu`. L'exemple guide le modèle sans remplacer la validation
Zod ni la relecture romaji applicative. Cette relecture utilise une instruction courte distincte
du prompt de dialogue et un mini-contrat interne (`needed`, `corrected`, `explanationFr`). L'API
valide ce mini-contrat puis l'applique a la reponse conversationnelle deja validee, pour que les
contraintes de scenario et de relance ne masquent pas une correction contextuelle.
Certains petits modèles renvoient une correction utile mais omettent `needed`, `severity` ou
`explanationFr` dans leur première réponse. Le backend normalise uniquement cette forme JSON
connue (`corrected` non vide), conserve les champs de dialogue validés et génère alors une
explication française minimale. Toute sortie résultante reste validée contre le contrat API Zod.
Une correction dont la reformulation est identique au transcript apres normalisation (espaces,
ponctuation, casse et NFKC) est supprimée : le web affiche alors l'état vert `Phrase correcte.`.
La reformulation affichée dans `A dire` est demandée en hiragana ou katakana, jamais en kanji,
afin qu'un débutant puisse la lire; les kanji restent réservés à la réplique du partenaire.
Le romaji n'est pas une erreur en soi: une correction n'est jamais affichée uniquement parce que
le partenaire retranscrit la même phrase en kana. Les écritures simplifiées des voyelles longues
et les emprunts tels que `menu` restent acceptés si la phrase est grammaticalement correcte.
Le contrat demandé au LLM contient uniquement la réplique, la correction et l'intention. Le
backend complète `learning` avec des tableaux vides : le modèle ne peut pas inventer un
identifiant de progression. Le prompt sépare explicitement l'interlocuteur japonais visible du
professeur discret, interdit le réflexe question-réponse-question et fournit des contraintes de
longueur concrètes par difficulté.

Avec `large-v3-turbo` sur CPU, la transcription finale dispose d'un délai de 60 secondes.
Une erreur `Délai STT dépassé` indique une machine trop lente ou une transcription bloquée,
pas nécessairement un service STT absent : vérifier d'abord `GET /health`.

Le conteneur doit figer ensemble CUDA, cuDNN et CTranslate2 dans un seul emplacement
de configuration. Ne pas dupliquer des versions CUDA entre Dockerfiles. Une image
CUDA 12 avec cuDNN 9 est le point de depart a verifier contre la version de
faster-whisper retenue. Le health check attendu indique le provider et le peripherique
utilise, par exemple `{"status":"ok","provider":"faster-whisper","device":"cuda"}`.

## TTS francais

`FRENCH_TTS_PROVIDER=browser` permet un prototypage sans service : sa disponibilite
hors ligne depend des voix installees sur le systeme. Une implementation locale peut
etre ajoutee sur `127.0.0.1:8766` derriere `FrenchTTSProvider`; aucun moteur concret ne
doit fuir dans le domaine metier.

## Configuration

Les variables suivantes sont documentées dans `.env.example`. Laisser
`LOCAL_AI_ENABLED=false` conserve le mode texte sans appeler un service local :

```dotenv
LOCAL_AI_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen3.5:9b-q8_0
OLLAMA_CONTEXT_LENGTH=32768
OLLAMA_MAX_TOKENS=512
OLLAMA_TIMEOUT_SECONDS=120
STT_BASE_URL=http://127.0.0.1:8765
STT_LANGUAGE=ja
STT_PROVIDER=faster-whisper
STT_VAD_ENABLED=true
STT_MODEL=large-v3-turbo
STT_DEVICE=cpu
STT_COMPUTE_TYPE=int8
VOICEVOX_BASE_URL=http://127.0.0.1:50021
VOICEVOX_SPEAKER_ID=1
VOICEVOX_DEFAULT_SPEED=1.0
FRENCH_TTS_PROVIDER=browser
FRENCH_TTS_BASE_URL=http://127.0.0.1:8766
CONVERSATION_DEFAULT_LEVEL=N5
CONVERSATION_DEFAULT_DIFFICULTY=easy
CONVERSATION_DEFAULT_CORRECTION_MODE=important
CONVERSATION_EXPLANATION_LANGUAGE=fr
CONVERSATION_MAX_TURN_SECONDS=60
```

## Demarrage et diagnostic

Ordre recommandé : STT, VOICEVOX, Ollama, puis KanjiPath. Sans Docker, `pnpm dev:voice`
prépare et lance le STT Python ainsi qu'Ollama; il ne démarre VOICEVOX que si son chemin
est fourni à `dev.bat -VoicevoxPath`. Vérifier les services :

```powershell
nvidia-smi
Invoke-RestMethod http://127.0.0.1:11434/api/tags
Invoke-RestMethod http://127.0.0.1:50021/version
Invoke-RestMethod http://127.0.0.1:8765/health
Get-NetTCPConnection -State Listen | Where-Object LocalPort -In 11434,50021,8765,8766
```

Pendant les essais GPU, surveiller `nvidia-smi -l 1`. Si la VRAM est insuffisante,
passer VOICEVOX sur CPU, reduire le modele STT, choisir une quantification LLM plus
legere ou reduire le contexte Ollama.

Après démarrage de KanjiPath, ouvrir `/conversation` puis contrôler le diagnostic
authentifié `GET /api/v1/local-ai/health`. Une réponse textuelle reste attendue si l'un
des services est arrêté. VOICEVOX ne conserve aucun audio : la réponse WAV est relayée
au navigateur pour lecture immédiate, sans stockage applicatif.

Pour un lancement récurrent sur Windows sans Docker, `pnpm dev:voice` prépare puis lance
Ollama, le STT Python et KanjiPath. Ajouter `-VoicevoxPath` à `dev.bat` si VOICEVOX n'est
pas déjà démarré. Le lancement standard (`pnpm dev` ou `dev.bat`) ne démarre jamais ces
services.

Le premier tour avec un grand modèle peut prendre plusieurs minutes sur CPU. L'API attend par
défaut 120 secondes (`OLLAMA_TIMEOUT_SECONDS`) et conserve ensuite le modèle dix minutes dans
Ollama pour éviter ce coût à chaque tour. Augmenter explicitement ce délai pour une exécution CPU
plus lente.

Si un tour reste bloqué alors que `ollama ps` montre le modèle chargé, annuler uniquement
le modèle configuré avec `ollama stop <modèle>`, puis renvoyer le message. Le backend demande le
mode JSON natif d'Ollama et valide la structure ensuite : ne pas remplacer ce mode par un
schéma JSON de décodage complexe, qui peut bloquer Qwen 14B.

## Regles de securite

- Lier tous les services IA a `127.0.0.1`, sauf besoin explicite documente.
- Ne jamais envoyer audio ou transcript a un service tiers par defaut.
- Ne pas mettre de secret ou d'URL distante dans `.env.example` ou la documentation.
- Les MCP sont des outils de developpement, jamais une dependance runtime.
- Limiter un MCP filesystem au depot et utiliser un navigateur isole pour Playwright.

## MCP de developpement (optionnel)

Un MCP filesystem borne au depot et Playwright en profil isole suffisent en general.
Ne pas ajouter de MCP Git, GitHub ou base de donnees sans besoin concret. La
configuration OpenCode appartient a la configuration utilisateur, pas au runtime ni aux
fichiers de configuration applicatifs de KanjiPath.

# Service STT local

Le conteneur faster-whisper expose `GET /health`, `POST /transcribe` et
`WS /ws/transcribe`. Il n'est publié sur l'hôte que via `127.0.0.1:8765`.

```powershell
docker build -t kanjipath-stt ./services/stt
docker run --rm --name kanjipath-stt -p 127.0.0.1:8765:8765 -e STT_DEVICE=cpu -e STT_COMPUTE_TYPE=int8 kanjipath-stt
```

Pour un GPU NVIDIA, construire la même image puis ajouter `--gpus all`, définir
`STT_DEVICE=cuda` et choisir un `STT_COMPUTE_TYPE` compatible avec la machine.
Sur Windows sans Docker, CTranslate2 4.8 requiert cuBLAS CUDA 12, CUDA Runtime/NVRTC et
cuDNN 9. Les wheels NVIDIA correspondantes sont installées dans le venv STT;
`dev.ps1` ajoute leurs répertoires `nvidia/*/bin` au processus STT. Consigner les versions
installées dans `docs/operations/local-ai.md` avant d'activer `STT_DEVICE=cuda`.
L'API KanjiPath est le seul client du WebSocket STT : le navigateur utilise
`/api/v1/conversations/:id/live`.

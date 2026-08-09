import asyncio
import base64
import os

import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect

_cuda_dll_directories = []
if os.name == "nt" and (cuda_library_paths := os.getenv("STT_CUDA_LIBRARY_PATH")):
    _cuda_dll_directories = [
        os.add_dll_directory(path)
        for path in cuda_library_paths.split(os.pathsep)
        if path
    ]

from faster_whisper import WhisperModel

MODEL_NAME = os.getenv("STT_MODEL", "large-v3-turbo")
DEVICE = os.getenv("STT_DEVICE", "cpu")
COMPUTE_TYPE = os.getenv("STT_COMPUTE_TYPE", "int8")
PARTIAL_INTERVAL_BYTES = 32_000

app = FastAPI()
model = WhisperModel(MODEL_NAME, device=DEVICE, compute_type=COMPUTE_TYPE)


def transcribe(pcm: bytes) -> str:
    if not pcm:
        return ""
    samples = np.frombuffer(pcm, dtype="<i2").astype(np.float32) / 32768.0
    segments, _ = model.transcribe(samples, language="ja", vad_filter=True)
    return "".join(segment.text for segment in segments).strip()


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok", "provider": "faster-whisper", "device": DEVICE}


@app.post("/transcribe")
def transcribe_http(payload: dict[str, object]) -> dict[str, str]:
    audio = payload.get("audio")
    if not isinstance(audio, str) or payload.get("encoding") != "pcm_s16le":
        return {"text": ""}
    return {"text": transcribe(base64.b64decode(audio, validate=True))}


@app.websocket("/ws/transcribe")
async def transcribe_websocket(websocket: WebSocket) -> None:
    await websocket.accept()
    chunks = bytearray()
    partial_at = PARTIAL_INTERVAL_BYTES
    try:
        while True:
            message = await websocket.receive_json()
            message_type = message.get("type")
            if message_type == "start":
                valid = (
                    message.get("encoding") == "pcm_s16le"
                    and message.get("sampleRate") == 16000
                    and message.get("language") == "ja"
                )
                if not valid:
                    await websocket.close(code=1003)
                    return
            elif message_type == "audio.chunk":
                audio = message.get("data")
                if not isinstance(audio, str):
                    continue
                chunks.extend(base64.b64decode(audio, validate=True))
                if len(chunks) >= partial_at:
                    partial_at += PARTIAL_INTERVAL_BYTES
                    partial = await asyncio.to_thread(transcribe, bytes(chunks))
                    await websocket.send_json({"type": "stt.partial", "transcript": partial})
            elif message_type == "turn.complete":
                final = await asyncio.to_thread(transcribe, bytes(chunks))
                await websocket.send_json({"type": "stt.final", "transcript": final})
                return
    except (WebSocketDisconnect, ValueError):
        return

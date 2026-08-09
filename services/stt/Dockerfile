FROM nvidia/cuda:12.8.1-cudnn-runtime-ubuntu24.04

ENV DEBIAN_FRONTEND=noninteractive \
    STT_MODEL=large-v3-turbo \
    STT_DEVICE=cpu \
    STT_COMPUTE_TYPE=int8

RUN apt-get update && apt-get install -y --no-install-recommends python3 python3-pip && rm -rf /var/lib/apt/lists/*
COPY requirements.txt /tmp/requirements.txt
RUN python3 -m pip install --break-system-packages --no-cache-dir -r /tmp/requirements.txt
COPY app.py /app/app.py

EXPOSE 8765
CMD ["python3", "-m", "uvicorn", "app:app", "--app-dir", "/app", "--host", "0.0.0.0", "--port", "8765"]

export function microphoneInputLevel(samples: Float32Array): number {
  if (samples.length === 0) return 0;
  let total = 0;
  for (const sample of samples) total += sample * sample;
  return Math.min(1, Math.sqrt(total / samples.length) * 8);
}

export function downsampleToPcm16(
  input: Float32Array,
  sourceRate: number,
  targetRate: number,
): Int16Array {
  const ratio = sourceRate / targetRate;
  const output = new Int16Array(Math.round(input.length / ratio));
  for (let index = 0; index < output.length; index += 1) {
    const sample = input[Math.floor(index * ratio)] ?? 0;
    output[index] = Math.max(-1, Math.min(1, sample)) * 0x7fff;
  }
  return output;
}

export function pcmToBase64(samples: Int16Array): string {
  const bytes = new Uint8Array(samples.buffer);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

export function playBase64Audio(mimeType: string, base64: string): void {
  const audio = new Audio(`data:${mimeType};base64,${base64}`);
  void audio.play().catch(() => undefined);
}

export interface ShadowingRecording {
  base64: string;
  durationMs: number;
}

export interface MemoryRecorderHandle {
  stop(): ShadowingRecording | null;
  cancel(): void;
}

export async function startMemoryRecorder(options: {
  maxDurationMs: number;
  onLevel: (level: number) => void;
  onLimitReached: () => void;
}): Promise<MemoryRecorderHandle> {
  const stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 } });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const chunks: Int16Array[] = [];
  let totalSamples = 0;
  let closed = false;
  let limitNotified = false;

  function release(): void {
    if (closed) return;
    closed = true;
    processor.disconnect();
    source.disconnect();
    stream.getTracks().forEach((track) => {
      track.stop();
    });
    void context.close();
  }

  processor.onaudioprocess = (event) => {
    if (closed) return;
    const samples = event.inputBuffer.getChannelData(0);
    options.onLevel(microphoneInputLevel(samples));
    const pcm = downsampleToPcm16(samples, context.sampleRate, 16_000);
    chunks.push(pcm);
    totalSamples += pcm.length;
    if (totalSamples / 16 >= options.maxDurationMs && !limitNotified) {
      limitNotified = true;
      release();
      options.onLimitReached();
    }
  };
  source.connect(processor);
  processor.connect(context.destination);

  return {
    stop(): ShadowingRecording | null {
      release();
      if (totalSamples === 0) return null;
      const merged = new Int16Array(totalSamples);
      let offset = 0;
      for (const chunk of chunks) {
        merged.set(chunk, offset);
        offset += chunk.length;
      }
      chunks.length = 0;
      return { base64: pcmToBase64(merged), durationMs: Math.round(totalSamples / 16) };
    },
    cancel() {
      chunks.length = 0;
      totalSamples = 0;
      release();
    },
  };
}

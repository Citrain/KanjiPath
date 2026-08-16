import type {
  JapaneseSpeechSpeed,
  JlptLevel,
  ShadowingComparisonResponse,
  ShadowingResultDto,
  ShadowingResultsResponse,
  ShadowingSaveResultRequest,
  ShadowingSource,
  ShadowingTargetsResponse,
  ShadowingTranscribeResponse,
  ShadowingTtsAudioResponse,
} from '@kanjipath/contracts';
import { apiFetch } from '../../lib/api';

export function fetchShadowingTargets(options: {
  level: JlptLevel;
  source: ShadowingSource;
}): Promise<ShadowingTargetsResponse> {
  return apiFetch(`/shadowing/targets?level=${options.level}&source=${options.source}`);
}

export function fetchShadowingTtsAudio(
  sentenceId: string,
  speed: JapaneseSpeechSpeed,
): Promise<ShadowingTtsAudioResponse> {
  return apiFetch(`/shadowing/targets/${sentenceId}/tts?speed=${speed}`);
}

export function transcribeShadowing(payload: {
  audioBase64: string;
  durationMs: number;
}): Promise<ShadowingTranscribeResponse> {
  return apiFetch('/shadowing/transcribe', {
    method: 'POST',
    body: JSON.stringify({
      audioBase64: payload.audioBase64,
      encoding: 'pcm_s16le',
      sampleRate: 16_000,
      durationMs: payload.durationMs,
    }),
  });
}

export function compareShadowing(payload: {
  sentenceId: string;
  transcript: string;
}): Promise<ShadowingComparisonResponse> {
  return apiFetch('/shadowing/compare', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function saveShadowingResult(
  payload: ShadowingSaveResultRequest,
): Promise<ShadowingResultDto> {
  return apiFetch('/shadowing/results', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function fetchShadowingResults(): Promise<ShadowingResultsResponse> {
  return apiFetch('/shadowing/results');
}

export function deleteShadowingResult(id: string): Promise<void> {
  return apiFetch(`/shadowing/results/${id}`, { method: 'DELETE' });
}

export function clearShadowingResults(): Promise<void> {
  return apiFetch('/shadowing/results', { method: 'DELETE' });
}

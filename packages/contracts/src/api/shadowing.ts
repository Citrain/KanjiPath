import type { JapaneseSpeechSpeed, JlptLevel, ShadowingSource } from '../enums';
import type { SentenceTokenDto } from './kanji';

export interface ShadowingTargetAudioDto {
  url: string;
  attribution: string;
  license: string;
}

export interface ShadowingTargetDto {
  id: string;
  japanese: string;
  reading: string;
  translationFr: string;
  level: JlptLevel;
  author: string | null;
  sentenceLicense: string | null;
  audio: ShadowingTargetAudioDto | null;
  tokens: SentenceTokenDto[];
}

export interface ShadowingTargetsResponse {
  level: JlptLevel;
  source: ShadowingSource;
  targets: ShadowingTargetDto[];
}

export interface ShadowingTranscribeResponse {
  transcript: string;
}

export interface ShadowingTtsAudioResponse {
  mimeType: string;
  base64: string;
}

export type ShadowingSegmentStatus = 'matched' | 'differs';

export interface ShadowingComparisonSegment {
  surface: string;
  reading: string;
  romaji: string | null;
  status: ShadowingSegmentStatus;
}

export interface ShadowingComparisonResponse {
  sentenceId: string;
  transcript: string;
  targetReading: string;
  matched: boolean;
  segments: ShadowingComparisonSegment[];
}

export interface ShadowingSaveResultRequest {
  sentenceId: string;
  source: ShadowingSource;
  transcript: string;
}

export interface ShadowingResultDto {
  id: string;
  sentenceId: string | null;
  source: ShadowingSource;
  japanese: string;
  reading: string;
  translationFr: string | null;
  transcript: string;
  matched: boolean;
  matchedSegments: number;
  totalSegments: number;
  attribution: string | null;
  license: string | null;
  createdAt: string;
}

export interface ShadowingResultsResponse {
  results: ShadowingResultDto[];
}

export interface ShadowingTtsAudioQuery {
  speed?: JapaneseSpeechSpeed;
}

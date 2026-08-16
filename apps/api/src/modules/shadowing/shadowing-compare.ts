export interface ShadowingTargetToken {
  surface: string;
  reading: string | null;
  romaji: string | null;
}

export interface ShadowingSegmentResult {
  surface: string;
  reading: string;
  romaji: string | null;
  status: 'matched' | 'differs';
}

export interface ShadowingComparison {
  normalizedTranscript: string;
  targetReading: string;
  matched: boolean;
  segments: ShadowingSegmentResult[];
}

const INVISIBLE_CHARACTERS = /[\u200B-\u200D\u2060\uFEFF]/g;
const STRIPPED_CHARACTERS =
  /[\s\u3000。、．，,.!！?？…‥・:;：；()（）[\]【】「」『』〈〉《》""''‘’―—−\-ー〜~]/g;

export function normalizeShadowingKana(value: string): string {
  let result = value.normalize('NFKC').replace(INVISIBLE_CHARACTERS, '');
  result = result.replace(STRIPPED_CHARACTERS, '');
  result = result.replace(/[ァ-ヺ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
  return result.toLowerCase();
}

export function resolveTranscriptReadings(
  transcript: string,
  tokens: readonly ShadowingTargetToken[],
): string {
  const normalized = normalizeShadowingKana(transcript);
  const substitutions = tokens
    .map((token) => ({
      surface: normalizeShadowingKana(token.surface),
      reading: normalizeShadowingKana(token.reading ?? ''),
    }))
    .filter((entry) => entry.surface.length > 0 && entry.reading.length > 0)
    .sort((a, b) => b.surface.length - a.surface.length || a.surface.localeCompare(b.surface));
  let resolved = '';
  let position = 0;
  while (position < normalized.length) {
    const hit = substitutions.find((entry) => normalized.startsWith(entry.surface, position));
    if (hit) {
      resolved += hit.reading;
      position += hit.surface.length;
    } else {
      resolved += normalized[position];
      position += 1;
    }
  }
  return resolved;
}

export function compareShadowingTranscript(
  tokens: readonly ShadowingTargetToken[],
  transcript: string,
): ShadowingComparison {
  const segments: ShadowingSegmentResult[] = tokens
    .filter((token) => normalizeShadowingKana(token.reading ?? '').length > 0)
    .map((token) => ({
      surface: token.surface,
      reading: normalizeShadowingKana(token.reading ?? ''),
      romaji: token.romaji,
      status: 'differs' as const,
    }));
  const targetReading = segments.map((segment) => segment.reading).join('');
  const normalizedTranscript = resolveTranscriptReadings(transcript, tokens);
  if (normalizedTranscript.length === 0 || targetReading.length === 0) {
    return { normalizedTranscript, targetReading, matched: false, segments };
  }
  if (normalizedTranscript === targetReading) {
    return {
      normalizedTranscript,
      targetReading,
      matched: true,
      segments: segments.map((segment) => ({ ...segment, status: 'matched' as const })),
    };
  }
  let cursor = 0;
  for (const segment of segments) {
    const index = normalizedTranscript.indexOf(segment.reading, cursor);
    if (index >= 0) {
      segment.status = 'matched';
      cursor = index + segment.reading.length;
    }
  }
  return { normalizedTranscript, targetReading, matched: false, segments };
}

export function shadowingReadingOf(tokens: readonly ShadowingTargetToken[]): string {
  return tokens.map((token) => token.reading ?? token.surface).join('');
}

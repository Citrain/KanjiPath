import type { MiniTextTokenDto } from '@kanjipath/contracts';

export function groupTextTokens<T extends Pick<MiniTextTokenDto, 'surface'>>(tokens: T[]): T[][] {
  const sentences: T[][] = [];
  let current: T[] = [];
  for (const token of tokens) {
    current.push(token);
    if (token.surface.endsWith('。')) {
      sentences.push(current);
      current = [];
    }
  }
  if (current.length > 0) {
    sentences.push(current);
  }
  return sentences;
}

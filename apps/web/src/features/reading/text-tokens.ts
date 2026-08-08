import type { MiniTextTokenDto } from '@kanjipath/contracts';

export function groupTextTokens(tokens: MiniTextTokenDto[]): MiniTextTokenDto[][] {
  const sentences: MiniTextTokenDto[][] = [];
  let current: MiniTextTokenDto[] = [];
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

import { describe, expect, it } from 'vitest';
import { groupTextTokens } from './text-tokens';

describe('groupTextTokens', () => {
  it('découpe après chaque 。', () => {
    const tokens = [
      { surface: '今日は', reading: 'きょうは', romaji: 'kyō wa' },
      { surface: '晴れ', reading: 'はれ', romaji: 'hare' },
      { surface: 'です', reading: null, romaji: null },
      { surface: '。', reading: null, romaji: null },
      { surface: '明日', reading: 'あした', romaji: 'ashita' },
      { surface: 'は', reading: null, romaji: null },
      { surface: '雨', reading: 'あめ', romaji: 'ame' },
      { surface: '。', reading: null, romaji: null },
    ];
    const groups = groupTextTokens(tokens);
    expect(groups).toHaveLength(2);
    expect(groups[0]?.map((token) => token.surface).join('')).toBe('今日は晴れです。');
    expect(groups[1]?.map((token) => token.surface).join('')).toBe('明日は雨。');
  });

  it('conserve un reste sans ponctuation finale', () => {
    const tokens = [{ surface: '読書', reading: 'どくしょ', romaji: 'dokusho' }];
    const groups = groupTextTokens(tokens);
    expect(groups).toHaveLength(1);
    expect(groups[0]).toHaveLength(1);
  });

  it('renvoie un tableau vide pour un texte vide', () => {
    expect(groupTextTokens([])).toEqual([]);
  });
});

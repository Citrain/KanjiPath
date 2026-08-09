import { describe, expect, it } from 'vitest';
import { annotateSentence } from '../lib/tokenize.mjs';

describe('annotateSentence', () => {
  it('fusionne un mois numérique avec sa lecture contextuelle', () => {
    const tokenizer = {
      tokenize: () => [
        { surface_form: '娘', word_position: 1, reading: 'ムスメ' },
        { surface_form: 'が', word_position: 2, pronunciation: 'ガ' },
        { surface_form: '6', word_position: 3 },
        { surface_form: '月', word_position: 4, reading: 'ツキ' },
      ],
    };

    expect(annotateSentence(tokenizer, '娘が6月')).toEqual([
      { surface: '娘', reading: 'むすめ', romaji: 'musume', startOffset: 0, endOffset: 1 },
      { surface: 'が', reading: 'が', romaji: 'ga', startOffset: 1, endOffset: 2 },
      { surface: '6月', reading: 'ろくがつ', romaji: 'rokugatsu', startOffset: 2, endOffset: 4 },
    ]);
  });
});

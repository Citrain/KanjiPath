import { describe, expect, it } from 'vitest';
import {
  compareShadowingTranscript,
  normalizeShadowingKana,
  resolveTranscriptReadings,
  type ShadowingTargetToken,
  shadowingReadingOf,
} from './shadowing-compare';

function token(surface: string, reading: string | null, romaji: string | null = null) {
  return { surface, reading, romaji } satisfies ShadowingTargetToken;
}

const WATASHI_TOKENS = [
  token('わたし', 'わたし', 'watashi'),
  token('は', 'は', 'wa'),
  token('学生', 'がくせい', 'gakusei'),
  token('です', 'です', 'desu'),
];

describe('normalizeShadowingKana', () => {
  it('convertit katakana en hiragana et retire espaces, ponctuation et marques longues', () => {
    expect(normalizeShadowingKana('ガクセイ　です。')).toBe('がくせいです');
    expect(normalizeShadowingKana('こんにちは、世界！')).toBe('こんにちは世界');
    expect(normalizeShadowingKana('コーヒー〜')).toBe('こひ');
  });

  it('est déterministe et insensible à la casse latine', () => {
    const input = 'Ｏｈａｙｏ!';
    expect(normalizeShadowingKana(input)).toBe(normalizeShadowingKana(input));
    expect(normalizeShadowingKana('OHAYO')).toBe('ohayo');
  });
});

describe('compareShadowingTranscript', () => {
  it('déclare une correspondance exacte sans note ni verdict', () => {
    const result = compareShadowingTranscript(WATASHI_TOKENS, 'わたしはがくせいです');
    expect(result.matched).toBe(true);
    expect(result.targetReading).toBe('わたしはがくせいです');
    expect(result.segments.every((segment) => segment.status === 'matched')).toBe(true);
    expect(Object.keys(result)).toEqual([
      'normalizedTranscript',
      'targetReading',
      'matched',
      'segments',
    ]);
  });

  it('tolère espaces, ponctuation et variantes katakana documentées', () => {
    const spaced = compareShadowingTranscript(WATASHI_TOKENS, 'わたしは がくせい です。');
    expect(spaced.matched).toBe(true);
    const katakana = compareShadowingTranscript(WATASHI_TOKENS, 'ワタシハ ガクセイ デス');
    expect(katakana.matched).toBe(true);
  });

  it('résout les kanji du transcript avec les lectures des tokens de la cible', () => {
    const kanjiTokens = [
      token('私', 'わたし', 'watashi'),
      token('は', 'は', 'wa'),
      token('学生', 'がくせい', 'gakusei'),
      token('です', 'です', 'desu'),
    ];
    const result = compareShadowingTranscript(kanjiTokens, '私は学生です');
    expect(result.matched).toBe(true);
    expect(result.normalizedTranscript).toBe('わたしはがくせいです');
    const mixed = compareShadowingTranscript(kanjiTokens, 'わたしは学生です');
    expect(mixed.matched).toBe(true);
  });

  it('signale les segments absents sans produire de score', () => {
    const result = compareShadowingTranscript(WATASHI_TOKENS, 'わたしはです');
    expect(result.matched).toBe(false);
    const statuses = result.segments.map((segment) => [segment.surface, segment.status]);
    expect(statuses).toEqual([
      ['わたし', 'matched'],
      ['は', 'matched'],
      ['学生', 'differs'],
      ['です', 'matched'],
    ]);
    for (const segment of result.segments) {
      expect(Object.keys(segment)).toEqual(['surface', 'reading', 'romaji', 'status']);
    }
  });

  it('aligne dans l ordre des segments répétés', () => {
    const tokens = [token('山', 'やま'), token('と', 'と'), token('山', 'やま')];
    const result = compareShadowingTranscript(tokens, 'やまとやま');
    expect(result.matched).toBe(true);
    const partial = compareShadowingTranscript(tokens, 'やま');
    expect(partial.matched).toBe(false);
    expect(partial.segments.map((segment) => segment.status)).toEqual([
      'matched',
      'differs',
      'differs',
    ]);
  });

  it('ne produit aucun résultat pour un transcript vide', () => {
    const result = compareShadowingTranscript(WATASHI_TOKENS, '   。');
    expect(result.matched).toBe(false);
    expect(result.normalizedTranscript).toBe('');
    expect(result.segments.every((segment) => segment.status === 'differs')).toBe(true);
  });

  it('reste strictement déterministe pour une même entrée', () => {
    const transcript = 'ワタシワ がくせい です';
    const first = JSON.stringify(compareShadowingTranscript(WATASHI_TOKENS, transcript));
    for (let index = 0; index < 5; index += 1) {
      expect(JSON.stringify(compareShadowingTranscript(WATASHI_TOKENS, transcript))).toBe(first);
    }
  });
});

describe('resolveTranscriptReadings', () => {
  it('préfère la plus longue surface correspondante', () => {
    const tokens = [token('東京', 'とうきょう'), token('東', 'ひがし')];
    expect(resolveTranscriptReadings('東京', tokens)).toBe('とうきょう');
  });

  it('ignore les tokens sans lecture', () => {
    const tokens = [token('…', null), token('はい', 'はい')];
    expect(resolveTranscriptReadings('はい', tokens)).toBe('はい');
  });
});

describe('shadowingReadingOf', () => {
  it('concatène les lectures et replie sur la surface sans lecture', () => {
    expect(shadowingReadingOf([token('猫', 'ねこ'), token('！', null)])).toBe('ねこ！');
  });
});

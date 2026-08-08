import { describe, expect, it } from 'vitest';
import { isAdvancedReadingWord, regularizedReadingVariants } from '../lib/generators.mjs';

const vocab = (writtenForm, reading, kanjiCount) => ({
  writtenForm,
  reading,
  kanji: Array.from({ length: kanjiCount }, (_, i) => ({ kanjiId: `k-${i}`, position: i })),
});

describe('isAdvancedReadingWord', () => {
  it('détecte le rendaku (kana sonorisé en position non initiale)', () => {
    expect(isAdvancedReadingWord(vocab('手紙', 'てがみ', 2))).toBe(true);
    expect(isAdvancedReadingWord(vocab('折り紙', 'おりがみ', 3))).toBe(true);
  });

  it('détecte le sokuon', () => {
    expect(isAdvancedReadingWord(vocab('切手', 'きって', 2))).toBe(true);
  });

  it('accepte une lecture on sonorisée (piège classique pour apprenant)', () => {
    expect(isAdvancedReadingWord(vocab('大学', 'だいがく', 2))).toBe(true);
  });

  it('rejette une lecture sans kana sonorisé ni sokuon', () => {
    expect(isAdvancedReadingWord(vocab('電話', 'でんわ', 2))).toBe(false);
  });

  it('rejette les mots avec moins de deux kanji liés', () => {
    expect(isAdvancedReadingWord(vocab('食べる', 'たべる', 1))).toBe(false);
  });

  it('rejette les lectures trop courtes', () => {
    expect(isAdvancedReadingWord(vocab('XX', 'てが', 2))).toBe(false);
  });
});

describe('regularizedReadingVariants', () => {
  it('produit une variante dé-sonorisée pour un rendaku', () => {
    expect(regularizedReadingVariants('てがみ')).toContain('てかみ');
  });

  it('produit une variante sans sokuon', () => {
    expect(regularizedReadingVariants('きって')).toContain('きて');
  });

  it('ne touche pas la syllabe initiale (le rendaku est toujours non initial)', () => {
    const variants = regularizedReadingVariants('だいがく');
    expect(variants).toContain('だいかく');
    expect(variants).not.toContain('たいかく');
  });

  it('renvoie un tableau vide pour une lecture régulière', () => {
    expect(regularizedReadingVariants('でんわ')).toEqual([]);
  });
});

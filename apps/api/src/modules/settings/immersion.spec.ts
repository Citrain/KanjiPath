import { describe, expect, it } from 'vitest';
import {
  IMMERSION_MIN_DISCOVERED,
  IMMERSION_MIN_DISCOVERED_FOR_TOTAL,
  recommendImmersionHelp,
} from './immersion';

describe('recommendImmersionHelp', () => {
  it("recommande l'affichage complet pour un débutant sans kanji découvert", () => {
    const result = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: 0,
      masteredKanji: 0,
    });
    expect(result.level).toBe(0);
    expect(result.reasons.length).toBeGreaterThan(0);
    expect(result.reasons.join(' ')).toContain('affichage complet');
  });

  it("garde l'affichage complet sous le seuil de kanji découverts", () => {
    const result = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: IMMERSION_MIN_DISCOVERED - 1,
      masteredKanji: IMMERSION_MIN_DISCOVERED - 1,
    });
    expect(result.level).toBe(0);
    expect(result.reasons.join(' ')).toContain('affichage complet');
  });

  it('monte progressivement avec la part de kanji maîtrisés', () => {
    const level1 = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: 20,
      masteredKanji: 5,
    });
    expect(level1.level).toBe(1);

    const level2 = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: 20,
      masteredKanji: 12,
    });
    expect(level2.level).toBe(2);

    const level3 = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: 40,
      masteredKanji: 36,
    });
    expect(level3.level).toBe(3);
  });

  it("réserve l'immersion totale aux parcours suffisamment avancés", () => {
    const result = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'always',
      discoveredKanji: IMMERSION_MIN_DISCOVERED_FOR_TOTAL - 5,
      masteredKanji: IMMERSION_MIN_DISCOVERED_FOR_TOTAL - 5,
    });
    expect(result.level).toBe(2);
    expect(result.reasons.join(' ')).toContain('Immersion totale');
  });

  it('respecte la préférence romaji désactivé comme plancher', () => {
    const result = recommendImmersionHelp({
      romajiEnabled: false,
      furiganaMode: 'always',
      discoveredKanji: 20,
      masteredKanji: 1,
    });
    expect(result.level).toBe(2);
    expect(result.reasons.join(' ')).toContain('Romaji');
  });

  it('respecte la préférence furigana jamais comme plancher', () => {
    const result = recommendImmersionHelp({
      romajiEnabled: true,
      furiganaMode: 'never',
      discoveredKanji: 12,
      masteredKanji: 0,
    });
    expect(result.level).toBe(3);
    expect(result.reasons.join(' ')).toContain('Furigana');
  });

  it('borne la recommandation entre 0 et 3 et fournit toujours une explication', () => {
    const cases = [
      { discoveredKanji: 0, masteredKanji: 0 },
      { discoveredKanji: 3, masteredKanji: 9 },
      { discoveredKanji: 500, masteredKanji: 500 },
      { discoveredKanji: -4, masteredKanji: 2 },
    ];
    for (const sample of cases) {
      const result = recommendImmersionHelp({
        romajiEnabled: true,
        furiganaMode: 'always',
        ...sample,
      });
      expect(result.level).toBeGreaterThanOrEqual(0);
      expect(result.level).toBeLessThanOrEqual(3);
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });
});

import { describe, expect, it } from 'vitest';
import {
  displayWithImmersion,
  effectiveHiddenAids,
  hiddenAidsForLevel,
  IMMERSION_AID_LABELS,
  IMMERSION_HELP_LEVELS,
  IMMERSION_LEVEL_DESCRIPTIONS,
  IMMERSION_LEVEL_LABELS,
  resolveImmersionLevel,
} from './immersion';

describe('hiddenAidsForLevel', () => {
  it('ne masque aucune aide au niveau affichage complet', () => {
    expect(hiddenAidsForLevel(0)).toEqual([]);
  });

  it('masque des aides cumulatives selon le niveau', () => {
    expect(hiddenAidsForLevel(1)).toEqual(['translation']);
    expect(hiddenAidsForLevel(2)).toEqual(['translation', 'romaji']);
    expect(hiddenAidsForLevel(3)).toEqual(['translation', 'romaji', 'furigana']);
  });
});

describe('effectiveHiddenAids', () => {
  it('ne masque rien quand le mode est désactivé, même à un niveau élevé', () => {
    expect(effectiveHiddenAids({ enabled: false, level: 3, revealed: new Set() })).toEqual([]);
  });

  it('retire les aides déjà révélées localement', () => {
    expect(effectiveHiddenAids({ enabled: true, level: 3, revealed: new Set(['romaji']) })).toEqual(
      ['translation', 'furigana'],
    );
    expect(
      effectiveHiddenAids({
        enabled: true,
        level: 3,
        revealed: new Set(['translation', 'romaji', 'furigana']),
      }),
    ).toEqual([]);
  });
});

describe('resolveImmersionLevel', () => {
  it('priorise le choix de séance, puis le choix enregistré, puis la recommandation', () => {
    expect(resolveImmersionLevel({ overrideLevel: 0, savedLevel: 3, recommendedLevel: 2 })).toBe(0);
    expect(resolveImmersionLevel({ overrideLevel: null, savedLevel: 1, recommendedLevel: 2 })).toBe(
      1,
    );
    expect(
      resolveImmersionLevel({ overrideLevel: null, savedLevel: null, recommendedLevel: 2 }),
    ).toBe(2);
  });

  it("un débutant revient immédiatement à l'affichage complet", () => {
    expect(resolveImmersionLevel({ overrideLevel: 0, savedLevel: null, recommendedLevel: 3 })).toBe(
      0,
    );
  });
});

describe('displayWithImmersion', () => {
  it("applique le mode d'affichage existant quand aucune aide n'est masquée", () => {
    expect(
      displayWithImmersion({ furiganaMode: 'always', romajiEnabled: true, hiddenAids: [] }),
    ).toEqual({ furiganaMode: 'always', romajiVisible: true });
  });

  it('ne force jamais le romaji caché au-delà des préférences fines', () => {
    expect(
      displayWithImmersion({ furiganaMode: 'always', romajiEnabled: false, hiddenAids: [] }),
    ).toEqual({ furiganaMode: 'always', romajiVisible: false });
    expect(
      displayWithImmersion({
        furiganaMode: 'always',
        romajiEnabled: false,
        hiddenAids: ['romaji'],
      }),
    ).toEqual({ furiganaMode: 'always', romajiVisible: false });
  });

  it('masque furigana et romaji quand le niveau les cache', () => {
    expect(
      displayWithImmersion({
        furiganaMode: 'always',
        romajiEnabled: true,
        hiddenAids: ['translation', 'romaji', 'furigana'],
      }),
    ).toEqual({ furiganaMode: 'never', romajiVisible: false });
  });

  it("ne remplace pas le réglage fin furigana quand l'immersion ne le masque pas", () => {
    expect(
      displayWithImmersion({
        furiganaMode: 'hover',
        romajiEnabled: true,
        hiddenAids: ['translation'],
      }),
    ).toEqual({ furiganaMode: 'hover', romajiVisible: true });
  });
});

describe('libellés du mode immersion', () => {
  it('chaque niveau possède un libellé et une description explicites', () => {
    for (const level of IMMERSION_HELP_LEVELS) {
      expect(IMMERSION_LEVEL_LABELS[level].length).toBeGreaterThan(0);
      expect(IMMERSION_LEVEL_DESCRIPTIONS[level].length).toBeGreaterThan(0);
    }
  });

  it('chaque aide expose une action de révélation explicite et une annonce', () => {
    for (const aid of ['translation', 'romaji', 'furigana'] as const) {
      const labels = IMMERSION_AID_LABELS[aid];
      expect(labels.reveal).toMatch(/^Afficher/);
      expect(labels.revealed.length).toBeGreaterThan(0);
      expect(labels.name.length).toBeGreaterThan(0);
    }
  });
});

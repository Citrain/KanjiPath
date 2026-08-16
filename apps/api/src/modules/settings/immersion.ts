import type { FuriganaMode, ImmersionHelpLevel } from '@kanjipath/contracts';

export interface ImmersionRecommendationInput {
  romajiEnabled: boolean;
  furiganaMode: FuriganaMode;
  discoveredKanji: number;
  masteredKanji: number;
}

export interface ImmersionRecommendation {
  level: ImmersionHelpLevel;
  reasons: string[];
}

export const IMMERSION_MIN_DISCOVERED = 10;
export const IMMERSION_MIN_DISCOVERED_FOR_TOTAL = 30;
export const IMMERSION_MASTERY_SHARES = { level1: 0.2, level2: 0.5, level3: 0.8 } as const;

function clampLevel(value: number): ImmersionHelpLevel {
  if (value <= 0) return 0;
  if (value >= 3) return 3;
  return Math.floor(value) as ImmersionHelpLevel;
}

export function recommendImmersionHelp(
  input: ImmersionRecommendationInput,
): ImmersionRecommendation {
  const reasons: string[] = [];
  const discovered = Math.max(0, Math.floor(input.discoveredKanji));
  const mastered = Math.min(Math.max(0, Math.floor(input.masteredKanji)), discovered);

  if (discovered === 0) {
    return {
      level: 0,
      reasons: ["Aucun kanji découvert pour l'instant : affichage complet recommandé."],
    };
  }

  const share = mastered / discovered;
  const sharePercent = Math.round(share * 100);
  let level = 0;

  if (discovered < IMMERSION_MIN_DISCOVERED) {
    reasons.push(
      `Moins de ${IMMERSION_MIN_DISCOVERED} kanji découverts (${discovered}) : affichage complet recommandé.`,
    );
  } else {
    if (
      share >= IMMERSION_MASTERY_SHARES.level3 &&
      discovered >= IMMERSION_MIN_DISCOVERED_FOR_TOTAL
    ) {
      level = 3;
    } else if (share >= IMMERSION_MASTERY_SHARES.level2) {
      level = 2;
    } else if (share >= IMMERSION_MASTERY_SHARES.level1) {
      level = 1;
    }
    reasons.push(
      `${mastered} kanji maîtrisés sur ${discovered} découverts (${sharePercent} %) : niveau d'aide ${level}.`,
    );
    if (
      share >= IMMERSION_MASTERY_SHARES.level3 &&
      discovered < IMMERSION_MIN_DISCOVERED_FOR_TOTAL
    ) {
      reasons.push(
        `Immersion totale à partir de ${IMMERSION_MIN_DISCOVERED_FOR_TOTAL} kanji découverts.`,
      );
    }
  }

  if (!input.romajiEnabled && level < 2) {
    level = 2;
    reasons.push('Romaji désactivé dans vos préférences : niveau sans romaji recommandé.');
  }
  if (input.furiganaMode === 'never' && level < 3) {
    level = 3;
    reasons.push('Furigana désactivés dans vos préférences : immersion totale recommandée.');
  }

  return { level: clampLevel(level), reasons };
}

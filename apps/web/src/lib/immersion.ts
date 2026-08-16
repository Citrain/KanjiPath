import type { FuriganaMode, ImmersionAid, ImmersionHelpLevel } from '@kanjipath/contracts';

export const IMMERSION_HELP_LEVELS: readonly ImmersionHelpLevel[] = [0, 1, 2, 3];

export const IMMERSION_LEVEL_LABELS: Record<ImmersionHelpLevel, string> = {
  0: 'Affichage complet',
  1: 'Sans traduction',
  2: 'Sans romaji',
  3: 'Immersion totale',
};

export const IMMERSION_LEVEL_DESCRIPTIONS: Record<ImmersionHelpLevel, string> = {
  0: 'Toutes les aides restent visibles.',
  1: 'La traduction française est masquée par défaut.',
  2: 'La traduction et le romaji sont masqués par défaut.',
  3: 'La traduction, le romaji et les furigana sont masqués par défaut.',
};

export const IMMERSION_AID_LABELS: Record<
  ImmersionAid,
  { name: string; reveal: string; revealed: string }
> = {
  translation: {
    name: 'traduction',
    reveal: 'Afficher la traduction',
    revealed: 'Traduction affichée.',
  },
  romaji: {
    name: 'romaji',
    reveal: 'Afficher le romaji',
    revealed: 'Romaji affiché.',
  },
  furigana: {
    name: 'furigana',
    reveal: 'Afficher les furigana',
    revealed: 'Furigana affichés.',
  },
};

export function hiddenAidsForLevel(level: ImmersionHelpLevel): ImmersionAid[] {
  switch (level) {
    case 0:
      return [];
    case 1:
      return ['translation'];
    case 2:
      return ['translation', 'romaji'];
    case 3:
      return ['translation', 'romaji', 'furigana'];
  }
}

export function effectiveHiddenAids(input: {
  enabled: boolean;
  level: ImmersionHelpLevel;
  revealed: ReadonlySet<ImmersionAid>;
}): ImmersionAid[] {
  if (!input.enabled) {
    return [];
  }
  return hiddenAidsForLevel(input.level).filter((aid) => !input.revealed.has(aid));
}

export function resolveImmersionLevel(input: {
  overrideLevel: ImmersionHelpLevel | null;
  savedLevel: ImmersionHelpLevel | null;
  recommendedLevel: ImmersionHelpLevel;
}): ImmersionHelpLevel {
  if (input.overrideLevel !== null) {
    return input.overrideLevel;
  }
  if (input.savedLevel !== null) {
    return input.savedLevel;
  }
  return input.recommendedLevel;
}

export interface JapaneseDisplaySettings {
  furiganaMode: FuriganaMode;
  romajiVisible: boolean;
}

export function displayWithImmersion(input: {
  furiganaMode: FuriganaMode;
  romajiEnabled: boolean;
  hiddenAids: readonly ImmersionAid[];
}): JapaneseDisplaySettings {
  const hidden = new Set(input.hiddenAids);
  return {
    furiganaMode: hidden.has('furigana') ? 'never' : input.furiganaMode,
    romajiVisible: input.romajiEnabled && !hidden.has('romaji'),
  };
}

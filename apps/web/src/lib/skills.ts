import type { Skill } from '@kanjipath/contracts';

export const SKILLS: readonly Skill[] = [
  'meaning',
  'reading',
  'vocabulary',
  'context',
  'stroke',
  'listening',
];

export const SKILL_LABELS: Record<Skill, string> = {
  meaning: 'sens',
  reading: 'lecture',
  vocabulary: 'vocabulaire',
  context: 'contexte',
  stroke: 'composants & traits',
  listening: 'écoute',
};

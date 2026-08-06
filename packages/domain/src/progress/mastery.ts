export interface SkillScores {
  meaning: number;
  reading: number;
  vocabulary: number;
  context: number;
  stroke: number;
}

export interface MasteryThresholds {
  minOverall: number;
  minSkill: number;
  minSuccessfulReviews: number;
  minDistinctDays: number;
}

export interface MasteryInput {
  scores: SkillScores;
  successfulReviews: number;
  distinctReviewDays: number;
  hasRecentFailure: boolean;
}

export const DEFAULT_SKILL_WEIGHTS: SkillScores = {
  meaning: 0.2,
  reading: 0.2,
  vocabulary: 0.25,
  context: 0.25,
  stroke: 0.1,
};

export const DEFAULT_MASTERY_THRESHOLDS: MasteryThresholds = {
  minOverall: 0.85,
  minSkill: 0.7,
  minSuccessfulReviews: 2,
  minDistinctDays: 2,
};

export function computeOverallScore(
  scores: SkillScores,
  weights: SkillScores = DEFAULT_SKILL_WEIGHTS,
): number {
  const totalWeight =
    weights.meaning + weights.reading + weights.vocabulary + weights.context + weights.stroke;
  if (totalWeight <= 0) {
    return 0;
  }
  const weighted =
    scores.meaning * weights.meaning +
    scores.reading * weights.reading +
    scores.vocabulary * weights.vocabulary +
    scores.context * weights.context +
    scores.stroke * weights.stroke;
  return weighted / totalWeight;
}

export function isMastered(
  input: MasteryInput,
  thresholds: MasteryThresholds = DEFAULT_MASTERY_THRESHOLDS,
  weights: SkillScores = DEFAULT_SKILL_WEIGHTS,
): boolean {
  if (input.hasRecentFailure) {
    return false;
  }
  if (input.successfulReviews < thresholds.minSuccessfulReviews) {
    return false;
  }
  if (input.distinctReviewDays < thresholds.minDistinctDays) {
    return false;
  }
  const overall = computeOverallScore(input.scores, weights);
  if (overall < thresholds.minOverall) {
    return false;
  }
  return (Object.values(input.scores) as number[]).every((score) => score >= thresholds.minSkill);
}

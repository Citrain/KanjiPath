import { describe, expect, it } from 'vitest';
import { computeNewKanjiCount } from './study.service';

describe('computeNewKanjiCount', () => {
  const base = { mode: 'daily', dailyNewLimit: 10, reviewLimit: 40, autoBalance: true };

  it('plafonne les nouveaux kanji à 5 hors mode libre', () => {
    expect(computeNewKanjiCount({ ...base, dueCount: 0 })).toBe(5);
  });

  it('réduit les nouveaux kanji quand des révisions sont dues', () => {
    expect(computeNewKanjiCount({ ...base, dueCount: 38 })).toBe(2);
  });

  it('coupe les nouveaux kanji quand la charge atteint la limite', () => {
    expect(computeNewKanjiCount({ ...base, dueCount: 40 })).toBe(0);
    expect(computeNewKanjiCount({ ...base, dueCount: 60 })).toBe(0);
  });

  it("n'applique pas l'équilibrage quand autoBalance est désactivé", () => {
    expect(computeNewKanjiCount({ ...base, autoBalance: false, dueCount: 60 })).toBe(5);
  });

  it('ignore la limite en mode libre', () => {
    expect(computeNewKanjiCount({ ...base, mode: 'free', dueCount: 60 })).toBe(10);
  });

  it('respecte un dailyNewLimit bas', () => {
    expect(computeNewKanjiCount({ ...base, dailyNewLimit: 2, dueCount: 0 })).toBe(2);
  });
});

import { describe, expect, it } from 'vitest';
import {
  emptyTranscriptLabel,
  repeatEncouragementLabel,
  SHADOWING_DISCLAIMER,
  SHADOWING_PRACTICE_NOTE,
  segmentStatusLabel,
  segmentStatusShort,
  sttUnavailableLabel,
} from './shadowing-labels';

const FORBIDDEN_JUDGMENT_TERMS = [
  'mauvaise prononciation',
  'bonne prononciation',
  'erreur de prononciation',
  'faute de prononciation',
  'prononciation incorrecte',
  'prononciation correcte',
  'note de prononciation',
  'score de prononciation',
  'vous avez échoué',
  'accent incorrect',
];

function expectNoJudgment(text: string): void {
  const lower = text.toLowerCase();
  for (const term of FORBIDDEN_JUDGMENT_TERMS) {
    expect(lower, `le libellé « ${text} » ne doit pas contenir « ${term} »`).not.toContain(term);
  }
}

describe('libellés pédagogiques du shadowing', () => {
  it('présente la comparaison comme une aide, jamais comme un verdict', () => {
    expect(SHADOWING_DISCLAIMER).toContain('Aide à la correspondance');
    expect(SHADOWING_DISCLAIMER).toContain('prononciation');
    expect(SHADOWING_DISCLAIMER).toContain('accent');
    expect(SHADOWING_DISCLAIMER).toContain('rythme');
    expect(SHADOWING_DISCLAIMER).toContain('intonation');
    expectNoJudgment(SHADOWING_DISCLAIMER);
  });

  it('rappelle que la pratique est libre et sans effet sur la progression', () => {
    expect(SHADOWING_PRACTICE_NOTE).toContain('FSRS');
    expect(SHADOWING_PRACTICE_NOTE).toContain('aucun effet');
    expectNoJudgment(SHADOWING_PRACTICE_NOTE);
  });

  it('nomme les segments sans verdict de prononciation', () => {
    expect(segmentStatusLabel('matched')).toBe('Correspondance trouvée');
    expect(segmentStatusLabel('differs')).toBe('Segment à réécouter');
    expect(segmentStatusShort('matched')).toBe('Correspond');
    expect(segmentStatusShort('differs')).toBe('À réécouter');
    expectNoJudgment(segmentStatusLabel('differs'));
    expectNoJudgment(segmentStatusShort('differs'));
  });

  it('encourage la répétition libre dans les deux cas', () => {
    expectNoJudgment(repeatEncouragementLabel(true));
    expectNoJudgment(repeatEncouragementLabel(false));
    expect(repeatEncouragementLabel(false)).toContain('sans note');
    expect(repeatEncouragementLabel(true)).toContain('sans conséquence');
  });

  it('annonce un diagnostic honnête quand le STT ou la parole manquent', () => {
    expect(emptyTranscriptLabel()).toContain('Aucune parole détectée');
    expect(emptyTranscriptLabel()).toContain('aucun résultat');
    expect(sttUnavailableLabel('Le service STT local est arrêté.')).toContain(
      'la comparaison est désactivée',
    );
    expectNoJudgment(emptyTranscriptLabel());
    expectNoJudgment(sttUnavailableLabel('diagnostic'));
  });
});

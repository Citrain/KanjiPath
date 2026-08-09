import { describe, expect, it } from 'vitest';
import { microphoneInputLevel, voiceDisplayName, voiceStyleDisplayName } from './conversation-page';

describe('microphoneInputLevel', () => {
  it('indique le silence et borne le niveau audio', () => {
    expect(microphoneInputLevel(new Float32Array([0, 0, 0]))).toBe(0);
    expect(microphoneInputLevel(new Float32Array([1, -1]))).toBe(1);
  });

  it('amplifie suffisamment une voix faible pour le retour visuel', () => {
    expect(microphoneInputLevel(new Float32Array([0.02, -0.02]))).toBeCloseTo(0.16);
  });
});

describe('VOICEVOX labels', () => {
  it('romanise les noms et traduit les styles courants', () => {
    expect(voiceDisplayName('ずんだもん', 1)).toBe('Zundamon');
    expect(voiceStyleDisplayName('ノーマル', 3)).toBe('Normal');
  });

  it('ne renvoie pas de japonais pour une voix ou un style inconnu', () => {
    expect(voiceDisplayName('inconnu', 127)).toBe('Voix 127');
    expect(voiceStyleDisplayName('inconnu', 127)).toBe('Style 127');
  });
});

import { describe, expect, it } from 'vitest';
import audio from '../../../content/curated/audio.json' with { type: 'json' };
import { parseTatoebaAudioLine } from '../lib/importers.mjs';
import { dictationAnswer } from '../stages/generate.mjs';
import { selectTatoebaAudio } from '../stages/normalize.mjs';
import { SOURCES } from '../sources.mjs';

describe('audio source curation', () => {
  it('keeps only individually licensed, checksummed clips', () => {
    const audioFiles = SOURCES.tatoeba_audio.files.filter((file) => file.file.endsWith('.mp3'));
    expect(SOURCES.tatoeba_audio.files.some((file) => file.file === 'jpn_sentences_with_audio.tsv.bz2')).toBe(true);
    expect(audioFiles).toHaveLength(3);
    expect(audio.resources).toHaveLength(3);
    for (const file of audioFiles) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const resource of audio.resources) {
      expect(['CC BY 4.0', 'CC BY-NC 4.0']).toContain(resource.license);
      expect(resource.audioId).toMatch(/^\d+$/);
      expect(resource.tatoebaSentenceId).toMatch(/^\d+$/);
      expect(resource.speaker).toBeTruthy();
      expect(resource.attribution).toContain('Tatoeba');
      expect(resource.transcript).toBeTruthy();
      expect(audioFiles.find((file) => file.file === resource.file)).toBeTruthy();
    }
    expect(audio.resources.filter((resource) => resource.license === 'CC BY 4.0')).toHaveLength(3);
  });

  it('accepts only the two audio licences allowed by ADR-002', () => {
    expect(parseTatoebaAudioLine('88248\t1283521\tfal\tCC BY 4.0\t')).toEqual({
      sentenceTatoebaId: '88248',
      audioId: '1283521',
      speaker: 'fal',
      license: 'CC BY 4.0',
    });
    expect(parseTatoebaAudioLine('117934\t2255793\tyomi\tCC BY-NC 4.0\t')).toEqual({
      sentenceTatoebaId: '117934',
      audioId: '2255793',
      speaker: 'yomi',
      license: 'CC BY-NC 4.0',
    });
    expect(parseTatoebaAudioLine('1\t2\tspeaker\tCC BY-ND 4.0\t')).toBeNull();
    expect(parseTatoebaAudioLine('1\t2\tspeaker\t\t')).toBeNull();
  });

  it('keeps one usable recording per phrase and prefers CC BY', () => {
    const selected = selectTatoebaAudio(
      [
        { audioId: '20', sentenceTatoebaId: '10', speaker: 'nc', license: 'CC BY-NC 4.0' },
        { audioId: '30', sentenceTatoebaId: '10', speaker: 'by', license: 'CC BY 4.0' },
        { audioId: '40', sentenceTatoebaId: '11', speaker: 'nc', license: 'CC BY-NC 4.0' },
        { audioId: '50', sentenceTatoebaId: '12', speaker: 'excluded', license: 'CC BY-NC 4.0' },
      ],
      [
        { jpnId: 10, fraId: 1, japanese: '本当？', french: 'Vraiment ?', author: 'a' },
        { jpnId: 10, fraId: 2, japanese: '本当？', french: 'Est-ce vrai ?', author: 'a' },
        { jpnId: 11, fraId: 3, japanese: '何？', french: 'Quoi ?', author: 'b' },
      ],
      new Set(['40']),
    );

    expect(selected).toHaveLength(1);
    expect(selected[0]?.clip.audioId).toBe('30');
    expect(selected[0]?.pair.fraId).toBe(1);
  });

  it('materializes dictation prompts without their transcript', () => {
    for (const resource of audio.resources.filter((item) => item.acceptedAnswers)) {
      expect(resource.explanation).toContain(resource.transcript);
      expect(resource.acceptedAnswers).not.toContain(resource.transcript);
    }
  });

  it('derives a kana-only answer from fully annotated short sentences', () => {
    expect(
      dictationAnswer({
        tokens: [
          { reading: 'かのじょ' },
          { reading: 'は' },
          { reading: 'せんせい' },
          { reading: 'です' },
          { reading: '。' },
        ],
      }),
    ).toBe('かのじょはせんせいです');
    expect(dictationAnswer({ tokens: [{ reading: 'きょう' }, { reading: '3' }] })).toBeNull();
  });
});

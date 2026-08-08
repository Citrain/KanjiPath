import { describe, expect, it } from 'vitest';
import audio from '../../../content/curated/audio.json' with { type: 'json' };
import { SOURCES } from '../sources.mjs';

describe('audio source curation', () => {
  it('keeps only explicitly redistributable, checksummed clips', () => {
    expect(SOURCES.tatoeba_audio.license).toContain('CC BY 4.0');
    expect(SOURCES.tatoeba_audio.files).toHaveLength(3);
    for (const file of SOURCES.tatoeba_audio.files) {
      expect(file.sha256).toMatch(/^[a-f0-9]{64}$/);
    }
    for (const resource of audio.resources) {
      expect(resource.license).toBe('CC BY 4.0');
      expect(resource.attribution).toContain('Tatoeba');
      expect(resource.transcript).toBeTruthy();
    }
  });

  it('materializes dictation prompts without their transcript', () => {
    for (const resource of audio.resources.filter((item) => item.acceptedAnswers)) {
      expect(resource.explanation).toContain(resource.transcript);
      expect(resource.acceptedAnswers).not.toContain(resource.transcript);
    }
  });
});

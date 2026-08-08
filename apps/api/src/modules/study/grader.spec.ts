import { describe, expect, it } from 'vitest';
import { gradeAnswer } from './grader';

describe('audio dictation grading', () => {
  it('normalizes katakana, spaces and punctuation for kana answers', () => {
    expect(gradeAnswer('audio_dictation_kana', 'ジュウブン です。', ['じゅうぶんです'])).toBe(true);
  });

  it('does not accept a different transcript', () => {
    expect(
      gradeAnswer('audio_dictation_kana', 'じゅうぶんではありません', ['じゅうぶんです']),
    ).toBe(false);
  });
});

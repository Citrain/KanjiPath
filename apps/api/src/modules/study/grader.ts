import type { ReviewCardSkill } from '@kanjipath/contracts';

export const TEMPLATE_TO_CARD_SKILL: Record<string, ReviewCardSkill> = {
  kanji_to_meaning_qcm: 'KANJI_MEANING_RECOGNITION',
  meaning_to_kanji_qcm: 'MEANING_TO_KANJI',
  confusion_pair_qcm: 'KANJI_CONFUSION',
  kanji_to_reading_qcm: 'KANJI_READING',
  reading_type_qcm: 'READING_TYPE',
  reading_input_kana: 'READING_TO_KANJI',
  vocab_reading_qcm: 'VOCAB_READING',
  vocab_reading_advanced_qcm: 'VOCAB_READING',
  vocab_meaning_qcm: 'VOCAB_MEANING',
  sentence_cloze_kanji: 'CONTEXT_CLOZE',
  sentence_cloze_reading: 'CONTEXT_CLOZE',
  sentence_translation_qcm: 'CONTEXT_CLOZE',
  radical_recognition_qcm: 'RADICAL_RECOGNITION',
  component_search_qcm: 'RADICAL_RECOGNITION',
  stroke_count_qcm: 'STROKE_ORDER',
  component_selection_qcm: 'STROKE_ORDER',
  audio_dictation_kana: 'AUDIO_DICTATION',
};

export const CARD_SKILL_TO_TEMPLATES: Record<ReviewCardSkill, string[]> = {
  KANJI_MEANING_RECOGNITION: ['kanji_to_meaning_qcm'],
  MEANING_TO_KANJI: ['meaning_to_kanji_qcm'],
  KANJI_CONFUSION: ['confusion_pair_qcm'],
  KANJI_READING: ['kanji_to_reading_qcm'],
  READING_TYPE: ['reading_type_qcm'],
  READING_TO_KANJI: ['reading_input_kana'],
  VOCAB_READING: ['vocab_reading_qcm', 'vocab_reading_advanced_qcm'],
  VOCAB_MEANING: ['vocab_meaning_qcm'],
  CONTEXT_CLOZE: ['sentence_cloze_kanji', 'sentence_cloze_reading', 'sentence_translation_qcm'],
  RADICAL_RECOGNITION: ['radical_recognition_qcm', 'component_search_qcm'],
  STROKE_ORDER: ['stroke_count_qcm', 'component_selection_qcm'],
  AUDIO_DICTATION: ['audio_dictation_kana'],
};

export function requiresKanaInput(template: string): boolean {
  return template === 'reading_input_kana' || template === 'audio_dictation_kana';
}

export function toHiragana(text: string): string {
  return text.replace(/[ァ-ヺ]/g, (ch) => String.fromCharCode(ch.charCodeAt(0) - 0x60));
}

export function normalizeAnswer(text: string, kanaNormalize: boolean): string {
  let value = String(text).normalize('NFC').trim().toLowerCase();
  value = value.replace(/[\s\u200B-\u200D\u2060\uFEFF、。，．.!！?？]/g, '');
  if (kanaNormalize) {
    value = toHiragana(value);
  }
  return value;
}

export function isKanaTemplate(template: string): boolean {
  return [
    'reading_input_kana',
    'kanji_to_reading_qcm',
    'vocab_reading_qcm',
    'vocab_reading_advanced_qcm',
    'sentence_cloze_reading',
    'audio_dictation_kana',
  ].includes(template);
}

export function gradeAnswer(template: string, answer: string, acceptedAnswers: string[]): boolean {
  const kana = isKanaTemplate(template);
  const normalized = normalizeAnswer(answer, kana);
  return acceptedAnswers.some((accepted) => normalizeAnswer(accepted, kana) === normalized);
}

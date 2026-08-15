import { z } from 'zod';
import { JLPT_LEVELS } from '../enums';

export const AI_QUIZ_TYPES = [
  'meaning_qcm',
  'reading_qcm',
  'cloze_qcm',
  'conjugation_qcm',
  'conjugation_builder',
  'sentence_order',
  'dialogue_next_line',
  'listening_qcm',
  'contrast_qcm',
  'pair_match',
] as const;
export type AiQuizType = (typeof AI_QUIZ_TYPES)[number];

export const AI_QUIZ_QCM_TYPES = [
  'meaning_qcm',
  'reading_qcm',
  'cloze_qcm',
  'conjugation_qcm',
  'dialogue_next_line',
  'listening_qcm',
  'contrast_qcm',
] as const;
export type AiQuizQcmType = (typeof AI_QUIZ_QCM_TYPES)[number];

export const AI_QUIZ_LENGTHS = [5, 10, 20] as const;
export const AI_QUIZ_SKILLS = ['vocabulary', 'grammar', 'reading', 'listening', 'context'] as const;
export type AiQuizSkill = (typeof AI_QUIZ_SKILLS)[number];

export const AI_QUIZ_REQUIRED_SKILL_BY_TYPE: Record<AiQuizType, AiQuizSkill> = {
  meaning_qcm: 'vocabulary',
  conjugation_qcm: 'grammar',
  conjugation_builder: 'grammar',
  cloze_qcm: 'grammar',
  sentence_order: 'context',
  dialogue_next_line: 'context',
  listening_qcm: 'listening',
  reading_qcm: 'reading',
  contrast_qcm: 'vocabulary',
  pair_match: 'vocabulary',
};

export const createAiQuizSchema = z
  .object({
    prompt: z.string().trim().min(3).max(500),
    level: z.enum(JLPT_LEVELS),
    questionCount: z.union([z.literal(5), z.literal(10), z.literal(20)]),
    types: z.array(z.enum(AI_QUIZ_QCM_TYPES)).min(1).max(AI_QUIZ_QCM_TYPES.length),
    skills: z.array(z.enum(AI_QUIZ_SKILLS)).min(1).max(AI_QUIZ_SKILLS.length),
  })
  .strict();

const quizText = z.string().trim().min(1).max(500);
const choiceSchema = z
  .object({
    id: z.string().regex(/^[a-d]$/),
    label: quizText,
    kana: z.string().trim().min(1).max(500).optional(),
    detail: z.string().trim().min(1).max(180).optional(),
  })
  .strict();
const tileSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/),
    label: quizText,
    kana: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
const matchItemSchema = z
  .object({
    id: z.string().regex(/^[a-z][a-z0-9_-]{0,23}$/),
    label: quizText,
    kana: z.string().trim().min(1).max(500).optional(),
  })
  .strict();
const questionBaseSchema = z.object({
  key: z.string().regex(/^q[1-9][0-9]*$/),
  skill: z.enum(AI_QUIZ_SKILLS),
  difficulty: z.union([z.literal(1), z.literal(2), z.literal(3)]),
  stage: z.enum(['warmup', 'practice', 'challenge', 'finale']),
  prompt: z
    .object({
      title: z.string().trim().min(1).max(180),
      japanese: z.string().trim().min(1).max(400).optional(),
      kana: z.string().trim().min(1).max(400).optional(),
      translationFr: z.string().trim().min(1).max(400).optional(),
      contextFr: z.string().trim().min(1).max(300).optional(),
      audioText: z.string().trim().min(1).max(300).optional(),
      hideJapaneseUntilPlayed: z.boolean().optional(),
    })
    .strict(),
  hint: z.string().trim().min(1).max(240),
  explanation: z
    .object({
      title: z.string().trim().min(1).max(120),
      bodyFr: z.string().trim().min(1).max(700),
      takeaway: z.string().trim().min(1).max(240),
      examples: z
        .array(
          z
            .object({
              japanese: z.string().trim().min(1).max(250),
              translationFr: z.string().trim().min(1).max(250),
            })
            .strict(),
        )
        .max(2)
        .optional(),
    })
    .strict(),
  tags: z.array(z.string().trim().min(1).max(80)).max(6),
});

const choiceQuestionSchema = questionBaseSchema
  .extend({
    kind: z.literal('choice'),
    type: z.enum([
      'meaning_qcm',
      'reading_qcm',
      'cloze_qcm',
      'conjugation_qcm',
      'dialogue_next_line',
      'listening_qcm',
      'contrast_qcm',
    ]),
    choices: z.array(choiceSchema).min(3).max(4),
    correct: z.object({ choiceId: z.string().regex(/^[a-d]$/) }).strict(),
  })
  .strict()
  .superRefine((question, ctx) => {
    const ids = question.choices.map((choice) => choice.id);
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', message: 'Choix dupliqués' });
    if (!ids.includes(question.correct.choiceId)) {
      ctx.addIssue({ code: 'custom', message: 'La réponse correcte doit être un choix' });
    }
    if (question.type === 'listening_qcm' && !question.prompt.audioText) {
      ctx.addIssue({ code: 'custom', message: 'Une question d’écoute demande audioText' });
    }
  });

const matchQuestionSchema = questionBaseSchema
  .extend({
    kind: z.literal('match'),
    type: z.literal('pair_match'),
    leftItems: z.array(matchItemSchema).min(3).max(4),
    rightItems: z.array(matchItemSchema).min(3).max(4),
    correct: z
      .object({
        pairings: z
          .array(z.object({ leftId: z.string().min(1), rightId: z.string().min(1) }).strict())
          .min(3)
          .max(4),
      })
      .strict(),
  })
  .strict()
  .superRefine((question, ctx) => {
    const leftIds = question.leftItems.map((item) => item.id);
    const rightIds = question.rightItems.map((item) => item.id);
    const pairingLeftIds = question.correct.pairings.map((pairing) => pairing.leftId);
    const pairingRightIds = question.correct.pairings.map((pairing) => pairing.rightId);
    if (
      new Set(leftIds).size !== leftIds.length ||
      new Set(rightIds).size !== rightIds.length ||
      leftIds.length !== rightIds.length ||
      new Set(pairingLeftIds).size !== leftIds.length ||
      new Set(pairingRightIds).size !== rightIds.length ||
      question.correct.pairings.length !== leftIds.length ||
      pairingLeftIds.some((id) => !leftIds.includes(id)) ||
      pairingRightIds.some((id) => !rightIds.includes(id))
    ) {
      ctx.addIssue({ code: 'custom', message: 'Appariements incomplets ou invalides' });
    }
  });

const orderQuestionSchema = questionBaseSchema
  .extend({
    kind: z.literal('order'),
    type: z.enum(['conjugation_builder', 'sentence_order']),
    tiles: z.array(tileSchema).min(3).max(8),
    correct: z.object({ orderedTileIds: z.array(z.string().min(1)).min(3).max(8) }).strict(),
  })
  .strict()
  .superRefine((question, ctx) => {
    const ids = question.tiles.map((tile) => tile.id);
    if (
      new Set(ids).size !== ids.length ||
      new Set(question.correct.orderedTileIds).size !== ids.length
    ) {
      ctx.addIssue({ code: 'custom', message: 'Tuiles dupliquées ou ordre incomplet' });
    }
    if (question.correct.orderedTileIds.some((id) => !ids.includes(id))) {
      ctx.addIssue({ code: 'custom', message: 'Ordre avec tuile inconnue' });
    }
  });

export const aiQuizQuestionSchema = z.union([
  choiceQuestionSchema,
  orderQuestionSchema,
  matchQuestionSchema,
]);

export const aiQuizModelQuestionSchema = z
  .object({
    type: z.enum(AI_QUIZ_QCM_TYPES),
    japanese: z.string().trim().min(1).max(300),
    kana: z.string().trim().min(1).max(300),
    options: z.array(z.string().trim().min(1).max(300)).length(4),
    answerIndex: z.number().int().min(0).max(3),
    explanationFr: z.string().trim().min(1).max(500),
  })
  .strict()
  .superRefine((question, ctx) => {
    if (hasKanji(question.kana)) {
      ctx.addIssue({ code: 'custom', message: 'Une lecture kana ne contient jamais de kanji' });
    }
    if (new Set(question.options.map(normalizeComparableText)).size !== question.options.length) {
      ctx.addIssue({ code: 'custom', message: 'Options dupliquées' });
    }
    if (question.options.some(hasKanji)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Les choix QCM utilisent uniquement le français ou le kana',
      });
    }
    if (
      ['reading_qcm', 'cloze_qcm', 'conjugation_qcm'].includes(question.type) &&
      question.options.some((option) => !isKanaOption(option))
    ) {
      ctx.addIssue({ code: 'custom', message: 'Ce QCM demande quatre options en kana' });
    }
    if (question.type === 'reading_qcm') {
      if (!hasKanji(question.japanese)) {
        ctx.addIssue({ code: 'custom', message: 'Un QCM de lecture demande un mot avec kanji' });
      }
      const reading = normalizeComparableText(question.kana);
      const matchingOptions = question.options.filter(
        (option) => normalizeComparableText(option) === reading,
      );
      if (matchingOptions.length !== 1) {
        ctx.addIssue({
          code: 'custom',
          message: 'Une seule option doit être la lecture kana exacte du mot',
        });
      }
    }
    if (
      (question.type === 'cloze_qcm' || question.type === 'conjugation_qcm') &&
      (!question.japanese.includes(AI_QUIZ_BLANK) || !question.kana.includes(AI_QUIZ_BLANK))
    ) {
      ctx.addIssue({
        code: 'custom',
        message: `Ce QCM doit masquer la réponse avec ${AI_QUIZ_BLANK}`,
      });
    }
  });

export const aiQuizModelOutputSchema = z
  .object({
    questions: z.array(aiQuizModelQuestionSchema).min(5).max(20),
  })
  .strict()
  .superRefine((quiz, ctx) => {
    const signatures = quiz.questions.map(questionSignature);
    if (new Set(signatures).size !== signatures.length) {
      ctx.addIssue({ code: 'custom', path: ['questions'], message: 'Questions dupliquées' });
    }
  });

export const aiQuizModelOutputJsonSchema = z.toJSONSchema(aiQuizModelOutputSchema);
export const aiQuizModelQuestionJsonSchema = z.toJSONSchema(aiQuizModelQuestionSchema);

export function createAiQuizModelQuestionJsonSchema(): Record<string, unknown> {
  const schema = cloneJsonObject(aiQuizModelQuestionJsonSchema as JsonObject);
  delete jsonObject(schema.properties).type;
  schema.required = (schema.required as unknown[]).filter((name) => name !== 'type');
  const choices = jsonObject(jsonObject(schema.properties).options);
  choices.uniqueItems = true;
  return schema;
}

export const aiQuizDraftSchema = z
  .object({
    schemaVersion: z.literal(1),
    title: z.string().trim().min(1).max(100),
    subtitle: z.string().trim().min(1).max(180),
    level: z.enum(JLPT_LEVELS),
    theme: z.string().trim().min(1).max(100),
    estimatedMinutes: z.number().int().min(2).max(35),
    skills: z.array(z.enum(AI_QUIZ_SKILLS)).min(1).max(AI_QUIZ_SKILLS.length),
    intro: z
      .object({
        japanese: z.string().trim().min(1).max(300),
        kana: z.string().trim().min(1).max(300).optional(),
        translationFr: z.string().trim().min(1).max(300),
      })
      .strict(),
    questions: z.array(aiQuizQuestionSchema).min(5).max(20),
  })
  .strict()
  .superRefine((quiz, ctx) => {
    const keys = quiz.questions.map((question) => question.key);
    if (new Set(keys).size !== keys.length)
      ctx.addIssue({ code: 'custom', message: 'Questions dupliquées' });
  });

export const submitAiQuizAnswerSchema = z
  .object({
    questionKey: z.string().regex(/^q[1-9][0-9]*$/),
    answer: z
      .object({
        choiceId: z
          .string()
          .regex(/^[a-d]$/)
          .optional(),
        orderedTileIds: z.array(z.string().min(1)).max(8).optional(),
        pairings: z
          .array(z.object({ leftId: z.string().min(1), rightId: z.string().min(1) }).strict())
          .max(4)
          .optional(),
      })
      .strict(),
    responseTimeMs: z.number().int().min(0).max(3_600_000).optional(),
  })
  .strict();

export type CreateAiQuizInput = z.infer<typeof createAiQuizSchema>;
export type AiQuizDraft = z.infer<typeof aiQuizDraftSchema>;
export type AiQuizQuestionDraft = z.infer<typeof aiQuizQuestionSchema>;
export type AiQuizModelOutput = z.infer<typeof aiQuizModelOutputSchema>;
export type SubmitAiQuizAnswerInput = z.infer<typeof submitAiQuizAnswerSchema>;

type JsonObject = Record<string, unknown>;

function jsonObject(value: unknown): JsonObject {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error('Schéma JSON du Quiz IA inattendu');
  }
  return value as JsonObject;
}

function cloneJsonObject(value: JsonObject): JsonObject {
  return JSON.parse(JSON.stringify(value)) as JsonObject;
}

function hasKanji(value: string | undefined): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(value ?? '');
}

function isKanaOption(value: string): boolean {
  return /^[\u3040-\u30ffー\s。、！？・]+$/.test(value);
}

const AI_QUIZ_BLANK = '＿＿＿';

function normalizeComparableText(value: string): string {
  return value.normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase('fr');
}

function questionSignature(question: { type: string; japanese: string }): string {
  return `${question.type}\u0000${normalizeComparableText(question.japanese)}`;
}

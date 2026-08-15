import { aiQuizDraftSchema } from '@kanjipath/contracts';
import { describe, expect, it } from 'vitest';
import { ConversationConfig } from '../conversation/conversation.config';
import { OllamaProvider } from '../conversation/conversation.providers';
import { AiQuizOrchestrator } from './ai-quiz.orchestrator';

const describeLocal = process.env.RUN_LOCAL_AI_EVAL === 'true' ? describe : describe.skip;

describeLocal('quiz IA local avec Ollama', () => {
  it('génère deux quiz restaurant valides sans répéter leurs questions', async () => {
    const config = new ConversationConfig();
    const provider = new OllamaProvider(config);
    const input = {
      prompt: 'Réviser la forme passée des verbes au restaurant.',
      level: 'N5' as const,
      questionCount: 5 as const,
      types: ['meaning_qcm', 'reading_qcm', 'cloze_qcm', 'conjugation_qcm'] as const,
      skills: ['vocabulary', 'grammar', 'reading'] as const,
    };
    const orchestrator = new AiQuizOrchestrator({} as never, config, provider, {
      health: async () => ({ available: false, detail: null }),
      voices: async () => [],
      synthesize: async () => ({ mimeType: 'audio/wav', bytes: Buffer.alloc(0) }),
    });
    const generate = (
      orchestrator as unknown as {
        generate(
          input: typeof input,
          constraints: {
            vocabulary: { word: string; reading: string; meaningFr: string }[];
            sentences: { japanese: string; translationFr: string }[];
          },
          diversity?: { seed: number; excludedJapanese: string[] },
        ): Promise<unknown>;
      }
    ).generate.bind(orchestrator);
    const constraints = {
      vocabulary: [
        { word: '食べる', reading: 'たべる', meaningFr: 'manger' },
        { word: '飲む', reading: 'のむ', meaningFr: 'boire' },
        { word: '読む', reading: 'よむ', meaningFr: 'lire' },
        { word: '行く', reading: 'いく', meaningFr: 'aller' },
      ],
      sentences: [
        {
          japanese: '昨日レストランでご飯を食べました。',
          translationFr: 'Hier, j’ai mangé au restaurant.',
        },
      ],
    };
    const quiz = aiQuizDraftSchema.parse(await generate(input, constraints));
    const firstJapanese = quiz.questions.flatMap((question) =>
      question.prompt.japanese ? [question.prompt.japanese] : [],
    );
    const secondQuiz = aiQuizDraftSchema.parse(
      await generate(input, constraints, { seed: 5, excludedJapanese: firstJapanese }),
    );
    expect(quiz.level).toBe('N5');
    expect(quiz.questions).toHaveLength(5);
    expect(quiz.intro.kana).toBeTruthy();
    expect(
      quiz.questions.every(
        (question) => !question.prompt.japanese || Boolean(question.prompt.kana),
      ),
    ).toBe(true);
    expect(
      quiz.questions.every(
        (question) => question.kind !== 'choice' || question.choices.length === 4,
      ),
    ).toBe(true);
    expect(quiz.questions.every((question) => question.type !== 'listening_qcm')).toBe(true);
    expect(JSON.stringify(quiz)).toMatch(/restaurant|食|たべ|passé/i);
    expect(secondQuiz.questions).toHaveLength(5);
    expect(
      secondQuiz.questions.some(
        (question) =>
          Boolean(question.prompt.japanese) && firstJapanese.includes(question.prompt.japanese!),
      ),
    ).toBe(false);
  }, 900_000);
});

import { conversationModelOutputSchema } from '@kanjipath/contracts';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConversationConfig } from './conversation.config';
import {
  applyConversationCorrectionPolicy,
  ConversationOrchestrator,
} from './conversation.orchestrator';
import type { JapaneseTtsProvider, LlmProvider } from './conversation.providers';

const output = {
  reply: { ja: 'こんにちは。何をしますか？', reading: 'Konnichiwa. Nani o shimasu ka?' },
  correction: {
    needed: true,
    severity: 'minor' as const,
    original: 'わたし は',
    corrected: 'わたしは',
    explanationFr: 'L’espace est inutile.',
  },
  learning: { grammarIds: [], vocabularyIds: [], newItems: [] },
  conversation: { shouldContinue: true, intent: 'greeting' },
};

describe('conversation model policy', () => {
  it('valide uniquement le contrat JSON complet du LLM', () => {
    expect(conversationModelOutputSchema.safeParse(output).success).toBe(true);
    expect(conversationModelOutputSchema.safeParse({ reply: output.reply }).success).toBe(false);
  });

  it('applique la politique de correction sans laisser le LLM la décider', () => {
    expect(applyConversationCorrectionPolicy(output, 'none').correction).toBeNull();
    expect(applyConversationCorrectionPolicy(output, 'important').correction).toBeNull();
    expect(applyConversationCorrectionPolicy(output, 'all').correction).toEqual(output.correction);
  });

  it('répare une seule sortie LLM invalide avant de continuer', async () => {
    let calls = 0;
    let prompt = '';
    const prompts: string[] = [];
    const llm: LlmProvider = {
      health: async () => ({ available: true, detail: null }),
      generate: async (systemPrompt) => {
        calls += 1;
        prompts.push(systemPrompt);
        if (calls === 1) prompt = systemPrompt;
        if (calls === 1) return 'pas du JSON';
        if (calls === 3 || calls === 7)
          return JSON.stringify({
            ...output,
            reply: { ja: 'はい、好きです。', reading: 'Hai, suki desu.' },
          });
        if (calls === 8) return 'pas du JSON';
        if (calls === 5) return JSON.stringify({ ...output, correction: null });
        if (calls === 6)
          return JSON.stringify({
            needed: true,
            corrected: '元気です',
            explanationFr: 'Il manque genki.',
          });
        return JSON.stringify(output);
      },
    };
    const orchestrator = new ConversationOrchestrator(
      {} as PrismaService,
      {
        values: {
          enabled: true,
          ollamaBaseUrl: 'http://127.0.0.1:11434',
          ollamaModel: 'test',
          ollamaContextLength: 1024,
          sttBaseUrl: 'http://127.0.0.1:8765',
          voicevoxBaseUrl: 'http://127.0.0.1:50021',
          voicevoxSpeakerId: 1,
          voicevoxSpeed: 1,
          defaultLevel: 'N5',
          defaultDifficulty: 'easy',
          defaultCorrectionMode: 'important',
          maxTurnSeconds: 60,
        },
      } as ConversationConfig,
      llm,
      {} as JapaneseTtsProvider,
    );
    const generate = orchestrator as unknown as {
      generateOutput: (
        session: {
          level: string;
          scenario: string;
          difficulty: string;
          correctionMode: string;
          goalsJson: [];
          turns: [];
        },
        transcript: string,
        constraints: { knownKanji: string[]; vocabularyIds: string[] },
      ) => Promise<{ usedFallback: boolean }>;
    };

    const session = {
      level: 'N5',
      scenario: 'introduction',
      difficulty: 'easy',
      correctionMode: 'important',
      goalsJson: [],
      turns: [],
    };
    const constraints = { knownKanji: [], vocabularyIds: [] };
    const repaired = await generate.generateOutput(session, 'こんにちは', constraints);
    const regenerated = await generate.generateOutput(session, 'hai suki desu', constraints);
    const reviewed = await generate.generateOutput(session, 'ki desu', constraints);
    const preserved = await generate.generateOutput(session, '好きです', constraints);

    expect(calls).toBe(8);
    expect(repaired.usedFallback).toBe(false);
    expect(regenerated.usedFallback).toBe(false);
    expect(reviewed.output.correction?.severity).toBe('important');
    expect(preserved.usedFallback).toBe(false);
    expect(prompt).toContain('garde cette forme comme objectif de conversation');
    expect(prompt).toContain('jamais une raison d’abandonner le dialogue');
    expect(prompt).toContain('réponses brèves, elliptiques ou en romaji');
    expect(prompt).toContain('toujours une correction `important`');
    expect(prompt).toContain('uniquement en hiragana ou katakana');
    expect(prompt).toContain('les emprunts comme `menu`, ne sont pas des erreurs');
    expect(prompt).toContain('`genki desu ka` est une question correcte');
    expect(prompt).toContain('tentative incomplète de `genki desu`');
    expect(prompts.some((value) => value.includes('You review an all-romaji'))).toBe(true);
    expect(prompts.some((value) => value.includes('"needed":true'))).toBe(true);
    expect(prompts.some((value) => value.includes('only in hiragana or katakana'))).toBe(true);
    expect(prompts.some((value) => value.includes('loanwords such as menu'))).toBe(true);
  });

  it('normalise une correction LLM partielle avant la validation du contrat API', async () => {
    let calls = 0;
    const llm: LlmProvider = {
      health: async () => ({ available: true, detail: null }),
      generate: async () => {
        calls += 1;
        return JSON.stringify(
          calls === 1
            ? {
                reply: {
                  ja: '元気ですね。何をしていますか？',
                  reading: 'Genki desu ne. Nani o shite imasu ka?',
                },
                correction: {
                  original: 'ki desu',
                  corrected: '元気です',
                  explanation: '「元気です」の方が自然です。',
                },
                learning: { grammarIds: [], vocabularyIds: [], newItems: [] },
                conversation: { shouldContinue: true, intent: 'continue' },
              }
            : {
                ...output,
                correction: { ...output.correction, original: '元気です', corrected: '元気です' },
              },
        );
      },
    };
    const orchestrator = new ConversationOrchestrator(
      {} as PrismaService,
      {
        values: {
          enabled: true,
          ollamaBaseUrl: 'http://127.0.0.1:11434',
          ollamaModel: 'test',
          ollamaContextLength: 1024,
          sttBaseUrl: 'http://127.0.0.1:8765',
          voicevoxBaseUrl: 'http://127.0.0.1:50021',
          voicevoxSpeakerId: 1,
          voicevoxSpeed: 1,
          defaultLevel: 'N5',
          defaultDifficulty: 'easy',
          defaultCorrectionMode: 'important',
          maxTurnSeconds: 60,
        },
      } as ConversationConfig,
      llm,
      {} as JapaneseTtsProvider,
    );
    const generate = orchestrator as unknown as {
      generateOutput: (
        session: {
          level: string;
          scenario: string;
          difficulty: string;
          correctionMode: string;
          goalsJson: [];
          turns: [];
        },
        transcript: string,
        constraints: { knownKanji: string[]; vocabularyIds: string[] },
      ) => Promise<{
        output: {
          correction: {
            needed: boolean;
            severity: string;
            original: string;
            corrected: string;
            explanationFr: string;
          } | null;
        };
        usedFallback: boolean;
      }>;
    };

    const result = await generate.generateOutput(
      {
        level: 'N5',
        scenario: 'introduction',
        difficulty: 'easy',
        correctionMode: 'important',
        goalsJson: [],
        turns: [],
      },
      'ki desu',
      { knownKanji: [], vocabularyIds: [] },
    );

    expect(result.usedFallback).toBe(false);
    expect(result.output.correction).toEqual({
      needed: true,
      severity: 'important',
      original: 'ki desu',
      corrected: '元気です',
      explanationFr: 'La forme correcte est «元気です».',
    });

    const noOp = await generate.generateOutput(
      {
        level: 'N5',
        scenario: 'introduction',
        difficulty: 'easy',
        correctionMode: 'important',
        goalsJson: [],
        turns: [],
      },
      '元気です',
      { knownKanji: [], vocabularyIds: [] },
    );
    expect(noOp.output.correction).toBeNull();
  });
});

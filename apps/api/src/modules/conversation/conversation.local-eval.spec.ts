import type { ConversationModelOutput } from '@kanjipath/contracts';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConversationConfig } from './conversation.config';
import { ConversationOrchestrator } from './conversation.orchestrator';
import { OllamaProvider } from './conversation.providers';

const describeLocal = process.env.RUN_LOCAL_AI_EVAL === 'true' ? describe : describe.skip;

describeLocal('conversation locale avec Ollama', () => {
  it('maintient un échange naturel, contextualisé et pédagogiquement utile', async () => {
    const generate = localGenerateOutput();
    const session = {
      level: 'N5',
      scenario: 'leisure',
      difficulty: 'easy',
      correctionMode: 'important',
      goalsJson: ['Pratiquer la forme 〜ている'],
      turns: [] as { transcript: string; replyJson: ConversationModelOutput }[],
    };
    const replies: string[] = [];
    const questions = new Set<string>();
    const turns = [
      'watashi wa geemu ga suki desu',
      'ima Zelda o shiteimasu. totemo tanoshii desu',
      'anata wa donna geemu o shiteimasu ka',
      'je veux aussi pratiquer te iru sans faire un exercice scolaire',
    ];

    for (const transcript of turns) {
      const output = await generate(session, transcript);
      expect(output.reply.ja).not.toContain('もう少し詳しく教えてください');
      expect(replies).not.toContain(output.reply.ja);
      expect(output.reply.ja).not.toMatch(/[A-Za-zÀ-ÿ]/);
      if (output.correction) {
        expect(output.correction.original).toBe(transcript);
        expect(output.correction.corrected).toMatch(/^[\u3040-\u30ffー・、。！？!?…〜～\s]+$/);
      }
      if (transcript === 'watashi wa geemu ga suki desu') {
        expect(output.correction).toBeNull();
      }
      const question = output.reply.ja.split(/[。！]/).find((part) => part.includes('？'));
      if (question) {
        expect(questions.has(question)).toBe(false);
        questions.add(question);
      }
      replies.push(output.reply.ja);
      session.turns.push({ transcript, replyJson: output });
    }
  }, 300_000);

  it('fait avancer une scène de restaurant sans interrogatoire mécanique', async () => {
    const output = await localGenerateOutput()(
      {
        level: 'N5',
        scenario: 'restaurant',
        difficulty: 'easy',
        correctionMode: 'all',
        goalsJson: [],
        turns: [],
      },
      'futari desu',
    );

    expect(output.reply.ja).not.toContain('もう少し詳しく教えてください');
    expect(output.reply.ja).toMatch(/席|せき|こちら|どうぞ|案内/);
  }, 120_000);
});

function localGenerateOutput() {
  const config = new ConversationConfig();
  const orchestrator = new ConversationOrchestrator(
    {} as PrismaService,
    config,
    new OllamaProvider(config),
    {
      health: async () => ({ available: false, detail: null }),
      voices: async () => [],
      synthesize: async () => ({ mimeType: 'audio/wav', bytes: Buffer.alloc(0) }),
    },
  );
  const generate = (
    orchestrator as unknown as {
      generateOutput: (
        session: {
          level: string;
          scenario: string;
          difficulty: string;
          correctionMode: string;
          goalsJson: string[];
          turns: { transcript: string; replyJson: ConversationModelOutput }[];
        },
        transcript: string,
        constraints: { knownKanji: string[]; vocabulary: [] },
      ) => Promise<ConversationModelOutput>;
    }
  ).generateOutput.bind(orchestrator);
  return (
    session: {
      level: string;
      scenario: string;
      difficulty: string;
      correctionMode: string;
      goalsJson: string[];
      turns: { transcript: string; replyJson: ConversationModelOutput }[];
    },
    transcript: string,
  ) => generate(session, transcript, { knownKanji: [], vocabulary: [] });
}

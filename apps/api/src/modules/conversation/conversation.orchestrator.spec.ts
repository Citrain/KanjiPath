import type { ConversationModelOutput } from '@kanjipath/contracts';
import {
  conversationGeneratedOutputSchema,
  conversationModelOutputSchema,
} from '@kanjipath/contracts';
import { describe, expect, it } from 'vitest';
import type { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConversationConfig } from './conversation.config';
import {
  applyConversationCorrectionPolicy,
  buildConversationPrompt,
  ConversationOrchestrator,
} from './conversation.orchestrator';
import type {
  JapaneseTtsProvider,
  LlmConversationMessage,
  LlmProvider,
} from './conversation.providers';

const validOutput: ConversationModelOutput = {
  reply: {
    ja: '週末はよく料理をします。カレーを作るのが好きです。',
    reading: 'Shuumatsu wa yoku ryouri o shimasu. Karee o tsukuru no ga suki desu.',
  },
  correction: null,
  learning: { grammarIds: [], vocabularyIds: [], newItems: [] },
  conversation: { shouldContinue: true, intent: 'share_cooking_habit' },
};

const correctedOutput: ConversationModelOutput = {
  ...validOutput,
  correction: {
    needed: true,
    severity: 'minor',
    original: 'watashi wa ryori ga suki',
    corrected: 'わたしはりょうりがすきです',
    explanationFr: 'Ajoute です pour terminer poliment la phrase.',
  },
};

const session = {
  level: 'N5',
  scenario: 'leisure',
  difficulty: 'easy',
  correctionMode: 'important',
  goalsJson: [],
  turns: [] as { transcript: string; replyJson: unknown }[],
};

const constraints = {
  knownKanji: ['私', '好'],
  vocabulary: [{ id: 'v-cooking', writtenForm: '料理', reading: 'りょうり', meaningFr: 'cuisine' }],
};

type GenerateOutput = (
  currentSession: typeof session,
  transcript: string,
  currentConstraints: typeof constraints,
) => Promise<ConversationModelOutput>;

function createOrchestrator(llm: LlmProvider): ConversationOrchestrator {
  return new ConversationOrchestrator(
    {} as PrismaService,
    {
      values: {
        enabled: true,
        ollamaBaseUrl: 'http://127.0.0.1:11434',
        ollamaModel: 'test',
        ollamaContextLength: 32_768,
        ollamaMaxTokens: 512,
        ollamaTimeoutSeconds: 120,
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
}

function generateWith(orchestrator: ConversationOrchestrator): GenerateOutput {
  return (orchestrator as unknown as { generateOutput: GenerateOutput }).generateOutput.bind(
    orchestrator,
  );
}

function llmFrom(generate: LlmProvider['generate']): LlmProvider {
  return {
    health: async () => ({ available: true, detail: null }),
    generate,
  };
}

describe('conversation model policy', () => {
  it('garde le scénario libre neutre par défaut', () => {
    const prompt = buildConversationPrompt(
      {
        level: 'N5',
        scenario: 'free',
        difficulty: 'easy',
        correctionMode: 'important',
        goalsJson: ['Dans une gare, demander un billet.'],
      },
      constraints,
    );

    expect(prompt).toContain('Aucun rôle ni décor n’est imposé');
    expect(prompt).toContain('Dans une gare, demander un billet.');
    expect(prompt).toContain('Ne force pas une phase de présentation');
  });

  it('valide un contrat JSON strict, japonais et lisible', () => {
    expect(conversationModelOutputSchema.safeParse(correctedOutput).success).toBe(true);
    expect(conversationModelOutputSchema.safeParse({ reply: validOutput.reply }).success).toBe(
      false,
    );
    expect(
      conversationGeneratedOutputSchema.safeParse({
        ...validOutput,
        reply: { ja: '日本語 is fun', reading: 'Nihongo is fun' },
      }).success,
    ).toBe(false);
    expect(
      conversationGeneratedOutputSchema.safeParse({
        reply: correctedOutput.reply,
        correction: { ...correctedOutput.correction, corrected: '私は料理が好きです' },
        conversation: correctedOutput.conversation,
      }).success,
    ).toBe(false);
  });

  it('applique la politique de correction sans laisser le LLM la décider', () => {
    expect(applyConversationCorrectionPolicy(correctedOutput, 'none').correction).toBeNull();
    expect(applyConversationCorrectionPolicy(correctedOutput, 'important').correction).toBeNull();
    expect(applyConversationCorrectionPolicy(correctedOutput, 'all').correction).toEqual(
      correctedOutput.correction,
    );
  });

  it('construit un rôle de partenaire-professeur avec des contraintes concrètes', async () => {
    let prompt = '';
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async (systemPrompt) => {
          if (!prompt) prompt = systemPrompt;
          return JSON.stringify(validOutput);
        }),
      ),
    );

    await generate(session, 'watashi wa geemu ga suki desu', constraints);

    expect(prompt).toContain('interlocuteur japonais natif crédible');
    expect(prompt).toContain('Évite le schéma mécanique question-réponse-question');
    expect(prompt).toContain('Une question n’est pas obligatoire');
    expect(prompt).toContain('N’ouvre pas automatiquement par');
    expect(prompt).toContain('original` doit reproduire exactement le dernier transcript');
    expect(prompt).toContain('uniquement en hiragana ou katakana');
    expect(prompt).toContain('Réplique de 1 ou 2 phrases courtes');
    expect(prompt).toContain('料理');
    expect(prompt).toContain('v-cooking');
  });

  it('répare une sortie invalide avec le transcript et tout l’historique', async () => {
    const calls: { prompt: string; message: string; history: LlmConversationMessage[] }[] = [];
    const history: LlmConversationMessage[] = [
      { role: 'user', content: 'しゅみは何ですか？' },
      { role: 'assistant', content: '料理が好きです。' },
    ];
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async (prompt, message, receivedHistory = []) => {
          calls.push({ prompt, message, history: receivedHistory });
          return calls.length === 1 ? 'pas du JSON' : JSON.stringify(validOutput);
        }),
      ),
    );

    const result = await generate(
      {
        ...session,
        turns: [
          {
            transcript: history[0]?.content ?? '',
            replyJson: {
              ...validOutput,
              reply: { ja: history[1]?.content ?? '', reading: 'Ryouri ga suki desu.' },
            },
          },
        ],
      },
      'どんな料理を作りますか？',
      constraints,
    );

    expect(result.reply.ja).toBe(validOutput.reply.ja);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.message).toBe('どんな料理を作りますか？');
    expect(calls[1]?.history).toEqual(history);
    expect(calls[1]?.prompt).toContain('RÉPARATION DE SORTIE');
  });

  it('normalise seulement une correction partielle identifiable et force le transcript original', async () => {
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async () =>
          JSON.stringify({
            ...validOutput,
            correction: { corrected: 'わたしはりょうりがすきです' },
          }),
        ),
      ),
    );

    const result = await generate(session, 'watashi ryori suki', constraints);

    expect(result.correction).toEqual({
      needed: true,
      severity: 'important',
      original: 'watashi ryori suki',
      corrected: 'わたしはりょうりがすきです',
      explanationFr: 'La forme correcte est «わたしはりょうりがすきです».',
    });
  });

  it('refuse deux réponses génériques au lieu de persister un faux dialogue', async () => {
    let calls = 0;
    const generic = {
      ...validOutput,
      reply: {
        ja: 'そうですか。もう少し詳しく教えてください。',
        reading: 'Sou desu ka. Mou sukoshi kuwashiku oshiete kudasai.',
      },
    };
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async () => {
          calls += 1;
          return JSON.stringify(generic);
        }),
      ),
    );

    await expect(generate(session, 'ゲームが好きです。', constraints)).rejects.toThrow(
      'réponse conversationnelle satisfaisante',
    );
    expect(calls).toBe(2);
  });

  it('remplace une question déjà posée dans l’historique par un angle nouveau', async () => {
    let calls = 0;
    const repeated = {
      ...validOutput,
      reply: {
        ja: 'いいですね。どんな料理を作りますか？',
        reading: 'Ii desu ne. Donna ryouri o tsukurimasu ka?',
      },
    };
    const fresh = {
      ...validOutput,
      reply: {
        ja: 'カレーなら、野菜をたくさん入れるとおいしいですよ。',
        reading: 'Karee nara, yasai o takusan ireru to oishii desu yo.',
      },
    };
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async () => {
          calls += 1;
          return JSON.stringify(calls === 1 ? repeated : fresh);
        }),
      ),
    );

    const result = await generate(
      {
        ...session,
        turns: [
          {
            transcript: '料理が好きです。',
            replyJson: {
              ...validOutput,
              reply: {
                ja: 'どんな料理を作りますか？',
                reading: 'Donna ryouri o tsukurimasu ka?',
              },
            },
          },
        ],
      },
      'カレーを作ります。',
      constraints,
    );

    expect(calls).toBe(2);
    expect(result.reply.ja).toBe(fresh.reply.ja);
  });

  it('accepte une action de scène naturelle sans question de suivi', async () => {
    const sceneOutput = {
      ...validOutput,
      reply: {
        ja: 'ありがとうございます。お席はこちらです。メニューをどうぞ。',
        reading: 'Arigatou gozaimasu. Oseki wa kochira desu. Menyuu o douzo.',
      },
    };
    let calls = 0;
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async () => {
          calls += 1;
          return JSON.stringify(sceneOutput);
        }),
      ),
    );

    const result = await generate(
      { ...session, scenario: 'restaurant' },
      '二人です。',
      constraints,
    );

    expect(calls).toBe(1);
    expect(result.reply.ja).toBe(sceneOutput.reply.ja);
  });

  it('ne confond pas une instruction française avec une phrase japonaise en romaji', async () => {
    let calls = 0;
    const generate = generateWith(
      createOrchestrator(
        llmFrom(async () => {
          calls += 1;
          return JSON.stringify(validOutput);
        }),
      ),
    );

    await generate(session, 'je veux pratiquer la forme en te iru', constraints);

    expect(calls).toBe(1);
  });
});

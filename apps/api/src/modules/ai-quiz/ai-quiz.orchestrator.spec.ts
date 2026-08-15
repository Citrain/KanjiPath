import type { AiQuizDraft } from '@kanjipath/contracts';
import {
  aiQuizDraftSchema,
  aiQuizModelOutputJsonSchema,
  aiQuizModelOutputSchema,
  aiQuizModelQuestionSchema,
  createAiQuizModelQuestionJsonSchema,
} from '@kanjipath/contracts';
import { describe, expect, it, vi } from 'vitest';
import {
  AiQuizOrchestrator,
  buildDeterministicReadingQuestion,
  buildQuizPrompt,
  gradeAiQuizAnswer,
  normalizeQuizInput,
  normalizeQuizRenderers,
  parseAiQuizModelJson,
  selectRelevantConstraints,
} from './ai-quiz.orchestrator';

const choice = {
  key: 'q1',
  kind: 'choice' as const,
  type: 'conjugation_qcm' as const,
  skill: 'grammar' as const,
  difficulty: 1 as const,
  stage: 'warmup' as const,
  prompt: { title: 'Choisissez la forme passée.', japanese: 'たべます → ?' },
  choices: [
    { id: 'a', label: 'たべました' },
    { id: 'b', label: 'たべます' },
    { id: 'c', label: 'たべません' },
  ],
  correct: { choiceId: 'a' },
  hint: 'La forme polie passée finit par ました.',
  explanation: {
    title: 'Passé poli',
    bodyFr: 'たべます devient たべました.',
    takeaway: 'ます devient ました.',
  },
  tags: ['passé'],
};
const order = {
  key: 'q2',
  kind: 'order' as const,
  type: 'sentence_order' as const,
  skill: 'context' as const,
  difficulty: 1 as const,
  stage: 'practice' as const,
  prompt: { title: 'Remettez la phrase en ordre.' },
  tiles: [
    { id: 'a', label: 'わたしは' },
    { id: 'b', label: 'たべました' },
    { id: 'c', label: 'すしを' },
  ],
  correct: { orderedTileIds: ['a', 'c', 'b'] },
  hint: 'Le complément en を vient avant le verbe.',
  explanation: {
    title: 'Ordre japonais',
    bodyFr: 'Le verbe termine la phrase.',
    takeaway: 'Sujet, complément, verbe.',
  },
  tags: ['ordre'],
};
const match = {
  key: 'q3',
  kind: 'match' as const,
  type: 'pair_match' as const,
  skill: 'vocabulary' as const,
  difficulty: 1 as const,
  stage: 'practice' as const,
  prompt: { title: 'Associez chaque mot à son sens.' },
  leftItems: [
    { id: 'mizu', label: 'みず' },
    { id: 'hon', label: 'ほん' },
    { id: 'eki', label: 'えき' },
  ],
  rightItems: [
    { id: 'water', label: 'eau' },
    { id: 'book', label: 'livre' },
    { id: 'station', label: 'gare' },
  ],
  correct: {
    pairings: [
      { leftId: 'mizu', rightId: 'water' },
      { leftId: 'hon', rightId: 'book' },
      { leftId: 'eki', rightId: 'station' },
    ],
  },
  hint: 'Ce sont des mots N5 fréquents.',
  explanation: {
    title: 'Vocabulaire utile',
    bodyFr: 'Chaque mot désigne un objet ou un lieu courant.',
    takeaway: 'Apprenez les mots dans les deux sens.',
  },
  tags: ['vocabulaire'],
};

function modelQuiz() {
  return {
    questions: Array.from({ length: 5 }, (_, index) => ({
      type: 'conjugation_qcm',
      japanese: `食べます ${index + 1} → ＿＿＿`,
      kana: `たべます ${index + 1} → ＿＿＿`,
      options: ['たべました', 'たべます', 'たべません', 'たべましょう'],
      answerIndex: 0,
      explanationFr: '食べます devient 食べました.',
    })),
  };
}

function modelQuestionContent(index: number) {
  const { type: _type, ...question } = modelQuiz().questions[index]!;
  return question;
}

describe('quiz IA local', () => {
  it('lit les snapshots historiques sans lectures kana complètes', () => {
    const legacyChoice = {
      ...choice,
      prompt: { title: 'Choisissez le passé.', japanese: '食べます → ?' },
      choices: [
        { id: 'a', label: '食べました' },
        { id: 'b', label: '食べます' },
        { id: 'c', label: '食べません' },
      ],
    };
    const legacyOrder = {
      ...order,
      key: 'q2',
      skill: 'grammar' as const,
      prompt: { title: 'Remettez la phrase en ordre.', japanese: '彼は二時頃来た。' },
      tiles: [
        { id: 'a', label: '彼は' },
        { id: 'b', label: '二時頃' },
        { id: 'c', label: '来た。' },
      ],
    };
    const legacyQuiz = {
      schemaVersion: 1,
      title: 'Passé au restaurant',
      subtitle: 'Cinq étapes',
      level: 'N5',
      theme: 'restaurant',
      estimatedMinutes: 5,
      skills: ['grammar', 'context'],
      intro: { japanese: '過去形を練習しましょう。', translationFr: 'Commençons.' },
      questions: [
        legacyChoice,
        legacyOrder,
        { ...legacyChoice, key: 'q3' },
        { ...legacyChoice, key: 'q4' },
        { ...legacyChoice, key: 'q5' },
      ],
    };

    expect(aiQuizDraftSchema.safeParse(legacyQuiz).success).toBe(true);
  });

  it('accepte seulement un objet JSON brut complet', () => {
    expect(parseAiQuizModelJson('{"phrase":"＿＿＿＿"}')).toEqual({ phrase: '＿＿＿＿' });
    expect(() => parseAiQuizModelJson('Préface {"phrase":"＿＿＿＿"}')).toThrow();
    expect(() => parseAiQuizModelJson(String.raw`{"phrase":"＿＿\_＿＿"}`)).toThrow();
  });

  it('valide un quiz fermé et refuse une écoute sans texte VOICEVOX', () => {
    const questions = [
      choice,
      order,
      { ...choice, key: 'q3' },
      { ...order, key: 'q4' },
      { ...choice, key: 'q5' },
    ];
    const quiz: AiQuizDraft = {
      schemaVersion: 1,
      title: 'Passé au restaurant',
      subtitle: 'Cinq étapes',
      level: 'N5',
      theme: 'restaurant',
      estimatedMinutes: 5,
      skills: ['grammar', 'context'],
      intro: { japanese: 'がんばりましょう。', translationFr: 'Commençons.' },
      questions,
    };
    expect(aiQuizDraftSchema.safeParse(quiz).success).toBe(true);
    expect(
      aiQuizDraftSchema.safeParse({
        ...quiz,
        questions: [{ ...choice, type: 'listening_qcm' }, ...questions.slice(1)],
      }).success,
    ).toBe(false);
  });

  it('corrige sans LLM les choix et l’ordre exact des tuiles', () => {
    expect(gradeAiQuizAnswer(choice, { choiceId: 'a' })).toBe(true);
    expect(gradeAiQuizAnswer(choice, { choiceId: 'b' })).toBe(false);
    expect(gradeAiQuizAnswer(order, { orderedTileIds: ['a', 'c', 'b'] })).toBe(true);
    expect(gradeAiQuizAnswer(order, { orderedTileIds: ['a', 'b', 'c'] })).toBe(false);
    expect(gradeAiQuizAnswer(match, { pairings: match.correct.pairings })).toBe(true);
    expect(
      gradeAiQuizAnswer(match, {
        pairings: [
          { leftId: 'mizu', rightId: 'water' },
          { leftId: 'mizu', rightId: 'water' },
          { leftId: 'hon', rightId: 'book' },
        ],
      }),
    ).toBe(false);
  });

  it('borne le prompt au contrat, au niveau et aux formats sélectionnés', () => {
    const prompt = buildQuizPrompt(
      {
        prompt: 'Réviser le passé au restaurant',
        level: 'N5',
        questionCount: 5,
        types: ['conjugation_qcm'],
        skills: ['grammar'],
      },
      { vocabulary: [{ word: '食べる', reading: 'たべる', meaningFr: 'manger' }], sentences: [] },
    );
    expect(prompt).toContain('comporte 5 questions');
    expect(prompt).toContain('MISSION OBLIGATOIRE');
    expect(prompt).toContain('Réviser le passé au restaurant');
    expect(prompt).toContain('Chaque question doit entraîner directement ce sujet');
    expect(prompt).toContain('conjugation_qcm');
    expect(prompt).toContain('un seul objet atomique');
    expect(prompt).toContain('trou exact ＿＿＿');
    expect(prompt).toContain('lecture complète sans kanji');
    expect(prompt).toContain('Ne mets jamais la lecture entre parenthèses');
    expect(prompt).not.toContain('ASSEMBLAGE DE CONJUGAISON uniquement');
    expect(prompt).not.toContain('ORDRE DE PHRASE uniquement');
    expect(prompt).not.toContain('ASSOCIATION uniquement');
    expect(prompt).not.toContain('listening_qcm, skill vaut obligatoirement');
    expect(prompt).toContain('食べる');
  });

  it('écarte le référentiel sans rapport quand la mission possède des correspondances', () => {
    const selected = selectRelevantConstraints(
      {
        vocabulary: [
          { word: '駅', reading: 'えき', meaningFr: 'gare' },
          { word: '料理', reading: 'りょうり', meaningFr: 'cuisine' },
          { word: '電車', reading: 'でんしゃ', meaningFr: 'train' },
        ],
        sentences: [
          { japanese: '駅へ行きます。', translationFr: 'Je vais à la gare.' },
          { japanese: '料理を注文します。', translationFr: 'Je commande un plat au restaurant.' },
        ],
      },
      'Commander au restaurant et parler de cuisine',
    );

    expect(selected.vocabulary).toEqual([
      { word: '料理', reading: 'りょうり', meaningFr: 'cuisine' },
    ]);
    expect(selected.sentences).toEqual([
      { japanese: '料理を注文します。', translationFr: 'Je commande un plat au restaurant.' },
    ]);
  });

  it('ajoute les compétences nécessaires aux formats sélectionnés', () => {
    const input = normalizeQuizInput({
      prompt: 'Réviser au restaurant',
      level: 'N5',
      questionCount: 5,
      types: ['dialogue_next_line', 'listening_qcm', 'reading_qcm'],
      skills: ['grammar'],
    });
    expect(input.skills).toEqual(['grammar', 'context', 'listening', 'reading']);
  });

  it('exige les lectures kana parallèles dans la sortie du modèle', () => {
    const valid = {
      questions: Array.from({ length: 5 }, (_, index) => ({
        type: 'meaning_qcm',
        japanese: `水 ${index + 1}`,
        kana: `みず ${index + 1}`,
        options: ['eau', 'feu', 'terre', 'air'],
        answerIndex: 0,
        explanationFr: '水 signifie eau.',
      })),
    };
    expect(aiQuizModelOutputSchema.safeParse(valid).success).toBe(true);
    const missingKana = structuredClone(valid);
    delete missingKana.questions[0]?.kana;
    expect(aiQuizModelOutputSchema.safeParse(missingKana).success).toBe(false);
    const equivalentOptions = structuredClone(valid);
    equivalentOptions.questions[0]!.options = ['Eau', ' eau ', 'terre', 'air'];
    expect(aiQuizModelOutputSchema.safeParse(equivalentOptions).success).toBe(false);
    const duplicatedQuestions = structuredClone(valid);
    duplicatedQuestions.questions[1] = structuredClone(duplicatedQuestions.questions[0]!);
    expect(aiQuizModelOutputSchema.safeParse(duplicatedQuestions).success).toBe(false);
    expect(aiQuizModelOutputSchema.safeParse({ ...valid, unexpected: 'interdit' }).success).toBe(
      false,
    );
    expect(aiQuizModelOutputJsonSchema).toMatchObject({ type: 'object' });
  });

  it('transmet à Ollama un schéma atomique de question complète', () => {
    const atomicSchema = createAiQuizModelQuestionJsonSchema() as {
      properties: Record<string, unknown>;
    };
    const schema = JSON.stringify(atomicSchema);

    expect(atomicSchema.properties).not.toHaveProperty('type');
    expect(schema).not.toContain('"questions"');
    expect(atomicSchema.properties).toHaveProperty('options');
    expect(atomicSchema.properties).toHaveProperty('answerIndex');
    expect(schema).not.toContain('"skill"');
  });

  it('regénère seulement la question invalide puis matérialise le quiz', async () => {
    let firstQuestion = true;
    const generate = vi.fn(async (systemPrompt: string) => {
      const match = /Question (\d+) sur/.exec(systemPrompt);
      const index = Number(match?.[1] ?? 1) - 1;
      if (firstQuestion) {
        firstQuestion = false;
        const { answerIndex: _answerIndex, ...invalid } = modelQuestionContent(index);
        return JSON.stringify(invalid);
      }
      return JSON.stringify(modelQuestionContent(index));
    });
    const orchestrator = new AiQuizOrchestrator(
      {} as never,
      { values: { enabled: true } } as never,
      { health: async () => ({ available: true, detail: null }), generate },
      {} as never,
    );
    const input = normalizeQuizInput({
      prompt: 'Réviser le passé au restaurant',
      level: 'N5',
      questionCount: 5,
      types: ['conjugation_qcm'],
      skills: ['grammar'],
    });
    const run = (
      orchestrator as unknown as {
        generate(
          input: typeof input,
          constraints: { vocabulary: []; sentences: [] },
        ): Promise<AiQuizDraft>;
      }
    ).generate.bind(orchestrator);

    const quiz = await run(input, { vocabulary: [], sentences: [] });

    expect(generate).toHaveBeenCalledTimes(6);
    expect(generate.mock.calls[1]?.[0]).toContain('sortie précédente a été rejetée');
    expect(generate.mock.calls[0]?.[0]).toContain('Question 1 sur 5');
    expect(generate.mock.calls[2]?.[0]).toContain('Question 2 sur 5');
    expect(quiz.questions[0]).toMatchObject({
      skill: 'grammar',
      difficulty: 1,
      stage: 'warmup',
    });
    expect(quiz.questions[4]).toMatchObject({ difficulty: 3, stage: 'finale' });
  });

  it('abandonne une question après quatre tentatives invalides', async () => {
    const generate = vi.fn(async () => '{}');
    const orchestrator = new AiQuizOrchestrator(
      {} as never,
      { values: { enabled: true } } as never,
      { health: async () => ({ available: true, detail: null }), generate },
      {} as never,
    );
    const input = normalizeQuizInput({
      prompt: 'Réviser le passé au restaurant',
      level: 'N5',
      questionCount: 5,
      types: ['conjugation_qcm'],
      skills: ['grammar'],
    });
    const run = (
      orchestrator as unknown as {
        generate(
          input: typeof input,
          constraints: { vocabulary: []; sentences: [] },
        ): Promise<AiQuizDraft>;
      }
    ).generate.bind(orchestrator);

    await expect(run(input, { vocabulary: [], sentences: [] })).rejects.toThrow(
      'après quatre tentatives',
    );
    expect(generate).toHaveBeenCalledTimes(4);
  });

  it('refuse les métadonnées applicatives et les choix QCM avec kanji', () => {
    const readingQuestion = {
      type: 'reading_qcm',
      japanese: 'お金',
      kana: 'おかね',
      options: ['おかね', 'おちゃ', 'みず', 'ごはん'],
      answerIndex: 0,
      explanationFr: 'お金 se lit おかね.',
    };
    expect(aiQuizModelQuestionSchema.safeParse(readingQuestion).success).toBe(true);
    expect(
      aiQuizModelQuestionSchema.safeParse({ ...readingQuestion, skill: 'reading' }).success,
    ).toBe(false);
    expect(
      aiQuizModelQuestionSchema.safeParse({
        ...readingQuestion,
        options: ['okane', 'ocha', 'mizu', 'gohan'],
      }).success,
    ).toBe(false);
    expect(
      aiQuizModelQuestionSchema.safeParse({ ...readingQuestion, japanese: 'おかね' }).success,
    ).toBe(false);
    expect(
      aiQuizModelQuestionSchema.safeParse({
        ...readingQuestion,
        options: ['おちゃ', 'みず', 'ごはん', 'えき'],
      }).success,
    ).toBe(false);
    expect(
      aiQuizModelQuestionSchema.safeParse({
        ...readingQuestion,
        options: ['お金', 'おちゃ', 'みず'],
      }).success,
    ).toBe(false);
  });

  it('construit les distracteurs de lecture depuis des lectures publiées distinctes', () => {
    const question = buildDeterministicReadingQuestion(
      {
        vocabulary: [{ word: '食べる', reading: 'たべる', meaningFr: 'manger' }],
        sentences: [],
        readingVocabulary: [
          { word: '飲む', reading: 'のむ', meaningFr: 'boire' },
          { word: '読む', reading: 'よむ', meaningFr: 'lire' },
          { word: '行く', reading: 'いく', meaningFr: 'aller' },
        ],
      },
      [],
      1,
    );

    expect(question).not.toBeNull();
    if (!question) return;
    expect(question.type).toBe('reading_qcm');
    expect(question.options).toHaveLength(4);
    expect(new Set(question.options).size).toBe(4);
    expect(question.options[question.answerIndex]).toBe('たべる');
  });

  it('refuse une conjugaison qui affiche déjà la réponse au lieu du trou', () => {
    const leaked = {
      type: 'conjugation_qcm',
      japanese: 'おなかが すきましたから、パンを たべました。',
      kana: 'おなかが すきましたから、ぱんを たべました。',
      options: ['たべます', 'たべました', 'たべません', 'たべましたか'],
      answerIndex: 1,
      explanationFr: 'La phrase demande le passé poli.',
    };
    const valid = {
      ...leaked,
      japanese: 'おなかが すきましたから、パンを ＿＿＿。',
      kana: 'おなかが すきましたから、ぱんを ＿＿＿。',
    };

    expect(aiQuizModelQuestionSchema.safeParse(leaked).success).toBe(false);
    expect(aiQuizModelQuestionSchema.safeParse(valid).success).toBe(true);
  });

  it('normalise seulement les variantes structurelles connues de gemma4', () => {
    const normalized = normalizeQuizRenderers(
      {
        schemaVersion: 1,
        title: 'Adjectifs',
        subtitle: 'Test',
        level: 'N5',
        theme: 'test',
        estimatedMinutes: 5,
        skills: ['vocabulary'],
        intro: { japanese: 'はい。', translationFr: 'Oui.' },
        questions: [
          {
            ...choice,
            prompt: { title: 'Un opposé', japanese: '' },
          },
          {
            ...match,
            key: 'q2',
            leftItems: undefined,
            rightItems: undefined,
            prompt: {
              title: 'Associez les contraires',
              leftItems: match.leftItems,
              rightItems: match.rightItems,
            },
          },
          { ...choice, key: 'q3' },
          { ...choice, key: 'q4' },
          { ...choice, key: 'q5' },
        ],
      },
      {
        prompt: 'Réviser les adjectifs',
        level: 'N5',
        questionCount: 5,
        types: ['conjugation_qcm', 'pair_match'],
        skills: ['grammar', 'vocabulary'],
      },
    );

    const parsed = aiQuizDraftSchema.safeParse(normalized);
    expect(parsed.success).toBe(true);
    if (!parsed.success) return;
    expect(parsed.data.questions[0]?.prompt.japanese).toBeUndefined();
    const matching = parsed.data.questions[1];
    expect(matching?.kind).toBe('match');
    if (matching?.kind === 'match') {
      expect(matching.leftItems).toHaveLength(3);
      expect(matching.prompt).not.toHaveProperty('leftItems');
    }
  });

  it('récupère un identifiant préfixé par le bruit Unicode de gemma4', () => {
    const normalized = normalizeQuizRenderers(
      {
        schemaVersion: 1,
        title: 'Test',
        subtitle: 'Test',
        level: 'N5',
        theme: 'test',
        estimatedMinutes: 5,
        skills: ['grammar'],
        intro: { japanese: 'はい。', translationFr: 'Oui.' },
        questions: [
          {
            ...choice,
            choices: [
              { '<0xA0>id': 'a', label: 'たべました' },
              { id: 'b', label: 'たべます' },
              { id: 'c', label: 'たべません' },
            ],
          },
          { ...choice, key: 'q2' },
          { ...choice, key: 'q3' },
          { ...choice, key: 'q4' },
          { ...choice, key: 'q5' },
        ],
      },
      {
        prompt: 'test',
        level: 'N5',
        questionCount: 5,
        types: ['conjugation_qcm'],
        skills: ['grammar'],
      },
    );
    expect(aiQuizDraftSchema.safeParse(normalized).success).toBe(true);
  });

  it('rejette la donnée pédagogique absente mais ignore une clé LLM supplémentaire', () => {
    const prompt = buildQuizPrompt(
      {
        prompt: 'Réviser les adjectifs',
        level: 'N5',
        questionCount: 5,
        types: ['meaning_qcm'],
        skills: ['vocabulary'],
      },
      { vocabulary: [], sentences: [] },
    );
    expect(prompt).toContain('Aucun identifiant');
  });
});

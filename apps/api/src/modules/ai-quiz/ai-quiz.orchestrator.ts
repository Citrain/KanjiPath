import type {
  AiQuizAnswerResult,
  AiQuizDraft,
  AiQuizFinishResult,
  AiQuizModelOutput,
  AiQuizQcmType,
  AiQuizSessionDto,
  CreateAiQuizInput,
  SubmitAiQuizAnswerInput,
} from '@kanjipath/contracts';
import {
  AI_QUIZ_REQUIRED_SKILL_BY_TYPE,
  aiQuizDraftSchema,
  aiQuizModelOutputSchema,
  aiQuizModelQuestionSchema,
  createAiQuizModelQuestionJsonSchema,
} from '@kanjipath/contracts';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { ConversationConfig } from '../conversation/conversation.config';
import {
  JAPANESE_TTS_PROVIDER,
  type JapaneseTtsProvider,
  LLM_PROVIDER,
  type LlmProvider,
} from '../conversation/conversation.providers';

export interface QuizConstraints {
  vocabulary: { word: string; reading: string; meaningFr: string }[];
  sentences: { japanese: string; translationFr: string }[];
  readingVocabulary?: { word: string; reading: string; meaningFr: string }[];
}

type QuestionGenerationResult =
  | { success: true; question: AiQuizModelOutput['questions'][number] }
  | { success: false; error: string };

@Injectable()
export class AiQuizOrchestrator {
  private readonly logger = new Logger(AiQuizOrchestrator.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConversationConfig,
    @Inject(LLM_PROVIDER) private readonly llm: LlmProvider,
    @Inject(JAPANESE_TTS_PROVIDER) private readonly japaneseTts: JapaneseTtsProvider,
  ) {}

  async create(userId: string, input: CreateAiQuizInput): Promise<AiQuizSessionDto> {
    const normalizedInput = normalizeQuizInput(input);
    const constraints = await this.constraints(normalizedInput.level, normalizedInput.prompt);
    const draft = await this.generate(normalizedInput, constraints);
    const session = await this.prisma.aiQuizSession.create({
      data: {
        userId,
        prompt: normalizedInput.prompt,
        level: normalizedInput.level,
        questionCount: normalizedInput.questionCount,
        typesJson: normalizedInput.types as unknown as Prisma.InputJsonValue,
        skillsJson: normalizedInput.skills as unknown as Prisma.InputJsonValue,
        quizJson: draft as unknown as Prisma.InputJsonValue,
      },
    });
    return this.toDto(session);
  }

  async history(userId: string): Promise<AiQuizSessionDto[]> {
    const sessions = await this.prisma.aiQuizSession.findMany({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      take: 20,
    });
    return sessions.map((session) => this.toDto(session));
  }

  async get(userId: string, id: string): Promise<AiQuizSessionDto> {
    return this.toDto(await this.session(userId, id));
  }

  async answer(
    userId: string,
    id: string,
    input: SubmitAiQuizAnswerInput,
  ): Promise<AiQuizAnswerResult> {
    const session = await this.session(userId, id);
    if (session.status === 'finished') throw new BadRequestException('Ce quiz est terminé');
    const quiz = parseQuiz(session.quizJson);
    const question = quiz.questions.find((item) => item.key === input.questionKey);
    if (!question) throw new NotFoundException('Question introuvable');
    const correct = gradeAiQuizAnswer(question, input.answer);
    try {
      const updated = await this.prisma.$transaction(async (tx) => {
        await tx.aiQuizAnswer.create({
          data: {
            sessionId: session.id,
            questionKey: question.key,
            answerJson: input.answer as unknown as Prisma.InputJsonValue,
            wasCorrect: correct,
            responseTimeMs: input.responseTimeMs,
          },
        });
        return tx.aiQuizSession.update({
          where: { id: session.id },
          data: {
            answeredCount: { increment: 1 },
            correctCount: correct ? { increment: 1 } : undefined,
          },
        });
      });
      return {
        correct,
        correctAnswer: question.correct,
        explanation: question.explanation,
        answeredCount: updated.answeredCount,
        correctCount: updated.correctCount,
      };
    } catch (error) {
      if (isUniqueViolation(error))
        throw new BadRequestException('Cette question a déjà reçu une réponse');
      throw error;
    }
  }

  async finish(userId: string, id: string): Promise<AiQuizFinishResult> {
    const session = await this.session(userId, id);
    const endedAt = session.endedAt ?? new Date();
    const updated = await this.prisma.aiQuizSession.update({
      where: { id: session.id },
      data: { status: 'finished', endedAt },
    });
    return {
      id: updated.id,
      answeredCount: updated.answeredCount,
      correctCount: updated.correctCount,
      accuracy: updated.answeredCount === 0 ? 0 : updated.correctCount / updated.answeredCount,
      endedAt: updated.endedAt?.toISOString() ?? endedAt.toISOString(),
    };
  }

  async audio(userId: string, id: string, key: string) {
    const session = await this.session(userId, id);
    const question = parseQuiz(session.quizJson).questions.find((item) => item.key === key);
    if (!question?.prompt.audioText) throw new NotFoundException('Audio de question introuvable');
    try {
      const speech = await this.japaneseTts.synthesize(question.prompt.audioText, 0.9, 1);
      if (speech.bytes.length === 0) throw new Error('Audio vide');
      return { mimeType: speech.mimeType, base64: speech.bytes.toString('base64') };
    } catch {
      throw new ServiceUnavailableException('VOICEVOX est indisponible. Réessayez l’écoute.');
    }
  }

  private async session(userId: string, id: string) {
    const session = await this.prisma.aiQuizSession.findFirst({ where: { id, userId } });
    if (!session) throw new NotFoundException('Quiz IA introuvable');
    return session;
  }

  private async constraints(
    level: CreateAiQuizInput['level'],
    mission: string,
  ): Promise<QuizConstraints> {
    const levels = ['N5', 'N4', 'N3', 'N2', 'N1'].slice(
      0,
      ['N5', 'N4', 'N3', 'N2', 'N1'].indexOf(level) + 1,
    );
    const [vocabulary, sentences] = await Promise.all([
      this.prisma.vocabulary.findMany({
        where: { editorialStatus: 'published', estimatedLevel: { in: levels as never[] } },
        orderBy: { frequencyRank: 'asc' },
        take: 300,
        select: { writtenForm: true, reading: true, meaningFr: true },
      }),
      this.prisma.sentence.findMany({
        where: { editorialStatus: 'published', difficulty: { in: levels as never[] } },
        take: 120,
        select: { japanese: true, translationFr: true },
      }),
    ]);
    const candidates = {
      vocabulary: vocabulary.map((item) => ({
        word: item.writtenForm,
        reading: item.reading,
        meaningFr: item.meaningFr,
      })),
      sentences,
    };
    return {
      ...selectRelevantConstraints(candidates, mission),
      readingVocabulary: candidates.vocabulary,
    };
  }

  private async generate(
    input: CreateAiQuizInput,
    constraints: QuizConstraints,
  ): Promise<AiQuizDraft> {
    if (!this.config.values.enabled) {
      throw new ServiceUnavailableException({
        code: 'LOCAL_AI_DISABLED',
        message:
          'L’IA locale est désactivée. Ajoutez LOCAL_AI_ENABLED=true dans .env puis redémarrez l’API.',
      });
    }
    const basePrompt = buildQuizPrompt(input, constraints);
    const questions: AiQuizModelOutput['questions'] = [];
    const types = plannedQuestionTypes(input);
    for (const [index, type] of types.entries()) {
      if (type === 'reading_qcm') {
        const question = buildDeterministicReadingQuestion(constraints, questions, index);
        if (!question) {
          throw new ServiceUnavailableException({
            code: 'AI_QUIZ_READING_POOL_TOO_SMALL',
            message: 'Le référentiel ne contient pas assez de lectures distinctes pour ce quiz.',
          });
        }
        questions.push(question);
        continue;
      }
      const prompt = buildQuizQuestionPrompt(basePrompt, type, index, types.length, questions);
      let generated: QuestionGenerationResult = {
        success: false,
        error: 'Aucune tentative effectuée',
      };
      for (let attempt = 0; attempt < 4 && !generated.success; attempt += 1) {
        const attemptPrompt =
          attempt === 0
            ? prompt
            : buildQuizRetryPrompt(
                prompt,
                `${generated.error}. Tentative ${attempt + 1}/4 : génère une question différente et conforme.`,
              );
        generated = await this.generateQuestion(
          attemptPrompt,
          input.prompt,
          type,
          questions,
          index,
        );
        if (!generated.success) {
          this.logger.warn(
            `Question Quiz IA ${index + 1} refusée (${attempt + 1}/4): ${generated.error}`,
          );
        }
      }
      if (!generated.success) {
        throw new ServiceUnavailableException({
          code: 'AI_QUIZ_INVALID_OUTPUT',
          message: `Le modèle local n’a pas produit une question ${index + 1} valide après quatre tentatives.`,
          details: generated.error,
        });
      }
      questions.push(generated.question);
    }
    const quiz = parseGeneratedQuiz(JSON.stringify({ questions }), input);
    if (quiz) return quiz;
    throw new ServiceUnavailableException({
      code: 'AI_QUIZ_INVALID_OUTPUT',
      message: 'Les questions valides n’ont pas pu être matérialisées en quiz.',
    });
  }

  private async generateQuestion(
    prompt: string,
    mission: string,
    type: AiQuizQcmType,
    previous: AiQuizModelOutput['questions'],
    index: number,
  ): Promise<QuestionGenerationResult> {
    let raw: string;
    try {
      raw = await this.llm.generate(
        prompt,
        buildQuizUserMessage(mission),
        [],
        this.generationOptions(),
      );
    } catch (error) {
      throw new ServiceUnavailableException({
        code: 'OLLAMA_UNAVAILABLE',
        message: `Ollama n’a pas terminé la question ${index + 1}.`,
        details: messageOf(error),
      });
    }
    const parsed = parseGeneratedQuestion(raw, type, previous);
    if (parsed.success) return parsed;
    return {
      success: false,
      error: `${parsed.error} | sortie=${JSON.stringify(raw.slice(0, 2_000))}`,
    };
  }

  private generationOptions() {
    return {
      maxTokens: 1_024,
      jsonSchema: createAiQuizModelQuestionJsonSchema(),
      temperature: 0,
    };
  }

  private toDto(session: {
    id: string;
    prompt: string;
    level: string;
    questionCount: number;
    typesJson: Prisma.JsonValue;
    skillsJson: Prisma.JsonValue;
    quizJson: Prisma.JsonValue;
    status: string;
    answeredCount: number;
    correctCount: number;
    startedAt: Date;
    endedAt: Date | null;
  }): AiQuizSessionDto {
    const quiz = parseQuiz(session.quizJson);
    return {
      id: session.id,
      prompt: session.prompt,
      level: session.level as AiQuizSessionDto['level'],
      questionCount: session.questionCount,
      types: strings(session.typesJson),
      skills: strings(session.skillsJson) as AiQuizSessionDto['skills'],
      status: session.status as AiQuizSessionDto['status'],
      quiz: {
        ...quiz,
        questions: quiz.questions.map(({ correct: _correct, prompt, ...question }) => {
          const { audioText: _audioText, ...publicPrompt } = prompt;
          return { ...question, prompt: publicPrompt };
        }),
      },
      answeredCount: session.answeredCount,
      correctCount: session.correctCount,
      startedAt: session.startedAt.toISOString(),
      endedAt: session.endedAt?.toISOString() ?? null,
    };
  }
}

export function buildQuizPrompt(input: CreateAiQuizInput, constraints: QuizConstraints): string {
  return [
    'Crée un QCM de japonais pour un apprenant francophone.',
    '# MISSION OBLIGATOIRE',
    `Sujet exact : ${JSON.stringify(input.prompt)}.`,
    'Le sujet est la contrainte pédagogique principale. Chaque question doit entraîner directement ce sujet, sa situation, son vocabulaire ou sa grammaire.',
    'Ne produis jamais un quiz générique ni un quiz centré sur un autre thème. Si le sujet décrit une scène, conserve cette scène dans les phrases et les choix.',
    `Niveau maximal : ${input.level}.`,
    `Le quiz final comporte ${input.questionCount} questions et l’application planifie les types ${JSON.stringify(input.types)}.`,
    'Tu produis un seul objet atomique par appel. Ne retourne jamais un tableau.',
    'japanese contient le mot ou la phrase japonaise. Pour listening_qcm, il contient le texte à prononcer.',
    'kana contient la lecture complète sans kanji. Ne mets jamais la lecture entre parenthèses dans japanese.',
    'Pour cloze_qcm et conjugation_qcm, japanese et kana contiennent obligatoirement le trou exact ＿＿＿ à la place de la réponse. N’affiche jamais la forme correcte dans la phrase.',
    'options contient exactement quatre réponses visuellement différentes, sans aucun doublon.',
    'answerIndex vaut 0, 1, 2 ou 3 et désigne l’unique bonne réponse.',
    'explanationFr explique brièvement pourquoi cette réponse est correcte.',
    'Aucun autre champ. Aucun identifiant. Aucun markdown. Aucun commentaire avant ou après le JSON.',
    'Le référentiel suivant est un support facultatif filtré pour la mission, pas un sujet de remplacement.',
    `Vocabulaire pertinent : ${JSON.stringify(constraints.vocabulary)}.`,
    `Phrases pertinentes : ${JSON.stringify(constraints.sentences)}.`,
    'Respecte exactement les champs demandés par l’appel et arrête immédiatement la réponse après }.',
  ].join('\n');
}

function buildQuizQuestionPrompt(
  basePrompt: string,
  type: AiQuizQcmType,
  index: number,
  count: number,
  previous: AiQuizModelOutput['questions'],
): string {
  return [
    basePrompt,
    '# QUESTION À PRODUIRE',
    `Question ${index + 1} sur ${count}. Type imposé par l’application : ${type}.`,
    questionTypeInstruction(type),
    previous.length > 0
      ? `Sujets japonais déjà utilisés, à ne pas répéter : ${JSON.stringify(previous.map((question) => question.japanese))}.`
      : 'Aucune question précédente.',
    'Retourne maintenant un unique objet JSON avec exactement japanese, kana, options, answerIndex et explanationFr.',
  ].join('\n');
}

function questionTypeInstruction(type: AiQuizQcmType): string {
  if (type === 'reading_qcm')
    return 'Teste la lecture d’un seul mot contenant un kanji. japanese est ce mot seul; kana est sa lecture exacte. Une seule option est égale à kana.';
  if (type === 'cloze_qcm')
    return 'Crée une phrase à trou avec ＿＿＿ dans japanese et kana. Les quatre options sont des complétions distinctes en kana.';
  if (type === 'conjugation_qcm')
    return 'Teste une conjugaison avec ＿＿＿ dans japanese et kana. Les quatre options sont des formes verbales distinctes en kana.';
  if (type === 'listening_qcm')
    return 'japanese est le texte à prononcer; les quatre options françaises testent sa compréhension.';
  if (type === 'dialogue_next_line')
    return 'japanese présente le dialogue; les quatre options françaises décrivent la prochaine réplique naturelle.';
  if (type === 'contrast_qcm')
    return 'Teste une nuance liée à la mission avec quatre interprétations françaises distinctes.';
  return 'Teste le sens du texte japonais avec quatre réponses françaises distinctes.';
}

function plannedQuestionTypes(input: CreateAiQuizInput): AiQuizQcmType[] {
  return Array.from(
    { length: input.questionCount },
    (_, index) => input.types[index % input.types.length]!,
  );
}

export function buildDeterministicReadingQuestion(
  constraints: QuizConstraints,
  previous: AiQuizModelOutput['questions'],
  index: number,
): AiQuizModelOutput['questions'][number] | null {
  const vocabulary = uniqueVocabulary([
    ...constraints.vocabulary,
    ...(constraints.readingVocabulary ?? []),
  ]).filter((item) => hasKanjiText(item.word) && isKanaReading(item.reading));
  const usedWords = new Set(previous.map((question) => question.japanese));
  const target = vocabulary.find((item) => !usedWords.has(item.word));
  if (!target) return null;
  const distractors = vocabulary
    .filter((item) => item.reading !== target.reading)
    .map((item) => item.reading)
    .filter((reading, readingIndex, readings) => readings.indexOf(reading) === readingIndex)
    .slice(0, 3);
  if (distractors.length < 3) return null;
  const answerIndex = index % 4;
  const options = [...distractors];
  options.splice(answerIndex, 0, target.reading);
  return aiQuizModelQuestionSchema.parse({
    type: 'reading_qcm',
    japanese: target.word,
    kana: target.reading,
    options,
    answerIndex,
    explanationFr: `${target.word} se lit ${target.reading}${target.meaningFr ? ` et signifie « ${target.meaningFr} »` : ''}.`,
  });
}

function uniqueVocabulary(
  vocabulary: { word: string; reading: string; meaningFr: string }[],
): { word: string; reading: string; meaningFr: string }[] {
  const seen = new Set<string>();
  return vocabulary.filter((item) => {
    const key = `${item.word}\u0000${item.reading}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasKanjiText(value: string): boolean {
  return /[\u3400-\u9fff\uf900-\ufaff]/.test(value);
}

function isKanaReading(value: string): boolean {
  return /^[\u3040-\u30ffー\s。、！？・]+$/.test(value);
}

function buildQuizUserMessage(mission: string): string {
  return `MISSION À TRAITER EXCLUSIVEMENT : ${mission}`;
}

function buildQuizRetryPrompt(prompt: string, failure: string): string {
  return [
    prompt,
    '# NOUVELLE TENTATIVE CONTRÔLÉE',
    `La sortie précédente a été rejetée pour cette raison précise : ${failure}`,
    'Regénère uniquement cette question depuis zéro. Corrige chaque erreur signalée. Si des options étaient dupliquées, remplace-les par quatre réponses visuellement différentes et plausibles.',
    'Ne recopie pas la structure fautive. Respecte exactement le contrat et la vérification finale.',
  ].join('\n');
}

export function selectRelevantConstraints(
  candidates: QuizConstraints,
  mission: string,
): QuizConstraints {
  const terms = missionTerms(mission);
  const vocabulary = rankByMission(
    candidates.vocabulary,
    terms,
    (item) => `${item.word} ${item.reading} ${item.meaningFr}`,
  ).slice(0, 24);
  const sentences = rankByMission(
    candidates.sentences,
    terms,
    (item) => `${item.japanese} ${item.translationFr}`,
  ).slice(0, 10);
  if (vocabulary.length > 0 || sentences.length > 0) return { vocabulary, sentences };
  return {
    vocabulary: candidates.vocabulary.slice(0, 12),
    sentences: candidates.sentences.slice(0, 6),
  };
}

function rankByMission<T>(items: T[], terms: string[], text: (item: T) => string): T[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: terms.reduce(
        (total, term) => total + (normalizeSearchText(text(item)).includes(term) ? 1 : 0),
        0,
      ),
    }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .map((entry) => entry.item);
}

function missionTerms(value: string): string[] {
  const stopWords = new Set([
    'avec',
    'dans',
    'des',
    'les',
    'pour',
    'que',
    'qui',
    'reviser',
    'revision',
    'sur',
    'une',
  ]);
  return [
    ...new Set(
      normalizeSearchText(value)
        .split(/[^a-z0-9\u3040-\u30ff\u3400-\u9fff]+/)
        .filter(
          (term) =>
            !stopWords.has(term) && (term.length >= 3 || /[\u3040-\u30ff\u3400-\u9fff]/.test(term)),
        ),
    ),
  ];
}

function normalizeSearchText(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase('fr');
}

export function normalizeQuizInput(input: CreateAiQuizInput): CreateAiQuizInput {
  const skills = new Set(input.skills);
  for (const type of input.types) {
    const requiredSkill = AI_QUIZ_REQUIRED_SKILL_BY_TYPE[type];
    if (requiredSkill) skills.add(requiredSkill);
  }
  return { ...input, skills: [...skills] };
}

function parseGeneratedQuiz(value: string, input: CreateAiQuizInput): AiQuizDraft | null {
  try {
    const generated = aiQuizModelOutputSchema.safeParse(parseAiQuizModelJson(value));
    if (!generated.success) return null;
    const parsed = aiQuizDraftSchema.safeParse(materializeQuiz(generated.data, input));
    if (!parsed.success) return null;
    const quiz = parsed.data;
    const allowedSkills = new Set(input.skills);
    if (
      quiz.level !== input.level ||
      quiz.questions.length !== input.questionCount ||
      missingSelectedTypes(quiz, input).length > 0 ||
      quiz.questions.some(
        (question) =>
          !input.types.some((type) => type === question.type) || !allowedSkills.has(question.skill),
      )
    ) {
      return null;
    }
    return quiz;
  } catch {
    return null;
  }
}

function materializeQuiz(output: AiQuizModelOutput, input: CreateAiQuizInput): unknown {
  return {
    schemaVersion: 1,
    title: 'Quiz personnalisé',
    subtitle: truncate(input.prompt, 180),
    level: input.level,
    theme: truncate(input.prompt, 100),
    estimatedMinutes: Math.max(2, Math.ceil(input.questionCount * 0.8)),
    skills: input.skills,
    intro: {
      japanese: '練習しましょう。',
      kana: 'れんしゅうしましょう。',
      translationFr: 'Commençons ce quiz personnalisé.',
    },
    questions: output.questions.map((question, index) =>
      materializeQuestion(question, index, output.questions.length),
    ),
  };
}

function materializeQuestion(
  question: AiQuizModelOutput['questions'][number],
  index: number,
  questionCount: number,
) {
  const shared = {
    key: `q${index + 1}`,
    skill: AI_QUIZ_REQUIRED_SKILL_BY_TYPE[question.type],
    difficulty: questionDifficulty(index, questionCount),
    stage: questionStage(index, questionCount),
    prompt: {
      title: questionTitle(question.type),
      ...(question.type === 'listening_qcm'
        ? {
            audioText: question.japanese,
            kana: question.kana,
            hideJapaneseUntilPlayed: true,
          }
        : { japanese: question.japanese, kana: question.kana }),
    },
    hint: defaultHint(question.type),
    explanation: {
      title: 'Correction',
      bodyFr: question.explanationFr,
      takeaway: truncate(question.explanationFr, 240),
    },
    tags: [AI_QUIZ_REQUIRED_SKILL_BY_TYPE[question.type]],
  };
  return {
    ...shared,
    kind: 'choice',
    type: question.type,
    choices: question.options.map((label, itemIndex) => ({
      id: String.fromCharCode(97 + itemIndex),
      label,
    })),
    correct: { choiceId: String.fromCharCode(97 + question.answerIndex) },
  };
}

function parseGeneratedQuestion(
  value: string,
  type: AiQuizQcmType,
  previous: AiQuizModelOutput['questions'],
): QuestionGenerationResult {
  try {
    const output = parseAiQuizModelJson(value);
    if (!isRecord(output)) return { success: false, error: 'La racine doit être un objet JSON' };
    const generated = aiQuizModelQuestionSchema.safeParse({ ...output, type });
    if (!generated.success)
      return {
        success: false,
        error: generated.error.issues
          .slice(0, 12)
          .map((issue) => `${issue.path.join('.') || 'racine'}: ${issue.message}`)
          .join(' | '),
      };
    const signature = normalizedQuestionSignature(generated.data);
    if (previous.some((question) => normalizedQuestionSignature(question) === signature)) {
      return { success: false, error: 'Question japonaise dupliquée dans ce quiz' };
    }
    return { success: true, question: generated.data };
  } catch (error) {
    return { success: false, error: `JSON invalide: ${messageOf(error)}` };
  }
}

function normalizedQuestionSignature(question: { type: string; japanese: string }): string {
  return `${question.type}\u0000${question.japanese
    .normalize('NFKC')
    .replace(/\s+/g, '')
    .toLocaleLowerCase('ja')}`;
}

export function parseAiQuizModelJson(value: string): unknown {
  return JSON.parse(value.trim());
}

function missingSelectedTypes(quiz: AiQuizDraft, input: CreateAiQuizInput): string[] {
  if (input.questionCount < input.types.length) return [];
  return input.types.filter((type) => !quiz.questions.some((question) => question.type === type));
}

function questionTitle(type: CreateAiQuizInput['types'][number]): string {
  if (type === 'meaning_qcm') return 'Choisissez le sens correct.';
  if (type === 'reading_qcm') return 'Choisissez la lecture correcte.';
  if (type === 'cloze_qcm') return 'Complétez la phrase.';
  if (type === 'conjugation_qcm') return 'Choisissez la forme correcte.';
  if (type === 'dialogue_next_line') return 'Choisissez la réplique naturelle.';
  if (type === 'listening_qcm') return 'Écoutez puis choisissez la bonne réponse.';
  return 'Choisissez la nuance correcte.';
}

function truncate(value: string, maximum: number): string {
  return value.length <= maximum ? value : value.slice(0, maximum).trimEnd();
}

function questionDifficulty(index: number, questionCount: number): 1 | 2 | 3 {
  const progress = (index + 1) / questionCount;
  if (progress <= 0.34) return 1;
  if (progress <= 0.75) return 2;
  return 3;
}

function questionStage(
  index: number,
  questionCount: number,
): 'warmup' | 'practice' | 'challenge' | 'finale' {
  if (index === 0) return 'warmup';
  if (index === questionCount - 1) return 'finale';
  return index / questionCount < 0.6 ? 'practice' : 'challenge';
}

export function normalizeQuizRenderers(value: unknown, input: CreateAiQuizInput): unknown {
  if (!isRecord(value) || !Array.isArray(value.questions)) return value;
  return {
    ...value,
    skills: input.skills,
    questions: value.questions.map((question, index) =>
      normalizeQuizQuestion(question, input, index),
    ),
  };
}

function normalizeQuizQuestion(value: unknown, input: CreateAiQuizInput, index: number): unknown {
  if (
    !isRecord(value) ||
    typeof value.type !== 'string' ||
    !input.types.includes(value.type as never)
  )
    return value;
  const shared = pick(value, [
    'skill',
    'difficulty',
    'stage',
    'prompt',
    'hint',
    'explanation',
    'tags',
  ]);
  shared.key = `q${index + 1}`;
  const prompt = normalizePrompt(shared.prompt);
  if (prompt) shared.prompt = prompt;
  if (!shared.hint) shared.hint = defaultHint(value.type);
  if (value.type === 'pair_match') {
    const promptItems = isRecord(shared.prompt) ? shared.prompt : {};
    const leftItems = value.leftItems ?? promptItems.leftItems;
    const rightItems = value.rightItems ?? promptItems.rightItems;
    const matchPrompt = pick(promptItems, [
      'title',
      'japanese',
      'translationFr',
      'contextFr',
      'audioText',
      'hideJapaneseUntilPlayed',
    ]);
    return {
      ...shared,
      kind: 'match',
      type: value.type,
      prompt: normalizePrompt(matchPrompt),
      leftItems: normalizeItems(leftItems),
      rightItems: normalizeItems(rightItems),
      correct: value.correct,
    };
  }
  if (value.type === 'conjugation_builder' || value.type === 'sentence_order') {
    return {
      ...shared,
      kind: 'order',
      type: value.type,
      tiles: normalizeItems(value.tiles),
      correct: value.correct,
    };
  }
  return {
    ...shared,
    kind: 'choice',
    type: value.type,
    choices: normalizeItems(value.choices),
    correct: normalizeChoiceCorrect(value.correct),
  };
}

function normalizePrompt(value: unknown): Record<string, unknown> | undefined {
  if (!isRecord(value)) return undefined;
  const normalized = { ...value };
  if (typeof normalized.japanese === 'string' && !normalized.japanese.trim()) {
    delete normalized.japanese;
  }
  if (typeof normalized.title !== 'string' || !normalized.title.trim()) {
    normalized.title = 'Choisissez la réponse correcte.';
  }
  return normalized;
}

function defaultHint(type: string): string {
  if (type === 'pair_match') return 'Associez chaque élément une seule fois.';
  if (type === 'conjugation_builder' || type === 'sentence_order')
    return 'Placez les éléments dans un ordre japonais naturel.';
  if (type === 'listening_qcm') return 'Écoutez la phrase une seconde fois avant de choisir.';
  return 'Relisez la consigne et éliminez les réponses qui ne correspondent pas au contexte.';
}

function normalizeItems(value: unknown): unknown {
  if (!Array.isArray(value)) return value;
  return value.map((item) => {
    if (!isRecord(item)) return item;
    if (typeof item.id === 'string') return item;
    const corruptedId = Object.entries(item).find(
      ([key, candidate]) => normalizedKey(key) === 'id' && typeof candidate === 'string',
    );
    if (!corruptedId) {
      const inverted = Object.entries(item).find(
        ([key, candidate]) => /^[a-z][a-z0-9_-]{0,23}$/.test(key) && typeof candidate === 'string',
      );
      return inverted ? { id: inverted[0], label: inverted[1] } : item;
    }
    const { [corruptedId[0]]: _discarded, ...rest } = item;
    return { ...rest, id: corruptedId[1] };
  });
}

function normalizeChoiceCorrect(value: unknown): unknown {
  if (!isRecord(value) || typeof value.choiceId === 'string') return value;
  return typeof value.id === 'string' ? { choiceId: value.id } : value;
}

function normalizedKey(value: string): string {
  return value
    .replace(/<0x[0-9a-f]+>/gi, '')
    .replaceAll('\u00a0', '')
    .replaceAll('\u200b', '')
    .replaceAll('\u200c', '')
    .replaceAll('\u200d', '')
    .replaceAll('\u2060', '')
    .replaceAll('\ufeff', '')
    .replace(/\s/g, '')
    .toLowerCase();
}

function pick(value: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  return Object.fromEntries(keys.flatMap((key) => (key in value ? [[key, value[key]]] : [])));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseQuiz(value: Prisma.JsonValue): AiQuizDraft {
  return aiQuizDraftSchema.parse(value);
}

export function gradeAiQuizAnswer(
  question: AiQuizDraft['questions'][number],
  answer: SubmitAiQuizAnswerInput['answer'],
): boolean {
  if (question.kind === 'choice') return answer.choiceId === question.correct.choiceId;
  if (question.kind === 'order') {
    const submitted = answer.orderedTileIds;
    return (
      Array.isArray(submitted) &&
      submitted.length === question.correct.orderedTileIds.length &&
      submitted.every((id, index) => id === question.correct.orderedTileIds[index])
    );
  }
  const submitted = answer.pairings;
  const pairingKey = (pairing: { leftId: string; rightId: string }) =>
    `${pairing.leftId}\u0000${pairing.rightId}`;
  return (
    Array.isArray(submitted) &&
    submitted.length === question.correct.pairings.length &&
    new Set(submitted.map(pairingKey)).size === submitted.length &&
    submitted.every((pairing) =>
      question.correct.pairings.some((correct) => pairingKey(correct) === pairingKey(pairing)),
    )
  );
}

function strings(value: Prisma.JsonValue): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string')
    : [];
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : 'erreur inconnue';
}

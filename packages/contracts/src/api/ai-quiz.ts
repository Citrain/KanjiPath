import type { JlptLevel } from '../enums';
import type { AiQuizDraft, AiQuizSkill, CreateAiQuizInput } from '../schemas/ai-quiz';

export type AiQuizQuestion = AiQuizDraft['questions'][number];
type WithoutCorrect<T> = T extends unknown ? Omit<T, 'correct'> : never;
type WithoutAudioTranscript<T> = T extends { prompt: infer Prompt }
  ? Omit<T, 'prompt'> & { prompt: Omit<Prompt, 'audioText'> }
  : T;
export type AiQuizPublicQuestion = WithoutAudioTranscript<WithoutCorrect<AiQuizQuestion>>;

export interface AiQuizSessionDto {
  id: string;
  prompt: string;
  level: JlptLevel;
  questionCount: number;
  types: string[];
  skills: AiQuizSkill[];
  status: 'active' | 'finished';
  quiz: Omit<AiQuizDraft, 'questions'> & { questions: AiQuizPublicQuestion[] };
  answeredCount: number;
  correctCount: number;
  startedAt: string;
  endedAt: string | null;
}

export interface AiQuizAnswerResult {
  correct: boolean;
  correctAnswer: AiQuizQuestion['correct'];
  explanation: AiQuizQuestion['explanation'];
  answeredCount: number;
  correctCount: number;
}

export interface AiQuizFinishResult {
  id: string;
  answeredCount: number;
  correctCount: number;
  accuracy: number;
  endedAt: string;
}

export type CreateAiQuizRequest = CreateAiQuizInput;

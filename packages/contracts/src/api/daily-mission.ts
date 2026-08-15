import type { JlptLevel } from '../enums';
import type { StudyQueueItem, StudySessionDto } from './study';

export type DailyMissionStepStatus = 'pending' | 'completed' | 'skipped';

interface DailyMissionStepBase {
  id: string;
  position: number;
  status: DailyMissionStepStatus;
}

export interface DailyMissionStudyStep extends DailyMissionStepBase {
  type: 'study';
  session: StudySessionDto;
  items: StudyQueueItem[];
}

export interface DailyMissionVocabularyStep extends DailyMissionStepBase {
  type: 'vocabulary';
  vocabulary: {
    id: string;
    writtenForm: string;
    reading: string;
    romaji: string | null;
    meaningFr: string;
  };
}

export interface DailyMissionTextStep extends DailyMissionStepBase {
  type: 'text';
  text: {
    id: string;
    title: string;
    level: JlptLevel;
  };
}

export type DailyMissionStep =
  | DailyMissionStudyStep
  | DailyMissionVocabularyStep
  | DailyMissionTextStep;

export interface DailyMissionDto {
  id: string;
  localDate: string;
  status: 'active' | 'completed';
  startedAt: string;
  completedAt: string | null;
  steps: DailyMissionStep[];
}

export interface DailyMissionResponse {
  mission: DailyMissionDto | null;
}

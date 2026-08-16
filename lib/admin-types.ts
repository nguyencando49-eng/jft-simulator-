import { Question, SectionId } from './types';

export type QuestionStatus = 'draft' | 'review' | 'approved' | 'archived';

export interface QuestionRecord extends Question {
  version: number;
  status: QuestionStatus;
  source: 'original' | 'imported' | 'ai';
  createdAt: string;
  updatedAt: string;
}

export interface SectionRule {
  section: SectionId;
  count: number;
  allowBack: boolean;
  levels: Array<Question['level']>;
}

export interface ExamDraft {
  id: string;
  title: string;
  durationMinutes: number;
  rules: SectionRule[];
  status: 'draft' | 'published';
}

export interface FrozenQuestion {
  questionId: string;
  questionVersion: number;
  snapshot: QuestionRecord;
}

export interface ExamVersion {
  id: string;
  examId: string;
  version: number;
  title: string;
  durationMinutes: number;
  rules: SectionRule[];
  createdAt: string;
  publishedAt: string;
  questions: FrozenQuestion[];
}

export interface AttemptSummary {
  id: string;
  examVersionId: string;
  startedAt: string;
  finishedAt: string;
  scorePercent: number;
  answered: number;
  total: number;
}

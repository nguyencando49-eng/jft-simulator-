import { QuestionRecord } from '@/lib/admin-types';
import type { QaIssue } from './domain';
import { Question, SectionId } from '@/lib/types';

export type FactoryDifficulty = 'easy'|'balanced'|'hard';
export type FactoryProviderName = 'mock'|'http';
export type FactoryJobStatus = 'queued'|'running'|'review'|'completed'|'failed';

export interface FactoryRequest {
  section: SectionId;
  level: Question['level'];
  topic: string;
  canDo?: string;
  count: number;
  difficulty: FactoryDifficulty;
  includeExplanation: boolean;
  generateAudioScript: boolean;
}

export interface FactoryQaIssue extends QaIssue {
  category?: 'schema'|'language'|'pedagogy'|'jft_style'|'audio';
}

export interface FactoryCandidate {
  id: string;
  question: QuestionRecord;
  audioScript?: string;
  qa: {
    passed: boolean;
    score: number;
    issues: FactoryQaIssue[];
  };
  generation: {
    provider: string;
    model?: string;
    promptVersion: string;
    createdAt: string;
  };
  semanticQa?: { score:number; passed:boolean; summary:string; issues:FactoryQaIssue[]; provider:string; model?:string };
  audio?: { status:'pending'|'ready'|'failed'; provider?:string; voice?:string; storage?:string; renderedAt?:string; error?:string };
  approvedAt?: string;
}

export interface FactoryJob {
  id: string;
  requestedBy: string;
  status: FactoryJobStatus;
  request: FactoryRequest;
  provider: string;
  createdAt: string;
  updatedAt: string;
  error?: string;
  candidates: FactoryCandidate[];
}

export interface GeneratedQuestionDraft {
  instruction: string;
  prompt: string;
  choices: string[];
  answer: number;
  explanationVi: string;
  tags: string[];
  audioScript?: string;
}

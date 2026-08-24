import { QuestionRecord } from '@/lib/admin-types';
import type { QaIssue } from './domain';
import { Question, SectionId } from '@/lib/types';
import type { JftContentQaResultV1 } from './jft-content-qa-agent';
import type { AnswerOracleGateResult } from './answer-oracle';
import type { JapaneseNaturalnessGateResult } from './japanese-naturalness';
import type { CurriculumGroundingGateResult } from './curriculum-grounding';
import type { JftAlignmentGateResult } from './jft-alignment';
import type { DifficultyCalibrationGateResult } from './difficulty-calibration';
import type { OriginalityDuplicateGateResult } from './originality-duplicate';
import type { ItemBlueprint } from './generator-v2';
import type { GeneratorPreflightResult } from './generator-v2';

export type FactoryDifficulty = 'easy'|'balanced'|'hard';
export type FactoryProviderName = 'mock'|'http'|'azure-openai';
export type FactoryJobStatus = 'queued'|'running'|'review'|'completed'|'failed';

export interface FactoryRequest {
  section: SectionId;
  level: Question['level'];
  topic: string;
  canDo?: string;
  category?: string;
  count: number;
  difficulty: FactoryDifficulty;
  includeExplanation: boolean;
  generateAudioScript: boolean;
  /** Generator V2: immutable contracts. When present, count must match this array. */
  itemBlueprints?: ItemBlueprint[];
  sourceGuidance?: { objective:string; originalityRules:string[] };
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
    architecture?: string;
    blueprintId?: string;
    createdAt: string;
  };
  generatorPreflight?: GeneratorPreflightResult;
  semanticQa?: { score:number; passed:boolean; summary:string; issues:FactoryQaIssue[]; provider:string; model?:string };
  curriculumQa?: { curriculumGrounded:boolean; knowledgeUnitIds:string[]; outsideKnowledge:string[]; score:number; hardFail:boolean };
  contentQa?: JftContentQaResultV1;
  answerOracleQa?: AnswerOracleGateResult;
  japaneseNaturalnessQa?: JapaneseNaturalnessGateResult;
  curriculumGroundingQa?: CurriculumGroundingGateResult;
  jftAlignmentQa?: JftAlignmentGateResult;
  difficultyCalibrationQa?: DifficultyCalibrationGateResult;
  originalityDuplicateQa?: OriginalityDuplicateGateResult;
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
  sourceContext?: {sourceDocumentId:string;sourceChunkIds:string[];knowledgeUnitId:string;knowledgeUnitIds?:string[];questionPlanId:string;objective:string;sourceTexts:string[];originalityPromptVersion?:string};
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

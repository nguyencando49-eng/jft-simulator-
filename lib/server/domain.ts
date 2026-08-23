import { ExamDraft, ExamVersion, QuestionRecord } from '@/lib/admin-types';
import type { FactoryJob } from './factory-domain';
import type { KnowledgeUnit, QuestionPlan, QuestionProvenance, SourceChunk, SourceDocument } from './source-domain';

export type QaSeverity = 'error' | 'warning';
export type QaCheckCode = 'schema'|'choice_count'|'answer_index'|'duplicate_choice'|'audio_required'|'prompt_required'|'explanation_required'|'semantic_alignment'|'duplicate_similarity'|'source_similarity'|'audio_render'|'question_id_collision'|'content_qa_fail'|'content_qa_review'|'answer_oracle_fail'|'answer_oracle_review'|'japanese_naturalness_fail'|'japanese_naturalness_review'|'curriculum_grounding_fail'|'curriculum_grounding_review'|'jft_alignment_fail'|'jft_alignment_review'|'difficulty_calibration_fail'|'difficulty_calibration_review'|'originality_duplicate_fail'|'originality_duplicate_review';
export interface QaIssue { code: QaCheckCode; severity: QaSeverity; message: string; }
export interface QaReport { passed: boolean; checkedAt: string; issues: QaIssue[]; }

export type UserRole = 'admin'|'candidate';
export interface ProfileRecord {
  id: string;
  email: string;
  displayName?: string;
  role: UserRole;
  createdAt: string;
  lastSeenAt: string;
}

export interface CandidateSessionRecord {
  id: string;
  examVersionId: string;
  candidateId?: string;
  status: 'active' | 'submitted' | 'expired';
  startedAt: string;
  expiresAt: string;
  submittedAt?: string;
  currentIndex: number;
  answers: Record<string, number>;
}

export interface ImportResult { accepted: QuestionRecord[]; rejected: Array<{ row: number; issues: QaIssue[] }>; }

export interface Repository {
  listQuestions(): Promise<QuestionRecord[]>;
  upsertQuestion(question: QuestionRecord): Promise<QuestionRecord>;
  getExamDraft(id: string): Promise<ExamDraft | null>;
  saveExamDraft(draft: ExamDraft): Promise<ExamDraft>;
  listExamVersions(examId?: string): Promise<ExamVersion[]>;
  saveExamVersion(version: ExamVersion): Promise<ExamVersion>;
  createSession(session: CandidateSessionRecord): Promise<CandidateSessionRecord>;
  getSession(id: string): Promise<CandidateSessionRecord | null>;
  saveSession(session: CandidateSessionRecord): Promise<CandidateSessionRecord>;
  saveSessionProgress(id: string, mutation: { questionId?: string; choice?: number; currentIndex?: number }): Promise<CandidateSessionRecord | null>;
  listSessions(): Promise<CandidateSessionRecord[]>;
  upsertProfile(profile: ProfileRecord): Promise<ProfileRecord>;
  getProfile(id: string): Promise<ProfileRecord | null>;
  listProfiles(): Promise<ProfileRecord[]>;
  listFactoryJobs(): Promise<FactoryJob[]>;
  getFactoryJob(id: string): Promise<FactoryJob | null>;
  saveFactoryJob(job: FactoryJob): Promise<FactoryJob>;
  listSourceDocuments(): Promise<SourceDocument[]>;
  getSourceDocument(id:string): Promise<SourceDocument|null>;
  saveSourceDocument(document:SourceDocument): Promise<SourceDocument>;
  saveSourceChunks(chunks:SourceChunk[]): Promise<SourceChunk[]>;
  listSourceChunks(sourceDocumentId:string): Promise<SourceChunk[]>;
  saveKnowledgeUnits(units:KnowledgeUnit[]): Promise<KnowledgeUnit[]>;
  updateKnowledgeUnit(unit:KnowledgeUnit): Promise<KnowledgeUnit>;
  listKnowledgeUnits(sourceDocumentId:string): Promise<KnowledgeUnit[]>;
  saveQuestionPlan(plan:QuestionPlan): Promise<QuestionPlan>;
  getQuestionPlan(id:string): Promise<QuestionPlan|null>;
  listQuestionPlans(sourceDocumentId:string): Promise<QuestionPlan[]>;
  saveQuestionProvenance(value:QuestionProvenance): Promise<QuestionProvenance>;
  listQuestionProvenance(sourceDocumentId:string): Promise<QuestionProvenance[]>;
}

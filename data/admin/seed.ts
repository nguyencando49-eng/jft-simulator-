import { questions as authoredQuestions } from '../questions';
import { completeProductionQuestionSet } from '../production/mass-question-candidates';
import { QuestionRecord, ExamDraft, AttemptSummary } from '@/lib/admin-types';
import { assertControlledProductionBank,PRODUCTION_BANK_RELEASE_VERSION } from '@/lib/server/production-bank-release';

const now = '2026-09-21T17:00:00.000Z';
const authoredIds=new Set(authoredQuestions.map(question=>question.id));
assertControlledProductionBank();

export const seedQuestions: QuestionRecord[] = completeProductionQuestionSet.map((question) => ({
  ...question,
  version: 2,
  status: 'approved' as const,
  source: authoredIds.has(question.id) ? 'original' as const : 'ai' as const,
  tags:Array.from(new Set([...question.tags,`release:${PRODUCTION_BANK_RELEASE_VERSION}`,'qa-state:controlled-release-approved'])),
  createdAt: now,
  updatedAt: now,
}));

const examRules=(level:'A1'|'A2.1'|'A2.2')=>[
  { section: 'script_vocabulary' as const, count: 12, allowBack: true, levels: [level] },
  { section: 'conversation_expression' as const, count: 12, allowBack: true, levels: [level] },
  { section: 'listening' as const, count: 12, allowBack: false, levels: [level] },
  { section: 'reading' as const, count: 12, allowBack: true, levels: [level] },
];

export const seedExamDrafts: ExamDraft[] = (['A1','A2.1','A2.2'] as const).map(level=>({
  id:`JFT-PRACTICE-${level.replaceAll('.','-')}-001`,
  title:`JFT Practice ${level} — Đề 01`,
  durationMinutes:60,
  status:'published' as const,
  rules:examRules(level),
}));

// Backward-compatible fixture used by a few admin flows.
export const seedExamDraft: ExamDraft = seedExamDrafts[0];

export const seedAttempts: AttemptSummary[] = [
  { id:'ATT-001', examVersionId:'JFT-PRACTICE-A1-001-v1', startedAt:'2026-08-10T02:10:00Z', finishedAt:'2026-08-10T02:22:30Z', scorePercent:75, answered:8, total:8 },
  { id:'ATT-002', examVersionId:'JFT-PRACTICE-A1-001-v1', startedAt:'2026-08-10T04:40:00Z', finishedAt:'2026-08-10T04:53:20Z', scorePercent:62.5, answered:7, total:8 },
  { id:'ATT-003', examVersionId:'JFT-PRACTICE-A1-001-v1', startedAt:'2026-08-11T01:20:00Z', finishedAt:'2026-08-11T01:31:02Z', scorePercent:87.5, answered:8, total:8 },
];

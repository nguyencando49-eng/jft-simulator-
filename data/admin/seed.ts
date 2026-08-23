import { questions } from '../questions';
import { massQuestionCandidates } from '../production/mass-question-candidates';
import { a1Lesson03Candidates } from '../pilots/a1-lesson-03-candidates';
import { QuestionRecord, ExamDraft, AttemptSummary } from '@/lib/admin-types';

const now = '2026-08-11T05:00:00.000Z';

export const seedQuestions: QuestionRecord[] = [...questions.map((q) => ({
  ...q,
  version: 1,
  status: q.id==='LI-002' ? 'review' as const : 'approved' as const,
  source: 'original' as const,
  createdAt: now,
  updatedAt: now,
})),...a1Lesson03Candidates.map(q=>({
  ...q,
  version:1,
  status:'review' as const,
  source:'ai' as const,
  createdAt:now,
  updatedAt:now,
})),...massQuestionCandidates.map(q=>({
  ...q,
  version:1,
  status:'review' as const,
  source:'ai' as const,
  createdAt:now,
  updatedAt:now,
}))];

export const seedExamDraft: ExamDraft = {
  id: 'JFT-MOCK-001',
  title: 'JFT Practice A1 — Đề 01',
  durationMinutes: 60,
  status: 'draft',
  rules: [
    { section: 'script_vocabulary', count: 2, allowBack: true, levels: ['A1'] },
    { section: 'conversation_expression', count: 2, allowBack: true, levels: ['A1'] },
    { section: 'listening', count: 2, allowBack: false, levels: ['A1'] },
    { section: 'reading', count: 2, allowBack: true, levels: ['A1'] },
  ],
};

export const seedAttempts: AttemptSummary[] = [
  { id:'ATT-001', examVersionId:'JFT-MOCK-001-v1', startedAt:'2026-08-10T02:10:00Z', finishedAt:'2026-08-10T02:22:30Z', scorePercent:75, answered:8, total:8 },
  { id:'ATT-002', examVersionId:'JFT-MOCK-001-v1', startedAt:'2026-08-10T04:40:00Z', finishedAt:'2026-08-10T04:53:20Z', scorePercent:62.5, answered:7, total:8 },
  { id:'ATT-003', examVersionId:'JFT-MOCK-001-v1', startedAt:'2026-08-11T01:20:00Z', finishedAt:'2026-08-11T01:31:02Z', scorePercent:87.5, answered:8, total:8 },
];

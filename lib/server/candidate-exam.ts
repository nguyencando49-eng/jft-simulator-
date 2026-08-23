import type { ExamVersion } from '@/lib/admin-types';
import type { Question, SectionId } from '@/lib/types';

export type CandidateExamLevel = Question['level'] | 'MIXED';

export interface CandidateExamSummary {
  id: string;
  examId: string;
  title: string;
  durationMinutes: number;
  publishedAt: string;
  questionCount: number;
  level: CandidateExamLevel;
  sections: SectionId[];
}

/** Candidate catalog exposes only the newest immutable version of each exam. */
export function latestPublishedVersions(versions: ExamVersion[]) {
  const latest = new Map<string, ExamVersion>();
  for (const version of [...versions].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt))) {
    if (!latest.has(version.examId)) latest.set(version.examId, version);
  }
  return [...latest.values()];
}

export function toCandidateExamSummary(version: ExamVersion): CandidateExamSummary {
  const levels = Array.from(new Set(version.questions.map(item => item.snapshot.level)));
  const sections = Array.from(new Set(version.questions.map(item => item.snapshot.section)));
  return {
    id: version.id,
    examId: version.examId,
    title: version.title,
    durationMinutes: version.durationMinutes,
    publishedAt: version.publishedAt,
    questionCount: version.questions.length,
    level: levels.length === 1 ? levels[0] : 'MIXED',
    sections,
  };
}

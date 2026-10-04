import { PRODUCTION_EXAM_DRAFTS, PRODUCTION_EXAM_QUESTIONS, PRODUCTION_EXAM_DURATION_MINUTES } from '@/data/production/exam-catalog';
import { PRODUCTION_EXAM_VERSION } from './production-release';
import type { CandidateExamSummary } from './candidate-exam';

/** Checks persisted learner-visible forms, rather than treating deployed code as publication. */
export function assertProductionCatalog(versions: CandidateExamSummary[]) {
  for (const draft of PRODUCTION_EXAM_DRAFTS) {
    const matches = versions.filter(version => version.examId === draft.id);
    if (matches.length !== 1) throw new Error(`Expected one published form for ${draft.id}; received ${matches.length}.`);
    const version = matches[0];
    const level = draft.rules[0].levels[0];
    const sections = new Set(version.sections);
    if (version.id !== `${draft.id}-v${PRODUCTION_EXAM_VERSION}` || version.title !== draft.title
      || version.level !== level || version.questionCount !== PRODUCTION_EXAM_QUESTIONS
      || version.durationMinutes !== PRODUCTION_EXAM_DURATION_MINUTES
      || sections.size !== draft.rules.length || draft.rules.some(rule => !sections.has(rule.section))) {
      throw new Error(`Invalid published production metadata for ${draft.id}.`);
    }
  }
  return { examCount: PRODUCTION_EXAM_DRAFTS.length, examsPerLevel: 20 };
}

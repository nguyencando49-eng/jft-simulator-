import type { ExamVersion } from '@/lib/admin-types';
import type { CandidateSessionRecord } from './domain';
import { toCandidateQuestion } from './candidate-question';

export function scoreFrozenExam(version: ExamVersion, session: CandidateSessionRecord) {
  const total = version.questions.length;
  let correct = 0;
  for (const frozen of version.questions) if (session.answers[frozen.questionId] === frozen.snapshot.answer) correct++;
  const sectionScores = Object.fromEntries(
    Array.from(new Set(version.questions.map(q => q.snapshot.section))).map(section => {
      const qs = version.questions.filter(q => q.snapshot.section === section);
      const c = qs.filter(q => session.answers[q.questionId] === q.snapshot.answer).length;
      return [section, { correct: c, total: qs.length, percent: qs.length ? Math.round(c / qs.length * 1000) / 10 : 0 }];
    }),
  );
  const validQuestionIds = new Set(version.questions.map(q => q.questionId));
  const answered = Object.keys(session.answers).filter(id => validQuestionIds.has(id)).length;
  return {
    correct,
    incorrect: Math.max(0, answered - correct),
    unanswered: Math.max(0, total - answered),
    total,
    scorePercent: total ? Math.round(correct / total * 1000) / 10 : 0,
    answered,
    sectionScores,
  };
}

/** This projection is only returned after ownership and submitted-status checks. */
export function buildSubmittedReview(version: ExamVersion, session: CandidateSessionRecord) {
  return version.questions.map(frozen => {
    const selectedAnswer = Number.isInteger(session.answers[frozen.questionId])
      ? session.answers[frozen.questionId]
      : null;
    return {
      question: toCandidateQuestion(frozen.snapshot),
      selectedAnswer,
      correctAnswer: frozen.snapshot.answer,
      correct: selectedAnswer === frozen.snapshot.answer,
      explanationVi: frozen.snapshot.explanationVi,
    };
  });
}

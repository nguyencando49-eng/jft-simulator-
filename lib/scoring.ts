import { Question, SectionId } from './types';

export function scoreExam(questions: Question[], answers: Record<string, number>) {
  const bySection: Record<SectionId, { correct:number; total:number }> = {
    script_vocabulary:{correct:0,total:0}, conversation_expression:{correct:0,total:0}, listening:{correct:0,total:0}, reading:{correct:0,total:0}
  };
  let correct = 0;
  for (const q of questions) {
    bySection[q.section].total++;
    if (answers[q.id] === q.answer) {
      correct++;
      bySection[q.section].correct++;
    }
  }
  const percent = Math.round((correct / questions.length) * 100);
  const estimatedLevel = percent >= 75 ? 'A2.2 (A2)' : percent >= 55 ? 'A2.1' : percent >= 35 ? 'A1' : 'Below A1';
  return { correct, total:questions.length, percent, estimatedLevel, bySection };
}

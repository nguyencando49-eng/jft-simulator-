import { QuestionRecord } from '@/lib/admin-types';
import { QaIssue, QaReport } from './domain';

export function runQuestionQa(question: QuestionRecord): QaReport {
  const issues: QaIssue[] = [];
  if (!question.prompt?.trim()) issues.push({ code:'prompt_required', severity:'error', message:'Prompt is required.' });
  if (!Array.isArray(question.choices) || question.choices.length < 2) issues.push({ code:'choice_count', severity:'error', message:'At least 2 choices are required.' });
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) issues.push({ code:'answer_index', severity:'error', message:'Answer index is outside choices.' });
  const normalized = question.choices.map(c => c.trim().toLocaleLowerCase());
  if (new Set(normalized).size !== normalized.length) issues.push({ code:'duplicate_choice', severity:'error', message:'Choices must be unique.' });
  if (question.type === 'audio_choice' && !question.audioSrc) issues.push({ code:'audio_required', severity:'error', message:'audio_choice requires audioSrc.' });
  if (!question.explanationVi?.trim()) issues.push({ code:'explanation_required', severity:'warning', message:'Vietnamese explanation is recommended.' });
  return { passed: !issues.some(i => i.severity === 'error'), checkedAt: new Date().toISOString(), issues };
}

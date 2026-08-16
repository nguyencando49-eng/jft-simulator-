'use client';
import { ExamDraft, ExamVersion, QuestionRecord } from './admin-types';
import { seedExamDraft, seedQuestions } from '@/data/admin/seed';

const Q_KEY = 'jft-admin-questions-v3';
const E_KEY = 'jft-admin-exam-draft-v3';
const V_KEY = 'jft-admin-exam-versions-v3';

function read<T>(key:string, fallback:T):T {
  if (typeof window === 'undefined') return fallback;
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try { return JSON.parse(raw) as T; } catch { return fallback; }
}
function write<T>(key:string, value:T){ localStorage.setItem(key, JSON.stringify(value)); }

export const adminStore = {
  getQuestions: () => read<QuestionRecord[]>(Q_KEY, seedQuestions),
  saveQuestions: (rows:QuestionRecord[]) => write(Q_KEY, rows),
  getDraft: () => read<ExamDraft>(E_KEY, seedExamDraft),
  saveDraft: (draft:ExamDraft) => write(E_KEY, draft),
  getVersions: () => read<ExamVersion[]>(V_KEY, []),
  saveVersions: (versions:ExamVersion[]) => write(V_KEY, versions),
  reset: () => { localStorage.removeItem(Q_KEY); localStorage.removeItem(E_KEY); localStorage.removeItem(V_KEY); },
};

import { seedExamDraft, seedQuestions } from '@/data/admin/seed';
import { ExamDraft, ExamVersion, QuestionRecord } from '@/lib/admin-types';
import { CandidateSessionRecord, ProfileRecord, Repository } from './domain';
import { generateExamVersion } from '@/lib/exam-generator';
import type { FactoryJob } from './factory-domain';

type Store = {
  questions: QuestionRecord[];
  drafts: ExamDraft[];
  versions: ExamVersion[];
  sessions: CandidateSessionRecord[];
  profiles: ProfileRecord[];
  factoryJobs: FactoryJob[];
};

declare global { var __jftV4MemoryStore: Store | undefined; }
const initialVersion = generateExamVersion(seedExamDraft, seedQuestions, 1);
const store: Store = globalThis.__jftV4MemoryStore ?? {
  questions: structuredClone(seedQuestions), drafts: [structuredClone(seedExamDraft)], versions: initialVersion.ok ? [structuredClone(initialVersion.version)] : [], sessions: [], profiles: [], factoryJobs: [],
};
if (process.env.NODE_ENV !== 'production') globalThis.__jftV4MemoryStore = store;

export class MemoryRepository implements Repository {
  async listQuestions(){ return structuredClone(store.questions); }
  async upsertQuestion(q:QuestionRecord){ const i=store.questions.findIndex(x=>x.id===q.id); if(i>=0) store.questions[i]=structuredClone(q); else store.questions.push(structuredClone(q)); return structuredClone(q); }
  async getExamDraft(id:string){ return structuredClone(store.drafts.find(x=>x.id===id) ?? null); }
  async saveExamDraft(d:ExamDraft){ const i=store.drafts.findIndex(x=>x.id===d.id); if(i>=0) store.drafts[i]=structuredClone(d); else store.drafts.push(structuredClone(d)); return structuredClone(d); }
  async listExamVersions(examId?:string){ return structuredClone(examId ? store.versions.filter(v=>v.examId===examId) : store.versions); }
  async saveExamVersion(v:ExamVersion){ if(store.versions.some(x=>x.id===v.id)) throw new Error(`Exam version ${v.id} already exists`); store.versions.push(structuredClone(v)); return structuredClone(v); }
  async createSession(s:CandidateSessionRecord){ store.sessions.push(structuredClone(s)); return structuredClone(s); }
  async getSession(id:string){ return structuredClone(store.sessions.find(s=>s.id===id) ?? null); }
  async saveSession(s:CandidateSessionRecord){ const i=store.sessions.findIndex(x=>x.id===s.id); if(i<0) throw new Error('Session not found'); store.sessions[i]=structuredClone(s); return structuredClone(s); }
  async saveSessionProgress(id:string,m:{questionId?:string;choice?:number;currentIndex?:number}){ const i=store.sessions.findIndex(x=>x.id===id); if(i<0) return null; const s=store.sessions[i]; if(s.status!=='active'||Date.now()>=new Date(s.expiresAt).getTime()) return null; if(m.questionId!==undefined&&m.choice!==undefined)s.answers[m.questionId]=m.choice; if(m.currentIndex!==undefined)s.currentIndex=m.currentIndex; return structuredClone(s); }
  async listSessions(){ return structuredClone(store.sessions); }
  async upsertProfile(p:ProfileRecord){ const i=store.profiles.findIndex(x=>x.id===p.id); if(i>=0) store.profiles[i]=structuredClone(p); else store.profiles.push(structuredClone(p)); return structuredClone(p); }
  async getProfile(id:string){ return structuredClone(store.profiles.find(p=>p.id===id) ?? null); }
  async listProfiles(){ return structuredClone(store.profiles); }
  async listFactoryJobs(){ return structuredClone(store.factoryJobs); }
  async getFactoryJob(id:string){ return structuredClone(store.factoryJobs.find(j=>j.id===id) ?? null); }
  async saveFactoryJob(job:FactoryJob){ const i=store.factoryJobs.findIndex(j=>j.id===job.id); if(i>=0) store.factoryJobs[i]=structuredClone(job); else store.factoryJobs.push(structuredClone(job)); return structuredClone(job); }
}

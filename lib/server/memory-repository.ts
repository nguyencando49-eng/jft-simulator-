import { seedExamDraft, seedQuestions } from '@/data/admin/seed';
import { ExamDraft, ExamVersion, QuestionRecord } from '@/lib/admin-types';
import { CandidateSessionRecord, ProfileRecord, Repository } from './domain';
import { generateExamVersion } from '@/lib/exam-generator';
import type { FactoryJob } from './factory-domain';
import type { KnowledgeUnit, QuestionPlan, QuestionProvenance, SourceChunk, SourceDocument } from './source-domain';

type Store = {
  questions: QuestionRecord[];
  drafts: ExamDraft[];
  versions: ExamVersion[];
  sessions: CandidateSessionRecord[];
  profiles: ProfileRecord[];
  factoryJobs: FactoryJob[];
  sourceDocuments:SourceDocument[];sourceChunks:SourceChunk[];knowledgeUnits:KnowledgeUnit[];questionPlans:QuestionPlan[];questionProvenance:QuestionProvenance[];
};

declare global { var __jftV4MemoryStore: Store | undefined; }
const initialVersion = generateExamVersion(seedExamDraft, seedQuestions, 1);
const store: Store = globalThis.__jftV4MemoryStore ?? {
  questions: structuredClone(seedQuestions), drafts: [structuredClone(seedExamDraft)], versions: initialVersion.ok ? [structuredClone(initialVersion.version)] : [], sessions: [], profiles: [], factoryJobs: [],sourceDocuments:[],sourceChunks:[],knowledgeUnits:[],questionPlans:[],questionProvenance:[],
};
for(const [key,value] of Object.entries({sourceDocuments:[],sourceChunks:[],knowledgeUnits:[],questionPlans:[],questionProvenance:[]}) as Array<[keyof Store,never[]]>) if(!store[key]) (store as any)[key]=value;
if (process.env.NODE_ENV !== 'production') globalThis.__jftV4MemoryStore = store;

export class MemoryRepository implements Repository {
  async listQuestions(){ return structuredClone(store.questions); }
  async upsertQuestion(q:QuestionRecord){ const i=store.questions.findIndex(x=>x.id===q.id); if(i>=0) store.questions[i]=structuredClone(q); else store.questions.push(structuredClone(q)); return structuredClone(q); }
  async upsertQuestions(questions:QuestionRecord[]){for(const question of questions)await this.upsertQuestion(question);return structuredClone(questions);}
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
  async listSourceDocuments(){return structuredClone(store.sourceDocuments);}
  async getSourceDocument(id:string){return structuredClone(store.sourceDocuments.find(x=>x.id===id)||null);}
  async saveSourceDocument(x:SourceDocument){const i=store.sourceDocuments.findIndex(v=>v.id===x.id);if(i>=0)store.sourceDocuments[i]=structuredClone(x);else store.sourceDocuments.push(structuredClone(x));return structuredClone(x);}
  async saveSourceChunks(xs:SourceChunk[]){for(const x of xs){const i=store.sourceChunks.findIndex(v=>v.id===x.id);if(i>=0)store.sourceChunks[i]=structuredClone(x);else store.sourceChunks.push(structuredClone(x));}return structuredClone(xs);}
  async listSourceChunks(id:string){return structuredClone(store.sourceChunks.filter(x=>x.sourceDocumentId===id).sort((a,b)=>a.sequence-b.sequence));}
  async saveKnowledgeUnits(xs:KnowledgeUnit[]){for(const x of xs)await this.updateKnowledgeUnit(x);return structuredClone(xs);}
  async updateKnowledgeUnit(x:KnowledgeUnit){const i=store.knowledgeUnits.findIndex(v=>v.id===x.id);if(i>=0)store.knowledgeUnits[i]=structuredClone(x);else store.knowledgeUnits.push(structuredClone(x));return structuredClone(x);}
  async listKnowledgeUnits(id:string){return structuredClone(store.knowledgeUnits.filter(x=>x.sourceDocumentId===id));}
  async saveQuestionPlan(x:QuestionPlan){const i=store.questionPlans.findIndex(v=>v.id===x.id);if(i>=0)store.questionPlans[i]=structuredClone(x);else store.questionPlans.push(structuredClone(x));return structuredClone(x);}
  async getQuestionPlan(id:string){return structuredClone(store.questionPlans.find(x=>x.id===id)||null);}
  async listQuestionPlans(id:string){return structuredClone(store.questionPlans.filter(x=>x.sourceDocumentId===id));}
  async saveQuestionProvenance(x:QuestionProvenance){const i=store.questionProvenance.findIndex(v=>v.id===x.id);if(i>=0)store.questionProvenance[i]=structuredClone(x);else store.questionProvenance.push(structuredClone(x));return structuredClone(x);}
  async listQuestionProvenance(id:string){return structuredClone(store.questionProvenance.filter(x=>x.sourceDocumentId===id));}
}

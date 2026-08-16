import { ExamDraft, ExamVersion, QuestionRecord } from '@/lib/admin-types';
import { CandidateSessionRecord, ProfileRecord, Repository } from './domain';
import type { FactoryJob } from './factory-domain';

function env(name:string){ const v=process.env[name]; if(!v) throw new Error(`Missing ${name}`); return v; }
function base(){ return `${env('SUPABASE_URL').replace(/\/$/,'')}/rest/v1`; }
function headers(){ const key=env('SUPABASE_SERVICE_ROLE_KEY'); return { apikey:key, Authorization:`Bearer ${key}`, 'Content-Type':'application/json' }; }
async function request(path:string, init:RequestInit={}){ const res=await fetch(`${base()}${path}`, { ...init, headers:{...headers(), ...(init.headers||{})}, cache:'no-store' }); if(!res.ok) throw new Error(`Supabase ${res.status}: ${await res.text()}`); const text=await res.text(); return text ? JSON.parse(text) : null; }

const encode = encodeURIComponent;
export class SupabaseRepository implements Repository {
  async listQuestions(){ const rows=await request('/questions?select=payload&order=updated_at.desc'); return rows.map((r:{payload:QuestionRecord})=>r.payload); }
  async upsertQuestion(q:QuestionRecord){ await request('/questions?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:q.id,status:q.status,section:q.section,level:q.level,version:q.version,payload:q,updated_at:q.updatedAt}])}); return q; }
  async getExamDraft(id:string){ const rows=await request(`/exam_drafts?id=eq.${encode(id)}&select=payload&limit=1`); return rows[0]?.payload ?? null; }
  async saveExamDraft(d:ExamDraft){ await request('/exam_drafts?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:d.id,status:d.status,payload:d}])}); return d; }
  async listExamVersions(examId?:string){ const filter=examId?`&exam_id=eq.${encode(examId)}`:''; const rows=await request(`/exam_versions?select=payload${filter}&order=version.desc`); return rows.map((r:{payload:ExamVersion})=>r.payload); }
  async saveExamVersion(v:ExamVersion){ await request('/exam_versions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{id:v.id,exam_id:v.examId,version:v.version,payload:v,published_at:v.publishedAt}])}); return v; }
  async createSession(s:CandidateSessionRecord){ await request('/candidate_sessions',{method:'POST',headers:{Prefer:'return=minimal'},body:JSON.stringify([{id:s.id,exam_version_id:s.examVersionId,candidate_id:s.candidateId??null,status:s.status,started_at:s.startedAt,expires_at:s.expiresAt,current_index:s.currentIndex,answers:s.answers}])}); return s; }
  async getSession(id:string){ const rows=await request(`/candidate_sessions?id=eq.${encode(id)}&select=*&limit=1`); const r=rows[0]; if(!r) return null; return {id:r.id,examVersionId:r.exam_version_id,candidateId:r.candidate_id??undefined,status:r.status,startedAt:r.started_at,expiresAt:r.expires_at,submittedAt:r.submitted_at??undefined,currentIndex:r.current_index,answers:r.answers??{}}; }
  async saveSession(s:CandidateSessionRecord){ await request(`/candidate_sessions?id=eq.${encode(s.id)}`,{method:'PATCH',headers:{Prefer:'return=minimal'},body:JSON.stringify({status:s.status,submitted_at:s.submittedAt??null,current_index:s.currentIndex,answers:s.answers})}); return s; }
  async saveSessionProgress(id:string,m:{questionId?:string;choice?:number;currentIndex?:number}){ const rows=await request('/rpc/save_session_progress',{method:'POST',headers:{Prefer:'return=representation'},body:JSON.stringify({p_id:id,p_question_id:m.questionId??null,p_choice:m.choice??null,p_current_index:m.currentIndex??null})}); const r=Array.isArray(rows)?rows[0]:rows; if(!r)return null; return {id:r.id,examVersionId:r.exam_version_id,candidateId:r.candidate_id??undefined,status:r.status,startedAt:r.started_at,expiresAt:r.expires_at,submittedAt:r.submitted_at??undefined,currentIndex:r.current_index,answers:r.answers??{}}; }
  async listSessions(){ const rows=await request('/candidate_sessions?select=*&order=started_at.desc'); return rows.map((r:any)=>({id:r.id,examVersionId:r.exam_version_id,candidateId:r.candidate_id??undefined,status:r.status,startedAt:r.started_at,expiresAt:r.expires_at,submittedAt:r.submitted_at??undefined,currentIndex:r.current_index,answers:r.answers??{}})); }
  async upsertProfile(p:ProfileRecord){ await request('/profiles?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:p.id,email:p.email,display_name:p.displayName??null,role:p.role,created_at:p.createdAt,last_seen_at:p.lastSeenAt}])}); return p; }
  async getProfile(id:string){ const rows=await request(`/profiles?id=eq.${encode(id)}&select=*&limit=1`); const r=rows[0]; return r?{id:r.id,email:r.email,displayName:r.display_name??undefined,role:r.role,createdAt:r.created_at,lastSeenAt:r.last_seen_at}:null; }
  async listProfiles(){ const rows=await request('/profiles?select=*&order=last_seen_at.desc'); return rows.map((r:any)=>({id:r.id,email:r.email,displayName:r.display_name??undefined,role:r.role,createdAt:r.created_at,lastSeenAt:r.last_seen_at})); }
  async listFactoryJobs(){ const rows=await request('/factory_jobs?select=payload&order=updated_at.desc'); return rows.map((r:{payload:FactoryJob})=>r.payload); }
  async getFactoryJob(id:string){ const rows=await request(`/factory_jobs?id=eq.${encode(id)}&select=payload&limit=1`); return rows[0]?.payload ?? null; }
  async saveFactoryJob(job:FactoryJob){ await request('/factory_jobs?on_conflict=id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify([{id:job.id,status:job.status,requested_by:job.requestedBy,payload:job,updated_at:job.updatedAt}])}); return job; }
}

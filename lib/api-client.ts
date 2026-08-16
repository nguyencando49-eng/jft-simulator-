import { ExamDraft, ExamVersion, QuestionRecord } from './admin-types';
import { Question, SectionId } from './types';
import type { UserRole } from './server/domain';
import type { FactoryJob, FactoryRequest } from './server/factory-domain';
import type { KnowledgeUnit, QuestionPlan, QuestionProvenance, SourceChunk, SourceDocument } from './server/source-domain';
import type { CoverageCell, ReadinessResult } from './server/curriculum-production';

export type ApiErrorPayload={ok?:false;error?:string;[key:string]:unknown};
export class ApiError extends Error{status:number;payload:ApiErrorPayload;constructor(status:number,payload:ApiErrorPayload){super(payload.error||`API ${status}`);this.status=status;this.payload=payload;}}

async function raw<T>(path:string,init:RequestInit={},allowRefresh=true):Promise<T>{
  const headers=new Headers(init.headers||{}); if(init.body && !(init.body instanceof FormData))headers.set('Content-Type','application/json');
  const res=await fetch(path,{...init,headers,cache:'no-store',credentials:'same-origin'});
  if(res.status===401&&allowRefresh&&path!=='/api/v1/auth/refresh'){const rr=await fetch('/api/v1/auth/refresh',{method:'POST',credentials:'same-origin'});if(rr.ok)return raw<T>(path,init,false);}
  const text=await res.text(); let payload:any={}; try{payload=text?JSON.parse(text):{}}catch{payload={error:text||`API ${res.status}`}}; if(!res.ok)throw new ApiError(res.status,payload); return payload as T;
}

export interface UserProfile {id:string;email:string;displayName?:string;role:UserRole;createdAt:string;lastSeenAt:string}
export const authApi={
  login:(email:string,password:string,role?:UserRole)=>raw<{ok:true;user:UserProfile;mode:string}>('/api/v1/auth/login',{method:'POST',body:JSON.stringify({email,password,role})},false),
  logout:()=>raw<{ok:true}>('/api/v1/auth/logout',{method:'POST'},false),
  me:()=>raw<{ok:true;user:UserProfile;authDisabled:boolean}>('/api/v1/auth/me'),
  signup:(email:string,password:string,displayName?:string)=>raw<{ok:true;user?:UserProfile;mode:string;verificationRequired:boolean}>('/api/v1/auth/signup',{method:'POST',body:JSON.stringify({email,password,displayName})},false),
  recover:(email:string)=>raw<{ok:true;mode?:string}>('/api/v1/auth/recover',{method:'POST',body:JSON.stringify({email})},false),
  resetPassword:(accessToken:string,password:string)=>raw<{ok:true;mode?:string}>('/api/v1/auth/reset',{method:'POST',body:JSON.stringify({accessToken,password})},false),
};

export const accountApi={
  profile:()=>raw<{ok:true;profile:UserProfile}>('/api/v1/profile'),
  updateProfile:(displayName:string)=>raw<{ok:true;profile:UserProfile}>('/api/v1/profile',{method:'PATCH',body:JSON.stringify({displayName})}),
};

export const adminApi={
  questions:()=>raw<{ok:true;mode:string;questions:QuestionRecord[]}>('/api/v1/questions'),
  saveQuestion:(q:QuestionRecord)=>raw<{ok:true;question:QuestionRecord}>('/api/v1/questions',{method:'POST',body:JSON.stringify(q)}),
  exam:(id='JFT-MOCK-001')=>raw<{ok:true;draft:ExamDraft|null;versions:ExamVersion[]}>(`/api/v1/exams?id=${encodeURIComponent(id)}`),
  saveExam:(draft:ExamDraft)=>raw<{ok:true;draft:ExamDraft}>('/api/v1/exams',{method:'PUT',body:JSON.stringify(draft)}),
  publishExam:(examId:string)=>raw<{ok:true;version:ExamVersion}>('/api/v1/exams',{method:'POST',body:JSON.stringify({examId})}),
  attempts:()=>raw<{ok:true;attempts:Array<{id:string;examVersionId:string;status:string;startedAt:string;submittedAt?:string;answered:number;total:number;scorePercent?:number}>}>('/api/v1/attempts'),
  candidates:()=>raw<{ok:true;candidates:Array<UserProfile&{attempts:number;submitted:number;active:number;averageScore:number|null;lastAttemptAt?:string}>}>('/api/v1/admin/candidates'),
  updateCandidateRole:(id:string,role:UserRole)=>raw<{ok:true;profile:UserProfile}>(`/api/v1/admin/candidates/${encodeURIComponent(id)}`,{method:'PATCH',body:JSON.stringify({role})}),
  system:()=>raw<{ok:true;repository:string;authentication:string;assetStorage:string;aiFactory:string;apiVersion:string}>('/api/v1/system'),
  factoryJobs:()=>raw<{ok:true;jobs:FactoryJob[];provider:string}>('/api/v1/factory/jobs'),
  createFactoryJob:(input:FactoryRequest)=>raw<{ok:boolean;job:FactoryJob}>('/api/v1/factory/jobs',{method:'POST',body:JSON.stringify(input)}),
  approveFactoryCandidates:(jobId:string,candidateIds:string[])=>raw<{ok:true;approved:number;job:FactoryJob}>(`/api/v1/factory/jobs/${encodeURIComponent(jobId)}/approve`,{method:'POST',body:JSON.stringify({candidateIds})}),
  renderFactoryAudio:(jobId:string,candidateId:string)=>raw<{ok:true;job:FactoryJob;candidate:FactoryJob['candidates'][number]}>(`/api/v1/factory/jobs/${encodeURIComponent(jobId)}/candidates/${encodeURIComponent(candidateId)}/audio`,{method:'POST'}),
  sources:()=>raw<{ok:true;sources:SourceDocument[]}>('/api/v1/sources'),
  createSource:(input:{title:string;fileName?:string;sourceType?:string;content:string})=>raw<{ok:true;source:SourceDocument}>('/api/v1/sources',{method:'POST',body:JSON.stringify(input)}),
  source:(id:string)=>raw<{ok:true;source:SourceDocument;chunks:SourceChunk[];knowledgeUnits:KnowledgeUnit[];plans:QuestionPlan[];provenance:QuestionProvenance[]}>(`/api/v1/sources/${id}`),
  chunkSource:(id:string)=>raw<{ok:true;chunks:SourceChunk[]}>(`/api/v1/sources/${id}/chunk`,{method:'POST',body:'{}'}),
  extractSource:(id:string)=>raw<{ok:true;knowledgeUnits:KnowledgeUnit[]}>(`/api/v1/sources/${id}/extract`,{method:'POST',body:JSON.stringify({maxKnowledgeUnits:20})}),
  approveKnowledge:(id:string)=>raw<{ok:true;knowledgeUnit:KnowledgeUnit}>(`/api/v1/knowledge/${id}/approve`,{method:'POST'}),
  planSource:(id:string,requestedCount:number)=>raw<{ok:true;plan:QuestionPlan}>(`/api/v1/sources/${id}/plan`,{method:'POST',body:JSON.stringify({requestedCount})}),
  generatePlan:(id:string)=>raw<{ok:true;plan:QuestionPlan;jobs:FactoryJob[]}>(`/api/v1/question-plans/${id}/generate`,{method:'POST'}),
  contentProduction:()=>raw<{ok:true;levels:Record<string,{approved:number;targetMin:number;targetMax:number;coverage:{total:number;covered:number};readiness:ReadinessResult}>;sources:{total:number;approvedKnowledgeUnits:number};deficits:CoverageCell[];qa:{listeningAudioDeficits:number;outOfCurriculumFailures:number}}>('/api/v1/content-production'),
};

export type CandidateQuestion=Omit<Question,'answer'|'explanationVi'> & {answer?:never;explanationVi?:never};
export interface CandidateExam {id:string;title:string;durationMinutes:number;rules:Array<{section:SectionId;allowBack:boolean}>;questions:CandidateQuestion[]}
export interface CandidateSession {id:string;examVersionId:string;status:'active'|'submitted'|'expired';startedAt:string;expiresAt:string;currentIndex:number;answers:Record<string,number>}
export interface ServerResult {correct:number;total:number;scorePercent:number;answered:number;sectionScores:Record<string,{correct:number;total:number;percent:number}>;submittedAt:string}
export interface CandidateAttempt {id:string;examVersionId:string;examTitle:string;status:'active'|'submitted'|'expired';startedAt:string;expiresAt:string;submittedAt?:string;currentIndex:number;answered:number;total:number;scorePercent?:number}

export const candidateApi={
  latestExam:()=>raw<{ok:true;version:{id:string;examId:string;title:string;durationMinutes:number;publishedAt:string}|null}>('/api/v1/exams/published'),
  attempts:()=>raw<{ok:true;attempts:CandidateAttempt[]}>('/api/v1/sessions'),
  createSession:(examVersionId:string)=>raw<{ok:true;session:CandidateSession;exam:CandidateExam}>('/api/v1/sessions',{method:'POST',body:JSON.stringify({examVersionId})}),
  resume:(sessionId:string)=>raw<{ok:true;session:CandidateSession;exam:CandidateExam}>(`/api/v1/sessions/${encodeURIComponent(sessionId)}`),
  saveAnswer:(sessionId:string,questionId:string|undefined,choice:number|undefined,currentIndex:number)=>raw<{ok:true;savedAt:string}>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/answers`,{method:'PUT',body:JSON.stringify({questionId,choice,currentIndex})}),
  submit:(sessionId:string)=>raw<{ok:true;result:ServerResult}>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/submit`,{method:'POST'}),
  result:(sessionId:string)=>raw<{ok:true;result:ServerResult;exam:{id:string;title:string}}>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/result`),
};

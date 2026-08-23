import { describe,expect,it } from 'vitest';
import type { ExamVersion, QuestionRecord } from '@/lib/admin-types';
import type { CandidateSessionRecord } from '@/lib/server/domain';
import { canAccessSession, expireSessionIfNeeded, finalizeSessionForSubmission, validateSessionMutation } from '@/lib/server/session-invariants';

const q=(id:string,section:QuestionRecord['section'],choices=['a','b']):QuestionRecord=>({id,section,type:section==='listening'?'audio_choice':'choice',level:'A2.1',instruction:'i',prompt:'p',choices,answer:0,explanationVi:'e',audioSrc:section==='listening'?'audio.mp3':undefined,tags:[],version:1,status:'approved',source:'original',createdAt:'2026-01-01T00:00:00Z',updatedAt:'2026-01-01T00:00:00Z'});
const version:ExamVersion={id:'e-v1',examId:'e',version:1,title:'E',durationMinutes:60,createdAt:'2026-01-01T00:00:00Z',publishedAt:'2026-01-01T00:00:00Z',rules:[{section:'script_vocabulary',count:1,allowBack:true,levels:['A2.1']},{section:'listening',count:3,allowBack:false,levels:['A2.1']}],questions:[q('q1','script_vocabulary'),q('q2','listening'),q('q3','listening'),q('q4','listening')].map(x=>({questionId:x.id,questionVersion:1,snapshot:x}))};
const session=(patch:Partial<CandidateSessionRecord>={}):CandidateSessionRecord=>({id:'s',examVersionId:'e-v1',candidateId:'u1',status:'active',startedAt:'2026-01-01T00:00:00Z',expiresAt:'2099-01-01T00:00:00Z',currentIndex:0,answers:{},...patch});

describe('session integrity',()=>{
  it('rejects forged question ids and invalid choices',()=>{
    expect(validateSessionMutation(version,session(),{questionId:'fake',choice:0,currentIndex:0}).ok).toBe(false);
    expect(validateSessionMutation(version,session(),{questionId:'q1',choice:9,currentIndex:0}).ok).toBe(false);
  });
  it('allows an answer bundled with the forward currentIndex autosave',()=>{
    expect(validateSessionMutation(version,session({currentIndex:0}),{questionId:'q2',choice:1,currentIndex:1}).ok).toBe(true);
  });
  it('blocks changing a listening answer after moving forward',()=>{
    const result=validateSessionMutation(version,session({currentIndex:2}),{questionId:'q2',choice:1,currentIndex:2});
    expect(result.ok).toBe(false);
  });
  it('blocks back navigation in a no-back section',()=>{
    expect(validateSessionMutation(version,session({currentIndex:2}),{currentIndex:1}).ok).toBe(false);
  });
  it('blocks skipping ahead inside a sequential listening section',()=>{
    const result=validateSessionMutation(version,session({currentIndex:1}),{currentIndex:3});
    expect(result.ok).toBe(false);
  });
  it('enforces ownership but permits admins',()=>{
    const s=session();
    expect(canAccessSession(s,'u1','candidate')).toBe(true);
    expect(canAccessSession(s,'u2','candidate')).toBe(false);
    expect(canAccessSession(s,'u2','admin')).toBe(true);
  });
  it('does not expose ownerless legacy sessions to candidates',()=>{
    const legacy=session({candidateId:undefined});
    expect(canAccessSession(legacy,'u1','candidate')).toBe(false);
    expect(canAccessSession(legacy,'admin','admin')).toBe(true);
  });
  it('marks expired sessions deterministically',()=>{
    const s=session({expiresAt:'2020-01-01T00:00:00Z'});
    expect(expireSessionIfNeeded(s,Date.parse('2021-01-01T00:00:00Z'))).toBe(true);
    expect(s.status).toBe('expired');
  });
  it('auto-finalizes saved answers at the deadline instead of allowing late edits',()=>{
    const s=session({expiresAt:'2020-01-01T00:00:00Z',answers:{q1:0}});
    const r=finalizeSessionForSubmission(s,Date.parse('2021-01-01T00:00:00Z'));
    expect(r.ok).toBe(true); expect(r.ok&&r.timedOut).toBe(true); expect(s.status).toBe('submitted'); expect(s.submittedAt).toBe(s.expiresAt);
  });
});

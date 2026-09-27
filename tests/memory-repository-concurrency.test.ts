import { describe,expect,it } from 'vitest';
import { MemoryRepository } from '@/lib/server/memory-repository';

describe('autosave concurrency',()=>{
  it('merges independent answer writes instead of replacing the answers object',async()=>{
    const repo=new MemoryRepository();const id=crypto.randomUUID();
    await repo.createSession({id,examVersionId:'JFT-MOCK-001-v1',candidateId:'qa-user',status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),currentIndex:0,answers:{}});
    await Promise.all([repo.saveSessionProgress(id,{questionId:'q-a',choice:0}),repo.saveSessionProgress(id,{questionId:'q-b',choice:1})]);
    const s=await repo.getSession(id);expect(s?.answers).toMatchObject({'q-a':0,'q-b':1});
  });

  it('rejects a stale tab after another tab advances the session',async()=>{
    const repo=new MemoryRepository();const id=crypto.randomUUID();
    await repo.createSession({id,examVersionId:'JFT-MOCK-001-v1',candidateId:'qa-user',status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),currentIndex:0,answers:{}});
    const advanced=await repo.saveSessionProgress(id,{currentIndex:1,expectedCurrentIndex:0});
    expect(advanced?.currentIndex).toBe(1);
    const stale=await repo.saveSessionProgress(id,{questionId:'q-old',choice:1,currentIndex:0,expectedCurrentIndex:0});
    expect(stale).toBeNull();
    const saved=await repo.getSession(id);
    expect(saved?.currentIndex).toBe(1);
    expect(saved?.answers).not.toHaveProperty('q-old');
  });
});

describe('submission concurrency',()=>{
  it('preserves concurrent autosaves and makes submitted state terminal',async()=>{
    const repo=new MemoryRepository();const id=crypto.randomUUID();
    await repo.createSession({id,examVersionId:'JFT-MOCK-001-v1',candidateId:'qa-user',status:'active',startedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60000).toISOString(),currentIndex:0,answers:{}});
    const stale=(await repo.getSession(id))!;
    await repo.saveSessionProgress(id,{questionId:'q-a',choice:1});
    const submitted=await repo.saveSession({...stale,status:'submitted',submittedAt:new Date().toISOString()});
    expect(submitted.answers).toEqual({'q-a':1});
    const expired=await repo.saveSession({...stale,status:'expired'});
    expect(expired.status).toBe('submitted');expect(expired.answers).toEqual({'q-a':1});
    expect(await repo.saveSessionProgress(id,{questionId:'q-a',choice:0})).toBeNull();
  });
});

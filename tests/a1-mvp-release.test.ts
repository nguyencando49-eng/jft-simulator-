import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe,expect,it } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import { MemoryRepository } from '@/lib/server/memory-repository';
import { A1_MVP_MAX_PAIRWISE_OVERLAP, A1_MVP_MAX_QUESTION_REUSE, buildA1MvpReleasePack, publishA1MvpReleasePack, syncApprovedAuthoredSeed } from '@/lib/server/a1-mvp-release';

describe('A1 MVP five-exam release pack',()=>{
  it('builds five reproducible approved A1 exams with two questions per section',()=>{
    const first=buildA1MvpReleasePack(seedQuestions,'2026-08-23T00:00:00.000Z');
    const second=buildA1MvpReleasePack(seedQuestions,'2026-08-24T00:00:00.000Z');
    expect(first.versions).toHaveLength(5);
    expect(first.versions.map(version=>version.questions.map(item=>item.questionId))).toEqual(second.versions.map(version=>version.questions.map(item=>item.questionId)));
    for(const version of first.versions){
      expect(version.questions).toHaveLength(8);
      expect(new Set(version.questions.map(item=>item.questionId)).size).toBe(8);
      expect(version.questions.every(item=>item.snapshot.status==='approved'&&item.snapshot.level==='A1')).toBe(true);
      for(const section of ['script_vocabulary','conversation_expression','listening','reading'])expect(version.questions.filter(item=>item.snapshot.section===section)).toHaveLength(2);
    }
    expect(first.report.uniqueQuestionCount).toBe(17);
    expect(first.report.maxQuestionReuse).toBeLessThanOrEqual(A1_MVP_MAX_QUESTION_REUSE);
    expect(first.report.maxPairwiseOverlap).toBeLessThanOrEqual(A1_MVP_MAX_PAIRWISE_OVERLAP);
    expect(first.report.maxPairwiseOverlapRatio).toBe(0.375);
  });

  it('requires complete playable Azure WAV evidence for every Listening item',()=>{
    const pack=buildA1MvpReleasePack(seedQuestions);
    const manifestPath=join(process.cwd(),'data','production','a1-mvp-audio-manifest.json');
    expect(existsSync(manifestPath)).toBe(true);
    const manifest=JSON.parse(readFileSync(manifestPath,'utf8')) as {provider:string;format:string;entries:Array<{questionId:string;audioSrc:string;sha256:string}>};
    expect(manifest.provider).toBe('azure');
    expect(manifest.format).toBe('riff-48khz-16bit-mono-pcm');
    expect(new Set(manifest.entries.map(entry=>entry.questionId))).toEqual(new Set(pack.report.listeningQuestionIds));
    for(const entry of manifest.entries){
      const bytes=readFileSync(join(process.cwd(),'public',entry.audioSrc.replace(/^\//,'')));
      expect(bytes.subarray(0,4).toString()).toBe('RIFF');
      expect(bytes.readUInt16LE(22)).toBe(1);
      expect(bytes.readUInt32LE(24)).toBe(48_000);
      expect(bytes.readUInt16LE(34)).toBe(16);
      expect(bytes.length).toBeGreaterThan(1_000);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(entry.sha256);
    }
  });

  it('hard-stops when a required question is not approved or audio is missing',()=>{
    const unapproved=seedQuestions.map(question=>question.id==='SV-001'?{...question,status:'review' as const}:question);
    expect(()=>buildA1MvpReleasePack(unapproved)).toThrowError(expect.objectContaining({code:'A1_MVP_QUESTION_NOT_APPROVED'}));
    const missingAudio=seedQuestions.map(question=>question.id==='LI-001'?{...question,audioSrc:undefined}:question);
    expect(()=>buildA1MvpReleasePack(missingAudio)).toThrowError(expect.objectContaining({code:'A1_MVP_AUDIO_MISSING'}));
  });

  it('publishes idempotently and never replaces an immutable version',async()=>{
    const repo=new MemoryRepository();
    const first=await publishA1MvpReleasePack(repo,'2026-08-23T00:00:00.000Z');
    expect(first.published).toHaveLength(5);
    const frozenBefore=(await repo.listExamVersions()).filter(version=>version.examId.startsWith('JFT-A1-'));
    const second=await publishA1MvpReleasePack(repo,'2026-08-24T00:00:00.000Z');
    expect(second.published).toEqual([]);
    expect(second.skipped).toHaveLength(5);
    const frozenAfter=(await repo.listExamVersions()).filter(version=>version.examId.startsWith('JFT-A1-'));
    expect(frozenAfter).toEqual(frozenBefore);
  });

  it('promotes only the 50 canonical authored seeds and leaves mass review content untouched',async()=>{
    const repo=new MemoryRepository();
    const authored=await repo.getExamDraft('JFT-MOCK-001');
    expect(authored).toBeTruthy();
    const sv001=(await repo.listQuestions()).find(question=>question.id==='SV-001')!;
    await repo.upsertQuestion({...sv001,status:'review'});
    const massBefore=(await repo.listQuestions()).find(question=>question.id.startsWith('PROD-'))!;
    expect(massBefore.status).toBe('review');
    const result=await syncApprovedAuthoredSeed(repo,'2026-08-23T00:00:00.000Z');
    expect(result.promoted).toContain('SV-001');
    expect((await repo.listQuestions()).filter(question=>['SV-001','SV-002','CE-001'].includes(question.id)).every(question=>question.status==='approved')).toBe(true);
    expect((await repo.listQuestions()).find(question=>question.id===massBefore.id)?.status).toBe('review');
  });
});

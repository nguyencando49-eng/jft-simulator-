import { describe,expect,it } from 'vitest';
import { completeProductionQuestionSet, massQuestionCandidates } from '@/data/production/mass-question-candidates';
import { curriculumCatalog } from '@/data/production/curriculum-catalog';
import { runQuestionQa } from '@/lib/server/qa';
import { findNearDuplicates } from '@/lib/server/duplicate-detection';
import { existsSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';
import { seedQuestions } from '@/data/admin/seed';

describe('2,100-question controlled production batch',()=>{
  it('contains exactly 2,100 unique questions, balanced by level and section',()=>{
    expect(completeProductionQuestionSet).toHaveLength(2100);
    expect(seedQuestions).toHaveLength(2100);
    expect(new Set(completeProductionQuestionSet.map(q=>q.id)).size).toBe(2100);
    for(const level of ['A1','A2.1','A2.2']){
      expect(completeProductionQuestionSet.filter(q=>q.level===level)).toHaveLength(700);
      for(const section of ['script_vocabulary','conversation_expression','listening','reading'])expect(completeProductionQuestionSet.filter(q=>q.level===level&&q.section===section)).toHaveLength(175);
    }
  });
  it('keeps every mass-produced item in human review with curriculum provenance',()=>{
    const unitIds=new Set(curriculumCatalog.map(u=>u.id));
    expect(massQuestionCandidates).toHaveLength(2030);
    for(const q of massQuestionCandidates){expect(q.productionStatus).toBe('REVIEW');expect(q.knowledgeUnitIds.every(id=>unitIds.has(id)),q.id).toBe(true);expect(q.sourceDocument).toBeTruthy();}
  });
  it('passes structural QA before the audio-file gate',()=>{
    for(const q of massQuestionCandidates){const record={...q,type:q.type==='audio_choice'?'choice' as const:q.type,version:1,status:'review' as const,source:'ai' as const,createdAt:'x',updatedAt:'x'};expect(runQuestionQa(record).passed,q.id).toBe(true);}
  });
  it('has no exact duplicate prompt and balances correct answer positions',()=>{
    expect(new Set(massQuestionCandidates.map(q=>q.prompt)).size).toBe(massQuestionCandidates.length);
    expect(new Set(massQuestionCandidates.map(q=>q.answer))).toEqual(new Set([0,1,2,3]));
  });
  it('has no near-duplicate prompt at the production threshold',()=>{
    const duplicates=findNearDuplicates(massQuestionCandidates,q=>q.prompt,.82);
    expect(duplicates.slice(0,10).map(x=>({a:x.a.id,b:x.b.id,score:x.score}))).toEqual([]);
  },120000);
  it('has a valid fixed MP3 asset for every generated listening question',()=>{
    const listening=massQuestionCandidates.filter(q=>q.section==='listening');
    expect(listening).toHaveLength(508);
    for(const q of listening){const path=join(process.cwd(),'public',q.audioSrc!.replace(/^\//,''));expect(existsSync(path),q.id).toBe(true);expect(statSync(path).size,q.id).toBeGreaterThan(1000);const head=readFileSync(path).subarray(0,3);expect(head.toString('ascii')==='ID3'||(head[0]===0xff&&(head[1]&0xe0)===0xe0),q.id).toBe(true);const report=runQuestionQa({...q,version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});expect(report.passed,q.id).toBe(true);}
  });
});

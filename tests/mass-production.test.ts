import { describe,expect,it } from 'vitest';
import { completeProductionQuestionSet, massQuestionCandidates } from '@/data/production/mass-question-candidates';
import { curriculumCatalog } from '@/data/production/curriculum-catalog';
import { runQuestionQa } from '@/lib/server/qa';
import { findNearDuplicates } from '@/lib/server/duplicate-detection';
import { existsSync,readFileSync,statSync } from 'node:fs';
import { join } from 'node:path';
import { seedQuestions } from '@/data/admin/seed';

describe('3,000-question controlled production batch',()=>{
  it('contains exactly 3,000 unique questions and 1,000 per level',()=>{
    expect(completeProductionQuestionSet).toHaveLength(3000);
    expect(seedQuestions).toHaveLength(3000);
    expect(new Set(completeProductionQuestionSet.map(q=>q.id)).size).toBe(3000);
    for(const level of ['A1','A2.1','A2.2'] as const){
      const levelQuestions=completeProductionQuestionSet.filter(q=>q.level===level);
      expect(levelQuestions).toHaveLength(1000);
      expect(levelQuestions.filter(q=>q.section==='script_vocabulary')).toHaveLength(275);
      expect(levelQuestions.filter(q=>q.section==='conversation_expression')).toHaveLength(275);
      expect(levelQuestions.filter(q=>q.section==='listening')).toHaveLength(175);
      expect(levelQuestions.filter(q=>q.section==='reading')).toHaveLength(275);
    }
  });
  it('keeps generated items in review with canonical metadata and curriculum provenance',()=>{
    const unitIds=new Set(curriculumCatalog.map(u=>u.id));
    expect(massQuestionCandidates).toHaveLength(2930);
    for(const q of massQuestionCandidates){
      expect(q.productionStatus).toBe('REVIEW');
      expect(q.knowledgeUnitIds.every(id=>unitIds.has(id)),q.id).toBe(true);
      expect(q.sourceDocument).toBeTruthy();
      expect(q.tags).toContain(`category:${q.category}`);
      expect(q.tags.some(tag=>tag.startsWith('topic:'))).toBe(true);
      expect(q.tags.some(tag=>tag.startsWith('can-do:'))).toBe(true);
      expect(q.tags).toContain('generator:controlled-v3');
    }
  });
  it('passes deterministic structural QA before the audio-file gate',()=>{
    for(const q of massQuestionCandidates){
      const record={...q,type:q.type==='audio_choice'?'choice' as const:q.type,version:1,status:'review' as const,source:'ai' as const,createdAt:'x',updatedAt:'x'};
      expect(runQuestionQa(record).passed,q.id).toBe(true);
    }
  });
  it('has unique IDs and all four answer positions',()=>{
    expect(new Set(massQuestionCandidates.map(q=>q.id)).size).toBe(massQuestionCandidates.length);
    expect(new Set(massQuestionCandidates.map(q=>q.answer))).toEqual(new Set([0,1,2,3]));
  });
  it('does not produce near-identical learner-visible prompts at the production threshold',()=>{
    const duplicates=findNearDuplicates(massQuestionCandidates,q=>q.prompt,.94);
    expect(duplicates.slice(0,10).map(x=>({a:x.a.id,b:x.b.id,score:x.score}))).toEqual([]);
  },120000);
  it('has a valid fixed MP3 asset for every generated listening question',()=>{
    const listening=massQuestionCandidates.filter(q=>q.section==='listening');
    expect(listening).toHaveLength(508);
    for(const q of listening){
      const path=join(process.cwd(),'public',q.audioSrc!.replace(/^\//,''));
      expect(existsSync(path),q.id).toBe(true);
      expect(statSync(path).size,q.id).toBeGreaterThan(1000);
      const head=readFileSync(path).subarray(0,3);
      expect(head.toString('ascii')==='ID3'||(head[0]===0xff&&(head[1]&0xe0)===0xe0),q.id).toBe(true);
      const report=runQuestionQa({...q,version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});
      expect(report.passed,q.id).toBe(true);
    }
  });
});

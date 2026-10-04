import { describe, expect, it } from 'vitest';
import { seedQuestions } from '@/data/admin/seed';
import { buildProductionExamReleasePack } from '@/lib/server/production-release';
import { toCandidateExamSummary } from '@/lib/server/candidate-exam';
import { assertProductionCatalog } from '@/lib/server/production-catalog-check';

const catalog=buildProductionExamReleasePack(seedQuestions).versions.map(toCandidateExamSummary);
describe('persisted production catalog smoke gate',()=>{
  it('requires all 60 current snapshots',()=>{
    expect(assertProductionCatalog(catalog)).toEqual({examCount:60,examsPerLevel:20});
    expect(()=>assertProductionCatalog(catalog.filter(item=>item.examId.endsWith('-001')))).toThrow('Expected one published form');
  });
  it.each(['legacy','duplicate','sections','count'])('rejects %s catalog data',kind=>{
    const values=structuredClone(catalog);
    if(kind==='legacy')values[0].id=values[0].id.replace('-v3','-v2');
    if(kind==='duplicate')values.push(values[0]);
    if(kind==='sections')values[0].sections=['reading','reading','reading','reading'];
    if(kind==='count')values[0].questionCount=8;
    expect(()=>assertProductionCatalog(values)).toThrow();
  });
});

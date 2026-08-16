import { describe,expect,it } from 'vitest';
import type { QuestionRecord } from '@/lib/admin-types';
import type { KnowledgeUnit } from '@/lib/server/source-domain';
import { assembleExam, calculateCoverage, checkExamReadiness, generateExamSet, pairwiseOverlap, runCurriculumQa, type ExamBlueprintVersion } from '@/lib/server/curriculum-production';

const unit:KnowledgeUnit={id:'u1',sourceDocumentId:'s1',sourceChunkIds:['c1'],chapter:'01',topic:'shopping',situation:'shop',level:'A1',canDo:'Can ask a price',grammar:['いくらですか'],vocabulary:['りんご','百円'],kanji:['百','円'],expressions:['いくらですか'],keyKnowledge:['りんごは百円です'],skills:['vocabulary','conversation','reading'],confidence:.9,status:'approved',createdAt:'x',provider:'mock',promptVersion:'v1'};
const q=(id:string,section:QuestionRecord['section']='reading'):QuestionRecord=>({id,section,type:section==='listening'?'audio_choice':'choice',level:'A1',instruction:'選んでください',prompt:'りんごはいくらですか',choices:['百円です','二百円です'],answer:0,explanationVi:'Giá là 100 yên.',audioSrc:section==='listening'?'/audio/x.wav':undefined,tags:[`topic-${Number(id.replace(/\D/g,''))%10}`,`cando-${Number(id.replace(/\D/g,''))%12}`,'medium'],version:1,status:'approved',source:'ai',createdAt:'x',updatedAt:'x'});
const blueprint:ExamBlueprintVersion={version:'TEST_V1',level:'A1',totalQuestions:4,sectionQuotas:{script_vocabulary:1,conversation_expression:1,listening:1,reading:1},difficultyTargets:{easy:1,medium:2,hard:1},minTopics:2,minCanDos:2,maxReuse:2,maxOverlap:.75,status:'active'};

describe('curriculum grounding',()=>{
  it('passes supported knowledge and hard-fails unsupported required knowledge',()=>{expect(runCurriculumQa(q('Q1'),[unit]).hardFail).toBe(false);const outside={...q('Q2'),prompt:'病院の予約はいつですか',choices:['月曜日','火曜日']};const result=runCurriculumQa(outside,[unit]);expect(result.hardFail).toBe(true);expect(result.outsideKnowledge.length).toBeGreaterThan(0);});
  it('counts approved provenance and exposes deficits',()=>{const cells=calculateCoverage([unit],[q('Q1')],[{id:'p',questionId:'Q1',sourceDocumentId:'s1',sourceChunkIds:['c1'],knowledgeUnitId:'u1',questionPlanId:'plan',factoryJobId:'job',generatorProvider:'mock',generatorPromptVersion:'v1',qaProvider:'mock',createdAt:'x'}],2);expect(cells.every(c=>c.approved===1&&c.deficit===1)).toBe(true);});
});

describe('constrained exam production',()=>{
  const bank=['script_vocabulary','conversation_expression','listening','reading'].flatMap((s,si)=>Array.from({length:6},(_,i)=>q(`Q${si*6+i+1}`,s as QuestionRecord['section'])));
  it('is deterministic and respects section quotas',()=>{const a=assembleExam({level:'A1',blueprint,seed:'same',questions:bank}),b=assembleExam({level:'A1',blueprint,seed:'same',questions:bank});expect(a.questionIds).toEqual(b.questionIds);expect(a.coverage.sections).toEqual(blueprint.sectionQuotas);});
  it('checks readiness, reuse and pairwise overlap',()=>{expect(checkExamReadiness('A1',bank,blueprint,3).status).toBe('READY');const set=generateExamSet({level:'A1',examCount:3,blueprint,seed:'set',questions:bank});const usage=new Map<string,number>();set.exams.flatMap(e=>e.questionIds).forEach(id=>usage.set(id,(usage.get(id)||0)+1));expect(Math.max(...usage.values())).toBeLessThanOrEqual(2);expect(pairwiseOverlap(set.exams[0],set.exams[1])).toBeLessThanOrEqual(1);});
  it('returns an explicit insufficient-bank domain error',()=>{expect(()=>assembleExam({level:'A1',blueprint,seed:'x',questions:bank.slice(0,2)})).toThrow(/requires/);});
});

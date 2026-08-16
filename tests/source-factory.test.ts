import { describe,expect,it } from 'vitest';
import { parseSource,chunkSourceText } from '@/lib/server/source-service';
import { SourceFactoryError,assertKnowledgeUnit } from '@/lib/server/source-domain';
import { checkSourceSimilarity } from '@/lib/server/source-similarity';
import { MockQuestionPlanningProvider,MockSourceKnowledgeProvider } from '@/lib/server/source-providers';
import { runFactoryJob,approveFactoryCandidates } from '@/lib/server/factory-service';
import { getRepository } from '@/lib/server/repository';
import type { FactoryJob } from '@/lib/server/factory-domain';

const fixture='病院で受付をします。\n\n受付で保険証を出します。\n\nどこが痛いか簡単に説明します。\n\n診察が終わったら会計をします。';
describe('source ingestion',()=>{
 it('rejects empty and unsupported sources',()=>{expect(()=>parseSource({title:'x',content:'  '},'admin')).toThrow(SourceFactoryError);expect(()=>parseSource({title:'x',content:'abc',sourceType:'pdf'},'admin')).toThrow(/PDF/);});
 it('chunks deterministically within configured size',()=>{const doc=parseSource({title:'hospital',content:fixture},'admin');const chunks=chunkSourceText(doc,200);expect(chunks.length).toBeGreaterThan(0);expect(chunks.every((x,i)=>x.sequence===i&&x.normalizedText.length>0)).toBe(true);});
 it('extracts structured knowledge but no answer key',async()=>{const doc=parseSource({title:'hospital',content:fixture},'admin'),chunks=chunkSourceText(doc,200);const result=await new MockSourceKnowledgeProvider().extract({document:doc,chunks,maxKnowledgeUnits:20});expect(result.units.length).toBeGreaterThan(0);result.units.forEach(assertKnowledgeUnit);expect(JSON.stringify(result.units)).not.toContain('"answer"');});
});
describe('planning and originality',()=>{
 it('creates a mixed question plan with requested count',async()=>{const result=await new MockQuestionPlanningProvider().plan({requestedCount:4,units:[{id:'u',sourceDocumentId:'s',sourceChunkIds:['c'],topic:'病院',situation:'受付',level:'A2.1',canDo:'受付で説明できる',grammar:[],vocabulary:[],expressions:[],keyKnowledge:['保険証を出す'],skills:['vocabulary','conversation','listening','reading'],confidence:.8,status:'approved',createdAt:'x',provider:'mock',promptVersion:'v1'}]});expect(result.items).toHaveLength(4);expect(new Set(result.items.map(x=>x.section)).size).toBe(4);});
 it('fails a near-copy and passes a new context',()=>{expect(checkSourceSimilarity('受付で保険証を出します。',{source:[{id:'c',text:'受付で保険証を出します。'}]},.7).passed).toBe(false);expect(checkSourceSimilarity('薬局で番号札を取って待ちます。',{source:[{id:'c',text:'受付で保険証を出します。'}]},.7).passed).toBe(true);});
 it('rejects invalid provider-shaped knowledge',()=>{expect(()=>assertKnowledgeUnit({topic:'x'})).toThrow(/schema/);});
 it('keeps an originality failure blocking approval after QA is refreshed',async()=>{
  const now=new Date().toISOString();
  const makeJob=(id:string,sourceTexts?:string[]):FactoryJob=>({id,requestedBy:'admin',status:'queued',provider:'mock',createdAt:now,updatedAt:now,candidates:[],request:{section:'reading',level:'A2.1',topic:'originality-gate',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:false},...(sourceTexts?{sourceContext:{sourceDocumentId:'s',sourceChunkIds:['c'],knowledgeUnitId:'u',questionPlanId:'p',objective:'test',sourceTexts,originalityPromptVersion:'source-originality-v1'}}:{})});
  const baseline=await runFactoryJob(makeJob(`baseline-${crypto.randomUUID()}`));
  const copied=`${baseline.candidates[0].question.prompt} ${baseline.candidates[0].question.choices.join(' ')}`;
  const guarded=await runFactoryJob(makeJob(`guarded-${crypto.randomUUID()}`,[copied]));
  expect(guarded.candidates[0].qa.issues.some(x=>x.code==='source_similarity')).toBe(true);
  const before=(await getRepository().listQuestions()).length;
  const result=await approveFactoryCandidates(guarded.id,[guarded.candidates[0].id]);
  expect(result.approved).toBe(0);
  expect(result.job.candidates[0].qa.issues.some(x=>x.code==='source_similarity')).toBe(true);
  expect((await getRepository().listQuestions()).length).toBe(before);
 });
});

import {afterEach,describe,expect,it,vi} from 'vitest';
import type {FactoryJob} from '@/lib/server/factory-domain';
import {CURRICULUM_GROUNDING_PROMPT_VERSION} from '@/lib/server/curriculum-grounding';
import {DIFFICULTY_CALIBRATION_PROMPT_VERSION,type DifficultyCalibrationAnalysis} from '@/lib/server/difficulty-calibration';
import {JFT_ALIGNMENT_PROMPT_VERSION} from '@/lib/server/jft-alignment';
import {MockJftAlignmentProvider} from '@/lib/server/jft-alignment-provider';
import {ORIGINALITY_DUPLICATE_PROMPT_VERSION} from '@/lib/server/originality-duplicate';
import {approveFactoryCandidates} from '@/lib/server/factory-service';
import {getRepository} from '@/lib/server/repository';

const now='2026-08-23T00:00:00.000Z';
const profile={linguisticComplexity:.18,cognitiveComplexity:.2,processingLoad:.22,distractorCompetitiveness:.2,informationDensity:.2,modalityLoad:.05};
function qa6(input:any):DifficultyCalibrationAnalysis{return {qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:input.questionId,confidence:'HIGH',profile,reasoningDepth:'DIRECT_MATCH',distractorStrength:'MODERATE',acousticAssessment:'NOT_APPLICABLE',evidence:{linguisticComplexity:'Basic opening-hours vocabulary.',cognitiveComplexity:'One direct lookup.',processingLoad:'A short practical schedule.',distractorCompetitiveness:'Plausible neighboring times.',informationDensity:'One relevant day and time.',modalityLoad:'Simple written lookup.',reasoningDepth:'Directly match Monday with its closing time.'}}}

async function fixture(){
  const suffix=crypto.randomUUID(),sourceId=`SRC-QA7-${suffix}`,chunkId=`SC-QA7-${suffix}`,unitId=`KU-QA7-${suffix}`,jobId=`JOB-QA7-${suffix}`,candidateId=`C-QA7-${suffix}`,questionId=`Q-QA7-${suffix}`,repo=getRepository();
  const sourceText='教材では、店の案内表から曜日ごとの閉店時刻を探し、正しい選択肢を選ぶ練習をします。';
  await repo.saveSourceDocument({id:sourceId,title:'Synthetic QA7 shop fixture',sourceType:'text',language:'ja',createdAt:now,updatedAt:now,createdBy:'admin',status:'ready',metadata:{notes:'Synthetic tests only.'},rawText:sourceText});
  await repo.saveSourceChunks([{id:chunkId,sourceDocumentId:sourceId,sequence:0,rawText:sourceText,normalizedText:sourceText,createdAt:now}]);
  await repo.saveKnowledgeUnits([{id:unitId,sourceDocumentId:sourceId,sourceChunkIds:[chunkId],topic:'店',situation:'営業時間',level:'A1',canDo:'営業時間表から閉店時間を探す',grammar:['～です','～ます'],vocabulary:['店','営業時間','月曜日','時','閉まります'],kanji:['店','営業時間','月曜日','時'],expressions:[],keyKnowledge:['営業時間から時刻を探す'],skills:['reading'],confidence:.98,status:'approved',createdAt:now,updatedAt:now,provider:'synthetic-test',promptVersion:'test-v1'}]);
  const question={id:questionId,section:'reading' as const,type:'choice' as const,level:'A1' as const,instruction:'営業時間を見て答えてください。',prompt:'【営業時間】さくら店　月曜日は18時に閉まります。月曜日は何時に閉まりますか。',choices:['16時','17時','18時','19時'],answer:2,explanationVi:'Cửa hàng đóng cửa lúc 18 giờ.',tags:['店','営業時間表から閉店時間を探す'],version:1,status:'review' as const,source:'ai' as const,createdAt:now,updatedAt:now};
  const job:FactoryJob={id:jobId,requestedBy:'admin',status:'review',provider:'synthetic-test',createdAt:now,updatedAt:now,request:{section:'reading',level:'A1',topic:'店',canDo:'営業時間表から閉店時間を探す',category:'information_search',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:false},sourceContext:{sourceDocumentId:sourceId,sourceChunkIds:[chunkId],knowledgeUnitId:unitId,knowledgeUnitIds:[unitId],questionPlanId:`PLAN-${suffix}`,objective:'information_search',sourceTexts:[sourceText],originalityPromptVersion:'source-originality-v1'},candidates:[{id:candidateId,question,qa:{passed:true,score:100,issues:[]},generation:{provider:'synthetic-test',promptVersion:'test-v1',createdAt:now}}]};
  await repo.saveFactoryJob(job);return {repo,job,unitId,chunkId,questionId};
}

function stubProviders(unitId:string,chunkId:string,qa7Mode:'copy'|'invalid'){
  vi.stubEnv('CURRICULUM_GROUNDING_PROVIDER','http');vi.stubEnv('CURRICULUM_GROUNDING_ENDPOINT','https://qa4.test/evaluate');
  vi.stubEnv('JFT_ALIGNMENT_PROVIDER','http');vi.stubEnv('JFT_ALIGNMENT_ENDPOINT','https://qa5.test/classify');
  vi.stubEnv('DIFFICULTY_CALIBRATION_PROVIDER','http');vi.stubEnv('DIFFICULTY_CALIBRATION_ENDPOINT','https://qa6.test/estimate');vi.stubEnv('DIFFICULTY_CALIBRATION_API_KEY','test');
  vi.stubEnv('ORIGINALITY_DUPLICATE_PROVIDER','http');vi.stubEnv('ORIGINALITY_DUPLICATE_ENDPOINT','https://qa7.test/analyze');vi.stubEnv('ORIGINALITY_DUPLICATE_API_KEY','test');
  vi.stubGlobal('fetch',vi.fn(async(url,init)=>{const payload=JSON.parse(String((init as RequestInit).body));
    if(String(url).includes('qa4.test'))return new Response(JSON.stringify({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',knowledgeAnalysis:[{type:'VOCABULARY',value:'営業時間',role:'REQUIRED',source:'STEM',support:'SUPPORTED',knowledgeUnitIds:[unitId],sourceChunkIds:[chunkId],evidence:'The approved unit teaches 営業時間.',reason:'The learner must locate shop hours.',contradictedByCurriculum:false}]}),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa5.test'))return new Response(JSON.stringify(await new MockJftAlignmentProvider().classify(payload.input)),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa6.test'))return new Response(JSON.stringify(qa6(payload.input)),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa7.test')){if(qa7Mode==='invalid')return new Response(JSON.stringify({verdict:'PASS'}),{status:200,headers:{'content-type':'application/json'}});return new Response(JSON.stringify({qaVersion:ORIGINALITY_DUPLICATE_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',relationships:payload.input.comparisons.map((item:any)=>({comparisonId:item.id,kind:item.kind,semanticRisk:item.kind==='SOURCE'?'HIGH':'NONE',relationship:item.kind==='SOURCE'?'SOURCE_COPY':'DISTINCT',evidence:item.kind==='SOURCE'?'The same source exercise operation and answer pattern are retained with only surface wording changes.':'The comparison is distinct.'}))}),{status:200,headers:{'content-type':'application/json'}})}
    throw new Error(`Unexpected endpoint ${url}`);
  }));
}

describe('QA7 Factory approval integration',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('blocks Question Bank approval when QA1-QA6 pass but QA7 confirms source copying',async()=>{const {repo,job,unitId,chunkId,questionId}=await fixture();stubProviders(unitId,chunkId,'copy');const before=await repo.listQuestions();const result=await approveFactoryCandidates(job.id,[job.candidates[0].id]);const candidate=result.job.candidates[0];expect(candidate.answerOracleQa?.verdict).toBe('PASS');expect(candidate.japaneseNaturalnessQa?.verdict).toBe('PASS');expect(candidate.curriculumGroundingQa?.verdict).toBe('PASS');expect(candidate.jftAlignmentQa?.verdict).toBe('PASS');expect(candidate.difficultyCalibrationQa?.verdict).toBe('PASS');expect(candidate.originalityDuplicateQa).toMatchObject({verdict:'FAIL',hardFail:true,provider:'http'});expect(result.approved).toBe(0);expect(await repo.listQuestions()).toHaveLength(before.length);expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(false)});

  it('requires Admin inspection before approving a newly produced technical QA7 REVIEW',async()=>{const {repo,job,unitId,chunkId,questionId}=await fixture();stubProviders(unitId,chunkId,'invalid');const first=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(first.approved).toBe(0);expect(first.job.candidates[0].originalityDuplicateQa).toMatchObject({verdict:'REVIEW',confidence:'LOW'});expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(false);const acknowledged=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(acknowledged.approved).toBe(1);expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(true)});
});

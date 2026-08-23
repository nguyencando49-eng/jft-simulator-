import {afterEach,describe,expect,it,vi} from 'vitest';
import type {FactoryJob} from '@/lib/server/factory-domain';
import {CURRICULUM_GROUNDING_PROMPT_VERSION} from '@/lib/server/curriculum-grounding';
import {JFT_ALIGNMENT_PROMPT_VERSION} from '@/lib/server/jft-alignment';
import {MockJftAlignmentProvider} from '@/lib/server/jft-alignment-provider';
import {buildDifficultyCalibrationInput,DIFFICULTY_CALIBRATION_PROMPT_VERSION,finalizeDifficultyCalibration,withDifficultyCalibrationAudit,type DifficultyCalibrationAnalysis} from '@/lib/server/difficulty-calibration';
import {approveFactoryCandidates,renderFactoryCandidateAudio} from '@/lib/server/factory-service';
import {getRepository} from '@/lib/server/repository';

const now='2026-08-23T00:00:00.000Z';
const baseProfile=(value:number)=>({linguisticComplexity:value,cognitiveComplexity:value,processingLoad:value,distractorCompetitiveness:value,informationDensity:value,modalityLoad:value});
function qa6Analysis(input:any,value=.88):DifficultyCalibrationAnalysis{return {qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:input.questionId,confidence:'HIGH',profile:baseProfile(value),reasoningDepth:value>.7?'MULTI_FACTOR_INFERENCE':'DIRECT_MATCH',distractorStrength:value>.7?'STRONG':'WEAK',acousticAssessment:'NOT_ASSESSED',evidence:{linguisticComplexity:'Synthetic linguistic evidence.',cognitiveComplexity:'Synthetic cognitive evidence.',processingLoad:'Synthetic processing evidence.',distractorCompetitiveness:'Synthetic distractor evidence.',informationDensity:'Synthetic information evidence.',modalityLoad:'Synthetic script-only modality evidence.',reasoningDepth:'Synthetic reasoning-depth evidence.'}}}

async function fixture(audioPending=false){
  const suffix=crypto.randomUUID(),sourceId=`SRC-QA6-${suffix}`,chunkId=`SC-QA6-${suffix}`,unitId=`KU-QA6-${suffix}`,jobId=`JOB-QA6-${suffix}`,candidateId=`C-QA6-${suffix}`,questionId=`Q-QA6-${suffix}`;const repo=getRepository();
  await repo.saveSourceDocument({id:sourceId,title:'Synthetic QA6 transport fixture',sourceType:'text',language:'ja',createdAt:now,updatedAt:now,createdBy:'admin',status:'ready',metadata:{notes:'Synthetic tests only.'},rawText:'交通案内の基本語彙を理解します。'});
  await repo.saveSourceChunks([{id:chunkId,sourceDocumentId:sourceId,sequence:0,rawText:'交通案内の基本語彙を理解します。',normalizedText:'交通案内の基本語彙を理解します。',createdAt:now}]);
  await repo.saveKnowledgeUnits([{id:unitId,sourceDocumentId:sourceId,sourceChunkIds:[chunkId],topic:'交通',situation:'駅',level:'A1',canDo:'Understand a simple spoken announcement or instruction.',grammar:['～ます'],vocabulary:['電車','時間','時','出ます'],kanji:['電車','時間','時'],expressions:[],keyKnowledge:['出発時間を理解する'],skills:['listening'],confidence:.98,status:'approved',createdAt:now,updatedAt:now,provider:'synthetic-test',promptVersion:'test-v1'}]);
  const question={id:questionId,section:'listening' as const,type:'audio_choice' as const,level:'A1' as const,instruction:'音声を聞いて答えてください。',prompt:'電車は何時に出ますか。',choices:['8時','9時','10時','11時'],answer:2,explanationVi:'Tàu khởi hành lúc 10 giờ.',audioSrc:audioPending?undefined:'data:audio/wav;base64,AAAA',tags:['transportation'],version:1,status:'review' as const,source:'ai' as const,createdAt:now,updatedAt:now};
  const audioScript='お知らせです。電車は10時に出ます。';const staleInput=buildDifficultyCalibrationInput(question,{audioScript,audioEvidence:{available:true,durationMs:2_000}});const staleAnalysis={...qa6Analysis(staleInput,.15),acousticAssessment:'ASSESSED' as const};
  const stale={...withDifficultyCalibrationAudit(finalizeDifficultyCalibration(staleAnalysis,'A1',staleInput,undefined,questionId),{provider:'stale-provider'}),checkedAt:'2020-01-01T00:00:00.000Z'};
  const job:FactoryJob={id:jobId,requestedBy:'admin',status:'review',provider:'synthetic-test',createdAt:now,updatedAt:now,request:{section:'listening',level:'A1',topic:'transportation',canDo:'Understand a simple spoken announcement or instruction.',category:'announcement_instruction',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:true},sourceContext:{sourceDocumentId:sourceId,sourceChunkIds:[chunkId],knowledgeUnitId:unitId,knowledgeUnitIds:[unitId],questionPlanId:`PLAN-${suffix}`,objective:'announcement_instruction',sourceTexts:['初級交通語彙'],originalityPromptVersion:'source-originality-v1'},candidates:[{id:candidateId,question,audioScript,audio:audioPending?{status:'pending'}:{status:'ready',provider:'synthetic',storage:'inline'},qa:{passed:!audioPending,score:100,issues:[]},difficultyCalibrationQa:stale,generation:{provider:'synthetic-test',promptVersion:'test-v1',createdAt:now}}]};
  await repo.saveFactoryJob(job);return {repo,job,unitId,chunkId,candidateId,questionId,stale};
}

function stubGates(unitId:string,chunkId:string,qa6Mode:'extreme'|'invalid'='extreme'){
  vi.stubEnv('CURRICULUM_GROUNDING_PROVIDER','http');vi.stubEnv('CURRICULUM_GROUNDING_ENDPOINT','https://qa4.test/evaluate');
  vi.stubEnv('JFT_ALIGNMENT_PROVIDER','http');vi.stubEnv('JFT_ALIGNMENT_ENDPOINT','https://qa5.test/classify');
  vi.stubEnv('DIFFICULTY_CALIBRATION_PROVIDER','http');vi.stubEnv('DIFFICULTY_CALIBRATION_ENDPOINT','https://qa6.test/estimate');
  vi.stubGlobal('fetch',vi.fn(async(url,init)=>{const payload=JSON.parse(String((init as RequestInit).body));
    if(String(url).includes('qa4.test'))return new Response(JSON.stringify({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',knowledgeAnalysis:[{type:'VOCABULARY',value:'電車',role:'REQUIRED',source:'AUDIO_SCRIPT',support:'SUPPORTED',knowledgeUnitIds:[unitId],sourceChunkIds:[chunkId],evidence:'The approved unit teaches 電車.',reason:'The learner must understand 電車.',contradictedByCurriculum:false}]}),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa5.test'))return new Response(JSON.stringify(await new MockJftAlignmentProvider().classify(payload.input)),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa6.test'))return new Response(JSON.stringify(qa6Mode==='invalid'?{qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:payload.input.questionId,verdict:'PASS'}:qa6Analysis(payload.input)),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected endpoint ${url}`);
  }));
}

describe('QA6 Factory checkpoint integration',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('blocks Question Bank approval when QA1-QA5 pass but QA6 finds an extreme level mismatch',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubGates(unitId,chunkId);const before=await repo.listQuestions();const result=await approveFactoryCandidates(job.id,[job.candidates[0].id]);const after=await repo.listQuestions();const candidate=result.job.candidates[0];
    expect(candidate.answerOracleQa?.verdict).toBe('PASS');expect(candidate.japaneseNaturalnessQa?.verdict).toBe('PASS');expect(candidate.curriculumGroundingQa?.verdict).toBe('PASS');expect(candidate.jftAlignmentQa?.verdict).toBe('PASS');
    expect(candidate.difficultyCalibrationQa).toMatchObject({verdict:'FAIL',hardFail:true,estimatedLevel:'A2.2',levelMatch:'TOO_HARD'});expect(result.approved).toBe(0);expect(after).toHaveLength(before.length);expect(after.some(item=>item.id===questionId)).toBe(false);
  });

  it('reruns QA6 after Listening TTS refresh instead of retaining stale PASS evidence',async()=>{
    const {job,unitId,chunkId,candidateId,stale}=await fixture(true);stubGates(unitId,chunkId);vi.stubEnv('TTS_PROVIDER','mock');const result=await renderFactoryCandidateAudio(job.id,candidateId);
    expect(result.candidate.audio?.status).toBe('ready');expect(result.candidate.difficultyCalibrationQa).toMatchObject({verdict:'FAIL',hardFail:true,provider:'http-difficulty-calibration'});expect(result.candidate.difficultyCalibrationQa?.checkedAt).not.toBe(stale.checkedAt);expect(result.candidate.qa.passed).toBe(false);
  });

  it('requires Admin inspection before approving a newly produced technical QA6 REVIEW',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubGates(unitId,chunkId,'invalid');const first=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(first.approved).toBe(0);expect(first.job.candidates[0].difficultyCalibrationQa).toMatchObject({verdict:'REVIEW',confidence:'LOW'});expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(false);
    const acknowledged=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(acknowledged.approved).toBe(1);expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(true);
  });

  it('invalidates reviewed QA6 evidence when learner-visible content changes',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubGates(unitId,chunkId,'invalid');const first=await approveFactoryCandidates(job.id,[job.candidates[0].id]);const firstBinding=first.job.candidates[0].difficultyCalibrationQa?.reviewBindingFingerprint;expect(first.approved).toBe(0);expect(firstBinding).toMatch(/^[a-f0-9]{64}$/);
    first.job.candidates[0].question.instruction='音声を一回聞いて答えてください。';first.job.candidates[0].question.updatedAt='2026-08-23T00:01:00.000Z';await repo.saveFactoryJob(first.job);
    const changed=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(changed.approved).toBe(0);expect(changed.job.candidates[0].difficultyCalibrationQa?.reviewBindingFingerprint).not.toBe(firstBinding);expect((await repo.listQuestions()).some(item=>item.id===questionId)).toBe(false);
    const acknowledged=await approveFactoryCandidates(job.id,[job.candidates[0].id]);expect(acknowledged.approved).toBe(1);
  });
});

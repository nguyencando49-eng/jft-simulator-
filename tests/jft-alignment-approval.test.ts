import {afterEach,describe,expect,it,vi} from 'vitest';
import type {FactoryJob} from '@/lib/server/factory-domain';
import {CURRICULUM_GROUNDING_PROMPT_VERSION} from '@/lib/server/curriculum-grounding';
import {JFT_ALIGNMENT_PROMPT_VERSION,type JftAlignmentGateResult} from '@/lib/server/jft-alignment';
import {MockJftAlignmentProvider} from '@/lib/server/jft-alignment-provider';
import {approveFactoryCandidates,renderFactoryCandidateAudio} from '@/lib/server/factory-service';
import {getRepository} from '@/lib/server/repository';

const now='2026-08-18T00:00:00.000Z';

async function fixture(audioPending=false){
  const suffix=crypto.randomUUID(),sourceId=`SRC-QA5-${suffix}`,chunkId=`SC-QA5-${suffix}`,unitId=`KU-QA5-${suffix}`,jobId=`JOB-QA5-${suffix}`,candidateId=`C-QA5-${suffix}`,questionId=`Q-QA5-${suffix}`;
  const repo=getRepository();
  await repo.saveSourceDocument({id:sourceId,title:'Synthetic QA5 transport fixture',sourceType:'text',language:'ja',createdAt:now,updatedAt:now,createdBy:'admin',status:'ready',metadata:{notes:'Synthetic test content only.'},rawText:'電車の出発時間を聞いて理解します。'});
  await repo.saveSourceChunks([{id:chunkId,sourceDocumentId:sourceId,sequence:0,rawText:'電車の出発時間を聞いて理解します。',normalizedText:'電車の出発時間を聞いて理解します。',createdAt:now}]);
  await repo.saveKnowledgeUnits([{id:unitId,sourceDocumentId:sourceId,sourceChunkIds:[chunkId],topic:'交通',situation:'駅',level:'A1',canDo:'簡単な交通案内を聞いて時間を理解できる',grammar:['～ます'],vocabulary:['電車','時間','時','出ます'],kanji:['電車','時間','時'],expressions:[],keyKnowledge:['出発時間を理解する'],skills:['listening'],confidence:.98,status:'approved',createdAt:now,updatedAt:now,provider:'synthetic-test',promptVersion:'test-v1'}]);
  const stale:JftAlignmentGateResult={qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId,verdict:'PASS',hardFail:false,confidence:'HIGH',declared:{section:'listening',category:'announcement_instruction',canDo:'Understand a simple spoken announcement or instruction.',taskType:'announcement_instruction'},independentAssessment:{actualSection:'listening',actualCategory:'announcement_instruction',actualCanDo:'Understand a simple spoken announcement or instruction.',actualAssessmentTarget:'Process an announcement.',actualTaskType:'announcement_instruction',requiredModality:'AUDIO',communicativePurpose:'announcement comprehension'},alignment:{section:'STRONG_MATCH',category:'STRONG_MATCH',canDo:'STRONG_MATCH',taskType:'STRONG_MATCH',modalityDependency:'STRONG'},taskValidity:{realWorldValidity:'AUTHENTIC',constructUnderrepresented:false,constructIrrelevantClues:[]},scores:{sectionAlignment:20,categoryAlignment:20,canDoAlignment:20,taskValidity:15,modalityDependency:10,communicativeAuthenticity:10,metadataConsistency:5,total:100},issues:[],release:{eligibleToProceed:true,requiresHumanReview:false,blockReason:[]},provider:'stale-provider',promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:'JFT_OFFICIAL_SPEC_2026_08_17',taxonomyVersion:'JFT_SIMULATOR_TAXONOMY_V1',checkedAt:'2020-01-01T00:00:00.000Z'};
  const job:FactoryJob={id:jobId,requestedBy:'admin',status:'review',provider:'synthetic-test',createdAt:now,updatedAt:now,request:{section:'listening',level:'A1',topic:'transportation',canDo:'Understand a simple spoken announcement or instruction.',category:'announcement_instruction',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:true},sourceContext:{sourceDocumentId:sourceId,sourceChunkIds:[chunkId],knowledgeUnitId:unitId,knowledgeUnitIds:[unitId],questionPlanId:`PLAN-${suffix}`,objective:'announcement_instruction',sourceTexts:['初級の交通と時間の語彙'],originalityPromptVersion:'source-originality-v1'},candidates:[{id:candidateId,question:{id:questionId,section:'listening',type:'audio_choice',level:'A1',instruction:'音声を聞いて答えてください。',prompt:'電車は10時に出ます。何時に出ますか。',choices:['8時','9時','10時','11時'],answer:2,explanationVi:'Tàu khởi hành lúc 10 giờ.',audioSrc:audioPending?undefined:'data:audio/wav;base64,AAAA',tags:['transportation'],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now},audioScript:'お知らせです。電車は10時に出ます。',audio:audioPending?{status:'pending'}:{status:'ready',provider:'synthetic',storage:'inline'},qa:{passed:!audioPending,score:100,issues:[]},jftAlignmentQa:stale,generation:{provider:'synthetic-test',promptVersion:'test-v1',createdAt:now}}]};
  await repo.saveFactoryJob(job);return {repo,job,sourceId,chunkId,unitId,candidateId,questionId,stale};
}

function stubQa4AndQa5(unitId:string,chunkId:string,qa5Mode:'classify'|'invalid'='classify'){
  vi.stubEnv('CURRICULUM_GROUNDING_PROVIDER','http');vi.stubEnv('CURRICULUM_GROUNDING_ENDPOINT','https://qa4.test/evaluate');
  vi.stubEnv('JFT_ALIGNMENT_PROVIDER','http');vi.stubEnv('JFT_ALIGNMENT_ENDPOINT','https://qa5.test/classify');
  vi.stubGlobal('fetch',vi.fn(async(url,init)=>{
    const payload=JSON.parse(String((init as RequestInit).body));
    if(String(url).includes('qa4.test'))return new Response(JSON.stringify({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',knowledgeAnalysis:[{type:'VOCABULARY',value:'電車',role:'REQUIRED',source:'AUDIO_SCRIPT',support:'SUPPORTED',knowledgeUnitIds:[unitId],sourceChunkIds:[chunkId],evidence:'The approved unit teaches 電車.',reason:'The learner must understand 電車 to identify the departure information.',contradictedByCurriculum:false}]}),{status:200,headers:{'content-type':'application/json'}});
    if(String(url).includes('qa5.test'))return new Response(JSON.stringify(qa5Mode==='invalid'?{qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId:payload.input.questionId,verdict:'PASS'}:await new MockJftAlignmentProvider().classify(payload.input)),{status:200,headers:{'content-type':'application/json'}});
    throw new Error(`Unexpected endpoint ${url}`);
  }));
}

describe('QA5 Factory checkpoint integration',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('blocks Question Bank approval when QA1-QA4 are non-failing but visible text makes Listening unnecessary',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubQa4AndQa5(unitId,chunkId);
    const before=await repo.listQuestions();const result=await approveFactoryCandidates(job.id,[job.candidates[0].id]);const after=await repo.listQuestions();
    const candidate=result.job.candidates[0];
    expect(result.approved).toBe(0);
    expect(candidate.contentQa?.hardFail).toBe(false);
    expect(candidate.answerOracleQa?.verdict).toBe('PASS');
    expect(candidate.japaneseNaturalnessQa?.verdict).toBe('PASS');
    expect(candidate.curriculumGroundingQa?.verdict).toBe('PASS');
    expect(candidate.jftAlignmentQa).toMatchObject({verdict:'FAIL',hardFail:true,provider:'http-jft-alignment'});
    expect(candidate.jftAlignmentQa?.issues.map(issue=>issue.code)).toContain('LISTENING_NOT_REQUIRED');
    expect(after).toHaveLength(before.length);expect(after.some(question=>question.id===questionId)).toBe(false);
  });

  it('reruns QA5 after Listening TTS refresh instead of retaining stale PASS evidence',async()=>{
    const {job,unitId,chunkId,candidateId,stale}=await fixture(true);stubQa4AndQa5(unitId,chunkId);vi.stubEnv('TTS_PROVIDER','mock');
    const result=await renderFactoryCandidateAudio(job.id,candidateId);
    expect(result.candidate.audio?.status).toBe('ready');expect(result.candidate.question.audioSrc).toMatch(/^data:audio\/wav;base64,/);
    expect(result.candidate.jftAlignmentQa).toMatchObject({verdict:'FAIL',hardFail:true,provider:'http-jft-alignment'});
    expect(result.candidate.jftAlignmentQa?.checkedAt).not.toBe(stale.checkedAt);expect(result.candidate.qa.passed).toBe(false);
  });

  it('does not approve a newly produced technical REVIEW that the Admin has not inspected',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubQa4AndQa5(unitId,chunkId,'invalid');
    const before=await repo.listQuestions();const result=await approveFactoryCandidates(job.id,[job.candidates[0].id]);const after=await repo.listQuestions();
    expect(result.approved).toBe(0);expect(result.job.candidates[0].jftAlignmentQa).toMatchObject({verdict:'REVIEW',confidence:'LOW'});expect(result.job.candidates[0].jftAlignmentQa?.issues.map(issue=>issue.code)).toContain('JFT_ALIGNMENT_INVALID_OUTPUT');
    expect(after).toHaveLength(before.length);expect(after.some(question=>question.id===questionId)).toBe(false);
  });

  it('requires fresh Admin inspection when learner-visible content changes but QA5 returns the same REVIEW payload',async()=>{
    const {repo,job,unitId,chunkId,questionId}=await fixture();stubQa4AndQa5(unitId,chunkId,'invalid');
    const first=await approveFactoryCandidates(job.id,[job.candidates[0].id]);
    const firstBinding=(first.job.candidates[0].jftAlignmentQa as JftAlignmentGateResult&{reviewBindingFingerprint?:string}).reviewBindingFingerprint;
    expect(first.approved).toBe(0);expect(firstBinding).toMatch(/^[a-f0-9]{64}$/);

    first.job.candidates[0].question.instruction='音声を一回聞いて、答えてください。';
    first.job.candidates[0].question.updatedAt='2026-08-18T00:01:00.000Z';
    await repo.saveFactoryJob(first.job);
    const changed=await approveFactoryCandidates(job.id,[job.candidates[0].id]);
    const changedBinding=(changed.job.candidates[0].jftAlignmentQa as JftAlignmentGateResult&{reviewBindingFingerprint?:string}).reviewBindingFingerprint;
    expect(changed.approved).toBe(0);expect(changedBinding).toMatch(/^[a-f0-9]{64}$/);expect(changedBinding).not.toBe(firstBinding);
    expect((await repo.listQuestions()).some(question=>question.id===questionId)).toBe(false);

    const alignmentAcknowledged=await approveFactoryCandidates(job.id,[job.candidates[0].id]);
    expect(alignmentAcknowledged.approved).toBe(0);expect(alignmentAcknowledged.job.candidates[0].difficultyCalibrationQa?.verdict).toBe('REVIEW');
    const difficultyAcknowledged=await approveFactoryCandidates(job.id,[job.candidates[0].id]);
    expect(difficultyAcknowledged.approved).toBe(1);expect((await repo.listQuestions()).some(question=>question.id===questionId)).toBe(true);
  });
});

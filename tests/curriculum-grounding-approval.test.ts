import {afterEach,describe,expect,it,vi} from 'vitest';
import type {FactoryJob} from '@/lib/server/factory-domain';
import {CURRICULUM_GROUNDING_PROMPT_VERSION,type CurriculumGroundingGateResult} from '@/lib/server/curriculum-grounding';
import {approveFactoryCandidates,renderFactoryCandidateAudio} from '@/lib/server/factory-service';
import {getRepository} from '@/lib/server/repository';

const now='2026-08-18T00:00:00.000Z';

describe('QA4 approval integration',()=>{
  afterEach(()=>{
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('keeps a QA1/QA2/QA3-valid candidate out of the Question Bank when QA4 fails',async()=>{
    const suffix=crypto.randomUUID(),sourceId=`SRC-QA4-${suffix}`,chunkId=`SC-QA4-${suffix}`,unitId=`KU-QA4-${suffix}`,jobId=`JOB-QA4-${suffix}`,questionId=`Q-QA4-${suffix}`;
    const repo=getRepository();
    await repo.saveSourceDocument({id:sourceId,title:'Synthetic QA4 approval fixture',sourceType:'text',language:'ja',createdAt:now,updatedAt:now,createdBy:'admin',status:'ready',metadata:{notes:'Synthetic test content only.'},rawText:'店の時間を読みます。'});
    await repo.saveSourceChunks([{id:chunkId,sourceDocumentId:sourceId,sequence:0,rawText:'店の時間を読みます。',normalizedText:'店の時間を読みます。',createdAt:now}]);
    await repo.saveKnowledgeUnits([{id:unitId,sourceDocumentId:sourceId,sourceChunkIds:[chunkId],topic:'店',situation:'営業時間',level:'A1',canDo:'店の時間を理解できる',grammar:['～ます'],vocabulary:['店','時間','時'],kanji:['店','時間','時'],expressions:[],keyKnowledge:['店の時間を理解する'],skills:['reading'],confidence:.98,status:'approved',createdAt:now,updatedAt:now,provider:'synthetic-test',promptVersion:'test-v1'}]);
    const job:FactoryJob={id:jobId,requestedBy:'admin',status:'review',provider:'synthetic-test',createdAt:now,updatedAt:now,request:{section:'reading',level:'A1',topic:'店',canDo:'店の時間を理解できる',category:'information_search',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:false},sourceContext:{sourceDocumentId:sourceId,sourceChunkIds:[chunkId],knowledgeUnitId:unitId,knowledgeUnitIds:[unitId],questionPlanId:`PLAN-${suffix}`,objective:'店の営業時間を探す',sourceTexts:['初級の店と時間の語彙'],originalityPromptVersion:'source-originality-v1'},candidates:[{id:`C-${suffix}`,question:{id:questionId,section:'reading',type:'choice',level:'A1',instruction:'文を読んで答えてください。',prompt:'店は6時に閉まります。閉まる時間は何時ですか。',choices:['5時','6時','7時','8時'],answer:1,explanationVi:'Cửa hàng đóng cửa lúc 6 giờ.',tags:['店','店の時間を理解できる'],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now},qa:{passed:true,score:100,issues:[]},semanticQa:{score:96,passed:true,summary:'Synthetic pass evidence.',issues:[],provider:'synthetic-test'},generation:{provider:'synthetic-test',promptVersion:'test-v1',createdAt:now}}]};
    await repo.saveFactoryJob(job);

    vi.stubEnv('CURRICULUM_GROUNDING_PROVIDER','http');
    vi.stubEnv('CURRICULUM_GROUNDING_ENDPOINT','https://qa4.test/evaluate');
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
      const payload=JSON.parse(String((init as RequestInit).body));
      return new Response(JSON.stringify({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',knowledgeAnalysis:[{type:'VOCABULARY',value:'閉まる',role:'REQUIRED',source:'PASSAGE',support:'UNSUPPORTED',knowledgeUnitIds:[],sourceChunkIds:[],evidence:'The approved unit does not teach 閉まる.',reason:'Understanding 閉まる is necessary to identify the closing time.',contradictedByCurriculum:false}]}),{status:200,headers:{'content-type':'application/json'}});
    }));

    const before=await repo.listQuestions();
    const result=await approveFactoryCandidates(jobId,[job.candidates[0].id]);
    const after=await repo.listQuestions();
    expect(result.approved).toBe(0);
    expect(result.job.candidates[0].contentQa?.hardFail).toBe(false);
    expect(result.job.candidates[0].answerOracleQa?.verdict).toBe('PASS');
    expect(result.job.candidates[0].japaneseNaturalnessQa?.verdict).toBe('PASS');
    expect(result.job.candidates[0].curriculumGroundingQa).toMatchObject({verdict:'FAIL',hardFail:true});
    expect(result.job.candidates[0].curriculumGroundingQa?.issues.map(issue=>issue.code)).toContain('REQUIRED_VOCABULARY_UNSUPPORTED');
    expect(after).toHaveLength(before.length);
    expect(after.some(question=>question.id===questionId)).toBe(false);
  });

  it('reruns QA4 after Listening TTS refresh instead of retaining stale evidence',async()=>{
    const suffix=crypto.randomUUID(),sourceId=`SRC-QA4-AUDIO-${suffix}`,chunkId=`SC-QA4-AUDIO-${suffix}`,unitId=`KU-QA4-AUDIO-${suffix}`,jobId=`JOB-QA4-AUDIO-${suffix}`,candidateId=`C-QA4-AUDIO-${suffix}`;
    const repo=getRepository();
    await repo.saveSourceDocument({id:sourceId,title:'Synthetic QA4 audio fixture',sourceType:'text',language:'ja',createdAt:now,updatedAt:now,createdBy:'admin',status:'ready',metadata:{notes:'Synthetic test content only.'},rawText:'会議の時間を聞きます。'});
    await repo.saveSourceChunks([{id:chunkId,sourceDocumentId:sourceId,sequence:0,rawText:'会議の時間を聞きます。',normalizedText:'会議の時間を聞きます。',createdAt:now}]);
    await repo.saveKnowledgeUnits([{id:unitId,sourceDocumentId:sourceId,sourceChunkIds:[chunkId],topic:'会議',situation:'職場',level:'A1',canDo:'会議の時間を聞いて理解できる',grammar:['～ます'],vocabulary:['会議','時間','時'],kanji:['会議','時間','時'],expressions:[],keyKnowledge:['会議の時間を理解する'],skills:['listening'],confidence:.98,status:'approved',createdAt:now,updatedAt:now,provider:'synthetic-test',promptVersion:'test-v1'}]);
    const staleQa:CurriculumGroundingGateResult={qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:`Q-${suffix}`,verdict:'PASS',hardFail:false,confidence:'HIGH',knowledgeAnalysis:[],coverage:{requiredCount:1,supportedCount:1,partialCount:0,unsupportedCount:0,coverageRatio:1},outsideKnowledge:[],provenance:{complete:true,missingEvidence:[]},issues:[],release:{eligibleToProceed:true,requiresHumanReview:false,blockReason:[]},retrieval:{complete:true,strategy:'FULL_APPROVED_CATALOG',totalApprovedUnits:1,returnedUnitCount:1,searchedSourceDocumentIds:[sourceId],intendedKnowledgeUnitIds:[unitId],missingIntendedKnowledgeUnitIds:[]},evaluatedKnowledgeUnitIds:[unitId],provider:'stale-provider',promptVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,checkedAt:'2020-01-01T00:00:00.000Z'};
    const job:FactoryJob={id:jobId,requestedBy:'admin',status:'review',provider:'synthetic-test',createdAt:now,updatedAt:now,request:{section:'listening',level:'A1',topic:'会議',canDo:'会議の時間を聞いて理解できる',category:'conversation',count:1,difficulty:'balanced',includeExplanation:true,generateAudioScript:true},sourceContext:{sourceDocumentId:sourceId,sourceChunkIds:[chunkId],knowledgeUnitId:unitId,knowledgeUnitIds:[unitId],questionPlanId:`PLAN-${suffix}`,objective:'会議の開始時間を聞く',sourceTexts:['初級の会議と時間の語彙'],originalityPromptVersion:'source-originality-v1'},candidates:[{id:candidateId,question:{id:`Q-${suffix}`,section:'listening',type:'audio_choice',level:'A1',instruction:'音声を聞いて答えてください。',prompt:'会議は何時からですか。',choices:['2時','3時','4時','5時'],answer:1,explanationVi:'Cuộc họp bắt đầu lúc 3 giờ.',tags:['会議','会議の時間を聞いて理解できる'],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now},audioScript:'会議は3時からです。',audio:{status:'pending'},qa:{passed:false,score:65,issues:[]},curriculumGroundingQa:staleQa,generation:{provider:'synthetic-test',promptVersion:'test-v1',createdAt:now}}]};
    await repo.saveFactoryJob(job);

    vi.stubEnv('AUTH_DISABLED','true');
    vi.stubEnv('TTS_PROVIDER','mock');
    vi.stubEnv('CURRICULUM_GROUNDING_PROVIDER','http');
    vi.stubEnv('CURRICULUM_GROUNDING_ENDPOINT','https://qa4.test/evaluate');
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{
      const payload=JSON.parse(String((init as RequestInit).body));
      return new Response(JSON.stringify({qaVersion:CURRICULUM_GROUNDING_PROMPT_VERSION,questionId:payload.input.questionId,confidence:'HIGH',knowledgeAnalysis:[{type:'GRAMMAR',value:'～から',role:'REQUIRED',source:'AUDIO_SCRIPT',support:'UNSUPPORTED',knowledgeUnitIds:[],sourceChunkIds:[],evidence:'The approved unit does not teach ～から.',reason:'The learner needs ～から to understand the meeting start time.',contradictedByCurriculum:false}]}),{status:200,headers:{'content-type':'application/json'}});
    }));

    const result=await renderFactoryCandidateAudio(jobId,candidateId);
    expect(result.candidate.audio?.status).toBe('ready');
    expect(result.candidate.question.audioSrc).toMatch(/^data:audio\/wav;base64,/);
    expect(result.candidate.curriculumGroundingQa).toMatchObject({verdict:'FAIL',hardFail:true,provider:'http-curriculum-grounding'});
    expect(result.candidate.curriculumGroundingQa?.checkedAt).not.toBe(staleQa.checkedAt);
    expect(result.candidate.qa.passed).toBe(false);
  });
});

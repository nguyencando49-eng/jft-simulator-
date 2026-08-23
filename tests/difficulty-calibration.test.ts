import {describe,expect,it,vi} from 'vitest';
import type {QuestionRecord} from '@/lib/admin-types';
import {aggregateQuestionPerformance,loadQuestionPerformanceCatalog} from '@/lib/server/question-performance';
import type {Repository} from '@/lib/server/domain';
import {buildDifficultyCalibrationInput,calculateDifficultyScore,compareDifficultyLevel,DIFFICULTY_CALIBRATION_POLICY_V1,DIFFICULTY_CALIBRATION_PROMPT_VERSION,estimatedLevelForDifficulty,finalizeDifficultyCalibration,summarizeDifficultyCalibrationMetrics,technicalDifficultyCalibrationResult,validateDifficultyCalibrationAnalysis,withDifficultyCalibrationAudit,type DifficultyCalibrationAnalysis,type DifficultyCalibrationGateResult,type DifficultyProfile} from '@/lib/server/difficulty-calibration';
import {HttpDifficultyCalibrationProvider,MockDifficultyCalibrationProvider,type DifficultyCalibrationProvider} from '@/lib/server/difficulty-calibration-provider';
import {runDifficultyCalibrationGate} from '@/lib/server/factory-service';
import type {FactoryCandidate} from '@/lib/server/factory-domain';

const now='2026-08-23T00:00:00.000Z';
const question=(overrides:Partial<QuestionRecord>={}):QuestionRecord=>({id:'AI-A2.2-READING-SECRET',section:'script_vocabulary',type:'choice',level:'A1',instruction:'意味を選んでください。',prompt:'「休み」はどういう意味ですか。',choices:['働かない日','会社','電車','病院'],answer:0,explanationVi:'Ngày nghỉ.',tags:[],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now,...overrides});
const profile=(value:number,overrides:Partial<DifficultyProfile>={}):DifficultyProfile=>({linguisticComplexity:value,cognitiveComplexity:value,processingLoad:value,distractorCompetitiveness:value,informationDensity:value,modalityLoad:value,...overrides});
const analysis=(input:ReturnType<typeof buildDifficultyCalibrationInput>,value=.2,overrides:Partial<DifficultyCalibrationAnalysis>={}):DifficultyCalibrationAnalysis=>({qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:input.questionId,confidence:'HIGH',profile:profile(value),reasoningDepth:'DIRECT_MATCH',distractorStrength:'MODERATE',acousticAssessment:input.section==='listening'?'NOT_ASSESSED':'NOT_APPLICABLE',evidence:{linguisticComplexity:'Basic language evidence.',cognitiveComplexity:'Direct task evidence.',processingLoad:'Short processing evidence.',distractorCompetitiveness:'Comparable option evidence.',informationDensity:'One relevant fact.',modalityLoad:'Text or script load evidence.',reasoningDepth:'One direct matching step.'},...overrides});

describe('QA6 multidimensional content estimate',()=>{
  it('Fixture A estimates a direct A1 vocabulary item as A1',async()=>{
    const q=question(),input=buildDifficultyCalibrationInput(q),raw=await new MockDifficultyCalibrationProvider().estimate(input),validated=validateDifficultyCalibrationAnalysis(raw,input),result=finalizeDifficultyCalibration(validated,q.level,input);
    expect(result).toMatchObject({estimatedLevel:'A1',levelMatch:'MATCH',verdict:'PASS',hardFail:false,calibrationSource:'CONTENT_ESTIMATE'});
    expect(result.difficultyScore).toBeLessThanOrEqual(DIFFICULTY_CALIBRATION_POLICY_V1.levelBoundaries.a1Maximum);
  });

  it('Fixtures B and C increase difficulty for multi-step and conditional matching despite simple vocabulary',async()=>{
    const provider=new MockDifficultyCalibrationProvider();
    const direct=question(),multi=question({section:'reading',instruction:'お知らせを読んで答えてください。',prompt:'【店のお知らせ】月曜日は9時に開きます。雨の場合は10時に開きます。ただし、祝日は休みです。雨の月曜日で、祝日ではありません。店は何時に開きますか。',choices:['9時','10時','11時','休み']});
    const directInput=buildDifficultyCalibrationInput(direct),multiInput=buildDifficultyCalibrationInput(multi);
    const directResult=finalizeDifficultyCalibration(validateDifficultyCalibrationAnalysis(await provider.estimate(directInput),directInput),direct.level,directInput);
    const multiResult=finalizeDifficultyCalibration(validateDifficultyCalibrationAnalysis(await provider.estimate(multiInput),multiInput),multi.level,multiInput);
    expect(multiResult.difficultyScore).toBeGreaterThan(directResult.difficultyScore);expect(['A2.1','A2.2']).toContain(multiResult.estimatedLevel);expect(multiResult.reasoningDepth).toMatch(/MULTI/);
  });

  it('Fixture D does not classify a long text with a direct answer as automatically A2.2',async()=>{
    const q=question({section:'reading',instruction:'長いメッセージを読んで答えてください。',prompt:`${'今日は会社で仕事をしました。'.repeat(12)}会議は3時です。会議は何時ですか。`,choices:['1時','2時','3時','4時']});
    const input=buildDifficultyCalibrationInput(q),result=finalizeDifficultyCalibration(validateDifficultyCalibrationAnalysis(await new MockDifficultyCalibrationProvider().estimate(input),input),q.level,input);
    expect(result.estimatedLevel).not.toBe('A2.2');expect(result.profile.processingLoad).toBeGreaterThan(result.profile.cognitiveComplexity);
  });

  it('Fixture E gives a many-turn Listening item higher processing and modality load without claiming acoustic QA',async()=>{
    const q=question({section:'listening',type:'audio_choice',level:'A2.1',instruction:'音声を聞いて答えてください。',prompt:'女の人は最後に何をしますか。',choices:['電話します','駅へ行きます','会議室へ行きます','昼ご飯を食べます']});
    const audio='A：会議は3時です。\nB：はい。\nA：その前に2時に田中さんへ電話してください。\nB：分かりました。\nA：電話のあと、駅で資料を受け取って、最後に会議室へ来てください。\nB：はい。';
    const input=buildDifficultyCalibrationInput(q,{audioScript:audio}),result=finalizeDifficultyCalibration(validateDifficultyCalibrationAnalysis(await new MockDifficultyCalibrationProvider().estimate(input),input),q.level,input);
    expect(result.profile.processingLoad).toBeGreaterThan(.4);expect(result.profile.modalityLoad).toBeGreaterThan(.4);expect(result.issues.map(item=>item.code)).toContain('ACOUSTIC_DIFFICULTY_NOT_ASSESSED');expect(result.verdict).toBe('REVIEW');
  });

  it('Fixture F hard-fails an extreme A1 versus A2.2 mismatch',()=>{
    const q=question({level:'A1'}),input=buildDifficultyCalibrationInput(q),result=finalizeDifficultyCalibration(analysis(input,.88,{reasoningDepth:'MULTI_FACTOR_INFERENCE'}),q.level,input);
    expect(result).toMatchObject({estimatedLevel:'A2.2',levelMatch:'TOO_HARD',verdict:'FAIL',hardFail:true});expect(result.issues.map(item=>item.code)).toContain('EXTREME_LEVEL_MISMATCH');
  });

  it('Fixture G reviews an A2.1 declaration estimated as A1 without hard failing',()=>{
    const q=question({level:'A2.1'}),input=buildDifficultyCalibrationInput(q),result=finalizeDifficultyCalibration(analysis(input,.15),q.level,input);
    expect(result).toMatchObject({estimatedLevel:'A1',levelMatch:'SLIGHTLY_EASIER',verdict:'REVIEW',hardFail:false});
  });

  it('centralizes score boundaries and does not use vocabulary alone',()=>{
    expect(estimatedLevelForDifficulty(.34)).toBe('A1');expect(estimatedLevelForDifficulty(.35)).toBe('A2.1');expect(estimatedLevelForDifficulty(.67)).toBe('A2.2');expect(compareDifficultyLevel('A1','A2.2')).toBe('TOO_HARD');
    expect(calculateDifficultyScore(profile(.4,{distractorCompetitiveness:.9}),'SIMPLE_INFERENCE')).toBeGreaterThan(calculateDifficultyScore(profile(.4,{distractorCompetitiveness:.1}),'DIRECT_MATCH'));
  });

  it('raises distractor competitiveness when options occupy the same decision space',async()=>{
    const provider=new MockDifficultyCalibrationProvider();
    const strongInput=buildDifficultyCalibrationInput(question({choices:['会社へ行きます','病院へ行きます','銀行へ行きます','学校へ行きます']}));
    const weakInput=buildDifficultyCalibrationInput(question({choices:['会社へ行きます','いいえ','123456789円の長い説明です','火曜日']}));
    const strong=validateDifficultyCalibrationAnalysis(await provider.estimate(strongInput),strongInput),weak=validateDifficultyCalibrationAnalysis(await provider.estimate(weakInput),weakInput);
    expect(strong.profile.distractorCompetitiveness).toBeGreaterThan(weak.profile.distractorCompetitiveness);
  });
});

describe('QA6 strict provider boundary and deterministic policy',()=>{
  it('blinds declared level and a level-bearing real id from the HTTP provider request',async()=>{
    const q=question({id:'AI-A2.2-LEVEL-LEAK',level:'A2.2'}),input=buildDifficultyCalibrationInput(q);let body:any;
    vi.stubEnv('DIFFICULTY_CALIBRATION_ENDPOINT','https://qa6.test/estimate');
    vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{body=JSON.parse(String((init as RequestInit).body));return new Response(JSON.stringify(analysis(input)),{status:200,headers:{'content-type':'application/json'}})}));
    await new HttpDifficultyCalibrationProvider().estimate(input);vi.unstubAllGlobals();vi.unstubAllEnvs();
    expect(input.questionId).toMatch(/^QA6-[a-f0-9]{16}$/);expect(JSON.stringify(body.input)).not.toContain('AI-A2.2-LEVEL-LEAK');expect(body.input).not.toHaveProperty('declaredLevel');expect(body.input).not.toHaveProperty('level');
  });

  it('rejects invalid ranges, extra policy fields, and unsupported acoustic claims',()=>{
    const input=buildDifficultyCalibrationInput(question());
    expect(()=>validateDifficultyCalibrationAnalysis({...analysis(input),profile:{...analysis(input).profile,cognitiveComplexity:1.1}},input)).toThrow(/0 to 1/);
    expect(()=>validateDifficultyCalibrationAnalysis({...analysis(input),verdict:'PASS'},input)).toThrow(/analysis-only/);
    const listeningInput=buildDifficultyCalibrationInput(question({section:'listening',type:'audio_choice'}),{audioScript:'会議は3時です。'});
    expect(()=>validateDifficultyCalibrationAnalysis({...analysis(listeningInput),acousticAssessment:'ASSESSED'},listeningInput)).toThrow(/acoustic metadata/);
  });

  it('turns invalid output, provider failure, and low confidence into REVIEW rather than PASS',async()=>{
    const q=question(),candidate:FactoryCandidate={id:'c',question:q,qa:{passed:true,score:100,issues:[]},generation:{provider:'test',promptVersion:'test',createdAt:now}};
    const invalid:DifficultyCalibrationProvider={name:'invalid',async estimate(){return {verdict:'PASS'}}};await runDifficultyCalibrationGate(candidate,{},invalid);expect(candidate.difficultyCalibrationQa).toMatchObject({verdict:'REVIEW',confidence:'LOW'});
    const failing:DifficultyCalibrationProvider={name:'failing',async estimate(){throw new Error('offline')}};await runDifficultyCalibrationGate(candidate,{},failing);expect(candidate.difficultyCalibrationQa?.issues.map(item=>item.code)).toContain('DIFFICULTY_CALIBRATION_PROVIDER_FAILURE');
    const input=buildDifficultyCalibrationInput(q),low=finalizeDifficultyCalibration(analysis(input,.15,{confidence:'LOW'}),q.level,input);expect(low.verdict).toBe('REVIEW');
  });

  it('preserves QA1-QA5 evidence and adds a separately persisted QA6 result',async()=>{
    const q=question({level:'A2.1'}),sentinels={contentQa:{verdict:'PASS'},answerOracleQa:{verdict:'PASS'},japaneseNaturalnessQa:{verdict:'PASS'},curriculumGroundingQa:{verdict:'PASS'},jftAlignmentQa:{verdict:'PASS'}};
    const candidate={id:'c-preserve',question:q,qa:{passed:true,score:100,issues:[]},generation:{provider:'test',promptVersion:'test',createdAt:now},...sentinels} as unknown as FactoryCandidate;
    await runDifficultyCalibrationGate(candidate,{},new MockDifficultyCalibrationProvider());
    for(const [key,value] of Object.entries(sentinels))expect((candidate as any)[key]).toBe(value);expect(candidate.difficultyCalibrationQa?.qaVersion).toBe(DIFFICULTY_CALIBRATION_PROMPT_VERSION);
  });

  it('never rescues an earlier failed QA gate even when difficulty matches',async()=>{
    const q=question(),candidate={id:'c-failed',question:q,qa:{passed:false,score:40,issues:[{code:'jft_alignment_fail',severity:'error',category:'jft_style',message:'Earlier QA5 failure.'}]},generation:{provider:'test',promptVersion:'test',createdAt:now}} as FactoryCandidate;
    await runDifficultyCalibrationGate(candidate,{},new MockDifficultyCalibrationProvider());expect(candidate.difficultyCalibrationQa?.verdict).toBe('PASS');expect(candidate.qa.passed).toBe(false);expect(candidate.qa.issues.some(item=>item.code==='jft_alignment_fail')).toBe(true);
  });
});

describe('QA6 empirical aggregation and human calibration loop',()=>{
  it('keeps 10 attempts insufficient and activates empirical signal at 50 attempts',()=>{
    const ten=aggregateQuestionPerformance('q',Array.from({length:10},(_,index)=>({questionId:'q',submitted:true,correct:index<7,responseTimeMs:2_000+index*100})));
    const fifty=aggregateQuestionPerformance('q',Array.from({length:50},(_,index)=>({questionId:'q',submitted:true,correct:index<25,responseTimeMs:2_000+index*100})));
    expect(ten).toMatchObject({attemptCount:10,sufficientSample:false,correctRate:.7});expect(fifty).toMatchObject({attemptCount:50,sufficientSample:true,correctRate:.5});
  });

  it('excludes abandoned/expired attempts and extreme response-time outliers',()=>{
    const result=aggregateQuestionPerformance('q',[{questionId:'q',submitted:true,correct:true,responseTimeMs:3_000},{questionId:'q',submitted:true,correct:false,responseTimeMs:5_000},{questionId:'q',submitted:true,correct:false,responseTimeMs:7_200_000},{questionId:'q',submitted:true,correct:false,responseTimeMs:4_000,abandoned:true},{questionId:'q',submitted:true,correct:false,responseTimeMs:4_000,expired:true}]);
    expect(result).toMatchObject({attemptCount:3,correctCount:1,incorrectCount:2,medianResponseTimeMs:4_000,averageResponseTimeMs:4_000,responseTimeSampleCount:2,excludedResponseTimeCount:1});
  });

  it('flags sufficient low performance for human review without changing the estimated level',()=>{
    const q=question(),input=buildDifficultyCalibrationInput(q),performance=aggregateQuestionPerformance(q.id,Array.from({length:50},(_,index)=>({questionId:q.id,submitted:true,correct:index<5})));
    const result=finalizeDifficultyCalibration(analysis(input,.15),q.level,input,performance,q.id);
    expect(result.estimatedLevel).toBe('A1');expect(result.calibrationSource).toBe('HYBRID');expect(result.verdict).toBe('REVIEW');expect(result.issues.map(item=>item.code)).toContain('DIFFICULTY_REVIEW_REQUIRED');
  });

  it('treats a sufficient unexpectedly high correct rate as review evidence, not an automatic relabel',()=>{
    const q=question({level:'A2.2'}),input=buildDifficultyCalibrationInput(q),performance=aggregateQuestionPerformance(q.id,Array.from({length:50},(_,index)=>({questionId:q.id,submitted:true,correct:index<48})));
    const result=finalizeDifficultyCalibration(analysis(input,.82,{reasoningDepth:'MULTI_FACTOR_INFERENCE'}),q.level,input,performance,q.id);
    expect(result.estimatedLevel).toBe('A2.2');expect(result.verdict).toBe('REVIEW');expect(result.issues.map(item=>item.code)).toContain('DIFFICULTY_REVIEW_REQUIRED');
  });

  it('builds privacy-safe correctness aggregates from submitted frozen sessions without inventing item response time',async()=>{
    const q=question({id:'q-frozen'}),version={id:'v1',examId:'e1',version:1,title:'Synthetic',durationMinutes:60,rules:[],createdAt:now,publishedAt:now,questions:[{questionId:q.id,questionVersion:1,snapshot:q}]};
    const sessions=[{id:'s1',examVersionId:'v1',status:'submitted' as const,startedAt:now,expiresAt:now,submittedAt:now,currentIndex:0,answers:{[q.id]:q.answer}},{id:'s2',examVersionId:'v1',status:'submitted' as const,startedAt:now,expiresAt:now,submittedAt:now,currentIndex:0,answers:{[q.id]:1}}];
    const repo={listExamVersions:async()=>[version],listSessions:async()=>sessions} as unknown as Repository;const catalog=await loadQuestionPerformanceCatalog(repo);expect(catalog.get(q.id)).toMatchObject({attemptCount:2,correctCount:1,incorrectCount:1,correctRate:.5,medianResponseTimeMs:null,responseTimeSampleCount:0});
  });

  it('reports nullable rates and excludes technical reviews from content mismatch denominators',()=>{
    const empty=summarizeDifficultyCalibrationMetrics([]);expect(empty.declaredVsEstimatedMismatchRate).toBeNull();expect(empty.empiricalCalibrationCoverage).toBeNull();
    const input=buildDifficultyCalibrationInput(question()),technical=technicalDifficultyCalibrationResult(input,'A1','DIFFICULTY_CALIBRATION_PROVIDER_FAILURE','test'),pass=withDifficultyCalibrationAudit(finalizeDifficultyCalibration(analysis(input,.15),'A1',input),{provider:'test'});
    const metrics=summarizeDifficultyCalibrationMetrics([technical,pass] as DifficultyCalibrationGateResult[]);expect(metrics).toMatchObject({difficultySampleCount:2,difficultyEvaluableSampleCount:1,difficultyTechnicalReviewCount:1,declaredVsEstimatedMismatchRate:0});
  });
});

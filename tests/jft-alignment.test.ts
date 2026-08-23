import {afterEach,describe,expect,it,vi} from 'vitest';
import type {QuestionRecord} from '@/lib/admin-types';
import type {FactoryCandidate} from '@/lib/server/factory-domain';
import {
  JFT_ALIGNMENT_PROMPT_VERSION,
  JFT_ALIGNMENT_REFERENCE_VERSION,
  JFT_ALIGNMENT_TAXONOMY_VERSION,
  buildDeclaredAlignmentTarget,
  buildJftAlignmentClassificationInput,
  finalizeJftAlignment,
  technicalJftAlignmentResult,
  summarizeJftAlignmentMetrics,
  validateJftAlignmentAnalysis,
  type JftAlignmentAnalysis,
} from '@/lib/server/jft-alignment';
import {HttpJftAlignmentProvider,MockJftAlignmentProvider,type JftAlignmentProvider} from '@/lib/server/jft-alignment-provider';
import {runJftAlignmentGate} from '@/lib/server/factory-service';

const now='2026-08-18T00:00:00.000Z';
function question(overrides:Partial<QuestionRecord>={}):QuestionRecord{return {id:'Q-QA5',section:'reading',type:'choice',level:'A1',instruction:'文を読んで、答えてください。',prompt:'【営業時間】店は午前9時に開きます。店は何時に開きますか。',choices:['8時','9時','10時','11時'],answer:1,explanationVi:'Synthetic explanation.',tags:[],version:1,status:'review',source:'ai',createdAt:now,updatedAt:now,...overrides}}
function candidate(q=question()):FactoryCandidate{return {id:'C-QA5',question:q,qa:{passed:true,score:100,issues:[]},generation:{provider:'synthetic',promptVersion:'test',createdAt:now}}}
async function mockAnalysis(q:QuestionRecord,audioScript?:string){const input=buildJftAlignmentClassificationInput(q,audioScript);return {input,analysis:validateJftAlignmentAnalysis(await new MockJftAlignmentProvider().classify(input),input)}}

describe('QA5 independent JFT alignment classification',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('Fixture A classifies isolated kanji reading independently and hard-fails a Reading information-search declaration',async()=>{
    const q=question({instruction:'いちばんいい答えを選んでください。',prompt:'「病院」の読み方はどれですか。',choices:['びょういん','びょいん','びょうえん','びょえん']});
    const {input,analysis}=await mockAnalysis(q);
    expect(analysis.independentAssessment).toMatchObject({actualSection:'script_vocabulary',actualCategory:'kanji_reading',requiredModality:'TEXT'});
    const result=finalizeJftAlignment(analysis,{section:'reading',category:'information_search',canDo:'Locate information in a hospital notice.',taskType:'information_search'},input);
    expect(result).toMatchObject({verdict:'FAIL',hardFail:true});
    expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['SECTION_MISMATCH_CRITICAL','CATEGORY_MISMATCH_CRITICAL','QUESTION_DOES_NOT_MEASURE_DECLARED_SKILL']));
  });

  it('Fixture B detects strong audio dependency when departure time exists only in audio',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'電車は何時に出ますか。',choices:['8時','9時','10時','11時']});
    const {analysis}=await mockAnalysis(q,'電車は10時に出ます。');
    expect(analysis.independentAssessment.actualSection).toBe('listening');
    expect(analysis.independentAssessment.requiredModality).toBe('AUDIO');
    expect(analysis.modalityDependency).toBe('STRONG');
  });

  it('Fixture C hard-fails Listening when visible text already supplies the answer',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'電車は10時に出ます。何時に出ますか。',choices:['8時','9時','10時','11時']});
    const {input,analysis}=await mockAnalysis(q,'電車は10時に出ます。');
    const result=finalizeJftAlignment(analysis,{section:'listening',category:'announcement_instruction',canDo:'Understand a simple spoken announcement or instruction.',taskType:'announcement_instruction'},input);
    expect(analysis.modalityDependency).toBe('NONE');
    expect(result).toMatchObject({verdict:'FAIL',hardFail:true});
    expect(result.issues.map(issue=>issue.code)).toContain('LISTENING_NOT_REQUIRED');
    expect(result.taskValidity.constructIrrelevantClues.length).toBeGreaterThan(0);
  });

  it('Fixture D passes practical Reading information search that requires a shop schedule',async()=>{
    const q=question();const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'reading',category:'information_search',canDo:'Locate and match practical information in a written schedule or notice.',taskType:'information_search'},input);
    expect(result.independentAssessment).toMatchObject({actualSection:'reading',actualCategory:'information_search',requiredModality:'TEXT'});
    expect(result.alignment.modalityDependency).toBe('STRONG');
    expect(result).toMatchObject({verdict:'PASS',hardFail:false});
    expect(result.scores.total).toBeGreaterThanOrEqual(90);
  });

  it('matches a Japanese Can-do paraphrase semantically without exact string equality',async()=>{
    const q=question();const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'reading',category:'information_search',canDo:'店の営業時間から開店時刻を探せる',taskType:'information_search'},input);
    expect(result.alignment.canDo).toBe('STRONG_MATCH');expect(result.verdict).toBe('PASS');
  });

  it('matches Japanese and English response-selection Can-do paraphrases by competency dimensions',async()=>{
    const q=question({section:'conversation_expression',instruction:'会話の正しい返答を選んでください。',prompt:'A：すみません、駅はどこですか。\nB：（　）。',choices:['あそこです','七時です','千円です','火曜日です']});
    const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'conversation_expression',category:'expression',canDo:'正しい返答を選ぶことができる。',taskType:'expression'},input);
    expect(analysis.independentAssessment.actualCanDo).toContain('appropriate expression');
    expect(result.alignment.canDo).toBe('STRONG_MATCH');
    expect(result).toMatchObject({verdict:'PASS',hardFail:false});
  });

  it('Fixture E rejects topic overlap when isolated kanji reading does not measure workplace instructions',async()=>{
    const q=question({section:'script_vocabulary',instruction:'読み方を選んでください。',prompt:'「作業」の読み方はどれですか。',choices:['さぎょう','さごう','さきょう','さこう']});
    const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'script_vocabulary',category:'kanji_reading',canDo:'Understand simple workplace instructions.',taskType:'kanji_reading'},input);
    expect(result.alignment.canDo).toBe('MISMATCH');
    expect(result.issues.map(issue=>issue.code)).toContain('CAN_DO_MISMATCH_CRITICAL');
    expect(result.verdict).toBe('FAIL');
  });

  it('rejects productive instruction-giving when the item only measures receptive instruction comprehension',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'何をしますか。',choices:['箱を開けます','箱を運びます','箱を閉めます','箱を捕てます']});
    const {input,analysis}=await mockAnalysis(q,'この箱を運んでください。');
    const result=finalizeJftAlignment(analysis,{section:'listening',category:'announcement_instruction',canDo:'Can give simple workplace instructions.',taskType:'announcement_instruction'},input);
    expect(analysis.independentAssessment.actualCanDo).toContain('Understand');
    expect(result.alignment.canDo).toBe('MISMATCH');
    expect(result.issues.map(issue=>issue.code)).toContain('CAN_DO_MISMATCH_CRITICAL');
    expect(result).toMatchObject({verdict:'FAIL',hardFail:true});
  });

  it('reviews a vague Can-do instead of treating missing learner direction as a strong match',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'何をしますか。',choices:['箱を開けます','箱を運びます','箱を閉めます','箱を置きます']});
    const {input,analysis}=await mockAnalysis(q,'この箱を運んでください。');
    const result=finalizeJftAlignment(analysis,{section:'listening',category:'announcement_instruction',canDo:'職場の指示',taskType:'announcement_instruction'},input);
    expect(result.alignment.canDo).toBe('PARTIAL_MATCH');
    expect(result).toMatchObject({verdict:'REVIEW',hardFail:false});
  });

  it('recognizes Japanese productive instruction wording as different from receptive comprehension',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'何をしますか。',choices:['箱を開けます','箱を運びます','箱を閉めます','箱を置きます']});
    const {input,analysis}=await mockAnalysis(q,'この箱を運んでください。');
    const result=finalizeJftAlignment(analysis,{section:'listening',category:'announcement_instruction',canDo:'簡単な指示をすることができる',taskType:'announcement_instruction'},input);
    expect(result.alignment.canDo).toBe('MISMATCH');
    expect(result).toMatchObject({verdict:'FAIL',hardFail:true});
  });

  it('Fixture F does not fail a correctly declared controlled grammar exercise merely for lower authenticity',async()=>{
    const q=question({section:'conversation_expression',instruction:'（　）に入るいちばんいいものを選んでください。',prompt:'毎朝、7時（　）起きます。',choices:['に','を','で','が']});
    const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'conversation_expression',category:'grammar',canDo:'Choose a grammatical form that completes a sentence.',taskType:'grammar'},input);
    expect(analysis.taskValidity.realWorldValidity).toBe('ARTIFICIAL');
    expect(result).toMatchObject({verdict:'PASS',hardFail:false});
  });

  it('blocks a complete task-type mismatch even when section, category, and Can-do match',async()=>{
    const q=question();const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'reading',category:'information_search',canDo:analysis.independentAssessment.actualCanDo,taskType:'kanji_reading'},input);
    expect(result.alignment.taskType).toBe('MISMATCH');expect(result.issues.map(issue=>issue.code)).toContain('TASK_TYPE_MISMATCH');expect(result).toMatchObject({verdict:'FAIL',hardFail:true});
  });

  it('does not treat a shared workplace setting as a Can-do match',async()=>{
    const q=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'何をしますか。',choices:['作業を始めます','休みます','帰ります','食べます']});const {input,analysis}=await mockAnalysis(q,'作業を始めてください。');
    const result=finalizeJftAlignment(analysis,{section:'listening',category:'announcement_instruction',canDo:'職場であいさつができる',taskType:'announcement_instruction'},input);
    expect(result.alignment.canDo).toBe('MISMATCH');expect(result.verdict).toBe('FAIL');
  });

  it('classifies interaction and announcement by learner operation rather than location',async()=>{
    const station=question({section:'listening',type:'audio_choice',prompt:'男の人はどこへ行きますか。',choices:['1番線','2番線','3番線','4番線']});
    const stationAnalysis=(await mockAnalysis(station,'A：すみません、大阪行きは何番線ですか。\nB：2番線です。')).analysis;
    expect(stationAnalysis.independentAssessment.actualCategory).toBe('conversation');
    const shop=question({section:'listening',type:'audio_choice',prompt:'店は何時に閉まりますか。',choices:['6時','7時','8時','9時']});
    const shopAnalysis=(await mockAnalysis(shop,'店内放送です。本日は8時に閉店します。')).analysis;
    expect(shopAnalysis.independentAssessment.actualCategory).toBe('announcement_instruction');
  });

  it('hard-fails decorative Reading text and reviews missing visual evidence',async()=>{
    const decorative=question({instruction:'文を読んで答えてください。',prompt:'「病院」の意味はどれですか。',choices:['hospital','station','bank','school']});
    const {input,analysis}=await mockAnalysis(decorative);const result=finalizeJftAlignment(analysis,{section:'reading',category:'content_comprehension',canDo:'Understand a practical written text.',taskType:'content_comprehension'},input);
    expect(result.issues.map(issue=>issue.code)).toContain('READING_NOT_REQUIRED');expect(result.verdict).toBe('FAIL');
    const visual=question({instruction:'図を見て答えてください。',prompt:'入口はどこですか。'});const visualEvidence=await mockAnalysis(visual);
    const visualResult=finalizeJftAlignment(visualEvidence.analysis,{section:'reading',category:'information_search',canDo:'Locate an entrance on a map.',taskType:'information_search'},visualEvidence.input);
    expect(visualResult.verdict).toBe('REVIEW');expect(visualResult.issues.map(issue=>issue.code)).toContain('ALIGNMENT_UNASSESSABLE_MISSING_VISUAL');
  });

  it('keeps multiple plausible categories and incomplete reference evidence in REVIEW',async()=>{
    const q=question({section:'script_vocabulary',instruction:'いちばんいいものを選んでください。',prompt:'きょうはいい天気です。',choices:['晴れ','雨','駅','会社']});const {input,analysis}=await mockAnalysis(q);
    const result=finalizeJftAlignment(analysis,{section:'script_vocabulary',category:'word_usage',canDo:analysis.independentAssessment.actualCanDo,taskType:'word_usage'},input);
    expect(analysis.uncertainty.multiplePlausibleCategories).toEqual(['word_meaning','word_usage']);expect(result.verdict).toBe('REVIEW');expect(result.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['REFERENCE_EVIDENCE_INCOMPLETE','UNCERTAIN_CATEGORY','MULTIPLE_PLAUSIBLE_CATEGORIES']));
  });

  it('keeps the independent classification byte-identical when declarations change',async()=>{
    const q=question();const input=buildJftAlignmentClassificationInput(q);const provider=new MockJftAlignmentProvider();
    const first=validateJftAlignmentAnalysis(await provider.classify(input),input);const second=validateJftAlignmentAnalysis(await provider.classify(input),input);
    expect(first.independentAssessment).toEqual(second.independentAssessment);
    const reading=finalizeJftAlignment(first,{section:'reading',category:'information_search',canDo:first.independentAssessment.actualCanDo,taskType:'information_search'},input);
    const listening=finalizeJftAlignment(second,{section:'listening',category:'conversation',canDo:'Understand a conversation.',taskType:'conversation'},input);
    expect(reading.independentAssessment).toEqual(listening.independentAssessment);expect(reading.verdict).toBe('PASS');expect(listening.verdict).toBe('FAIL');
  });
});

describe('QA5 provider boundary and deterministic gate',()=>{
  afterEach(()=>{vi.unstubAllGlobals();vi.unstubAllEnvs()});

  it('blinds the HTTP classification request to answer and all declared/earlier-QA metadata',async()=>{
    const q=question({id:'AI-LISTENING-JOB-001'});const input=buildJftAlignmentClassificationInput(q);let body:any;
    vi.stubEnv('JFT_ALIGNMENT_ENDPOINT','https://qa5.test/classify');vi.stubGlobal('fetch',vi.fn(async(_url,init)=>{body=JSON.parse(String((init as RequestInit).body));return new Response(JSON.stringify(await new MockJftAlignmentProvider().classify(body.input)),{status:200,headers:{'content-type':'application/json'}})}));
    const output=await new HttpJftAlignmentProvider().classify(input) as Record<string,unknown>;
    expect(body).toMatchObject({task:'jft_alignment_classification',promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION});
    expect(Object.keys(body.input).sort()).toEqual(['choices','instruction','questionId','referenceRubric','referenceVersion','stem','taxonomy','taxonomyVersion'].sort());
    expect(body.input).not.toHaveProperty('answer');expect(body.input).not.toHaveProperty('explanationVi');expect(body.input).not.toHaveProperty('section');expect(body.input).not.toHaveProperty('category');expect(body.input).not.toHaveProperty('canDo');expect(body.input).not.toHaveProperty('contentQa');expect(body.input).not.toHaveProperty('answerOracleQa');expect(body.input).not.toHaveProperty('curriculumGroundingQa');
    expect(input.questionId).not.toBe(q.id);expect(body.input.questionId).toBe(input.questionId);expect(body.input.questionId).toMatch(/^QA5-[0-9a-f]{8}$/);expect(output.questionId).toBe(input.questionId);
  });

  it('strictly rejects provider attempts to add verdict/release data or invalid category mappings',async()=>{
    const {input,analysis}=await mockAnalysis(question());
    expect(()=>validateJftAlignmentAnalysis({...analysis,verdict:'PASS'},input)).toThrow(/shape/i);
    expect(()=>validateJftAlignmentAnalysis({...analysis,independentAssessment:{...analysis.independentAssessment,actualSection:'reading',actualCategory:'kanji_reading'}},input)).toThrow(/category/i);
    expect(()=>validateJftAlignmentAnalysis({...analysis,independentAssessment:{...analysis.independentAssessment,actualSection:'listening',actualCategory:'conversation',requiredModality:'TEXT'},modalityDependency:'STRONG'},input)).toThrow(/Listening classification must require audio/i);
  });

  it('treats TEXT_AUDIO as Listening and rejects it as a primary Reading modality',async()=>{
    const readingQuestion=question();
    const readingInput=buildJftAlignmentClassificationInput(readingQuestion,'補助音声です。');
    const readingAnalysis=validateJftAlignmentAnalysis(await new MockJftAlignmentProvider().classify(buildJftAlignmentClassificationInput(readingQuestion)),buildJftAlignmentClassificationInput(readingQuestion));
    expect(()=>validateJftAlignmentAnalysis({...readingAnalysis,independentAssessment:{...readingAnalysis.independentAssessment,requiredModality:'TEXT_AUDIO'}},readingInput)).toThrow(/Reading classification cannot require answer-discriminating audio/i);

    const listeningQuestion=question({section:'listening',type:'audio_choice',instruction:'音声を聞いて答えてください。',prompt:'電車は何時に出ますか。',choices:['8時','9時','10時','11時']});
    const listeningInput=buildJftAlignmentClassificationInput(listeningQuestion,'電車は10時に出ます。');
    const listeningAnalysis=validateJftAlignmentAnalysis(await new MockJftAlignmentProvider().classify(listeningInput),listeningInput);
    expect(()=>validateJftAlignmentAnalysis({...listeningAnalysis,independentAssessment:{...listeningAnalysis.independentAssessment,requiredModality:'TEXT_AUDIO'}},listeningInput)).not.toThrow();
  });

  it('turns low confidence, incomplete reference evidence, invalid output, and provider failure into REVIEW',async()=>{
    const q=question();const {input,analysis}=await mockAnalysis(q);const declared=buildDeclaredAlignmentTarget(q,{category:'information_search',canDo:analysis.independentAssessment.actualCanDo,taskType:'information_search'});
    const low=finalizeJftAlignment({...analysis,confidence:'LOW',uncertainty:{...analysis.uncertainty,referenceEvidenceComplete:false}},declared,input);
    expect(low.verdict).toBe('REVIEW');expect(low.issues.map(issue=>issue.code)).toEqual(expect.arrayContaining(['LOW_CONFIDENCE','REFERENCE_EVIDENCE_INCOMPLETE']));
    expect(technicalJftAlignmentResult(input,declared,'JFT_ALIGNMENT_INVALID_OUTPUT','test').verdict).toBe('REVIEW');
    const invalid:JftAlignmentProvider={name:'invalid',async classify(){return {qaVersion:JFT_ALIGNMENT_PROMPT_VERSION,questionId:q.id,verdict:'PASS'}}};const invalidCandidate=candidate(q);await runJftAlignmentGate(invalidCandidate,{category:'information_search',canDo:declared.canDo,taskType:'information_search'},invalid);
    expect(invalidCandidate.jftAlignmentQa).toMatchObject({verdict:'REVIEW',confidence:'LOW',provider:'invalid'});expect(invalidCandidate.jftAlignmentQa?.issues.map(issue=>issue.code)).toContain('JFT_ALIGNMENT_INVALID_OUTPUT');
    const failing: JftAlignmentProvider={name:'failing',async classify(){throw new Error('offline')}};const c=candidate(q);await runJftAlignmentGate(c,{category:'information_search',canDo:declared.canDo,taskType:'information_search'},failing);
    expect(c.jftAlignmentQa).toMatchObject({verdict:'REVIEW',confidence:'LOW',provider:'failing'});expect(c.qa.issues.map(issue=>issue.code)).toContain('jft_alignment_review');
  });

  it('QA5 FAIL overrides QA1-QA4 pass evidence without mutating prior evidence and deduplicates rerun issues',async()=>{
    const q=question({section:'listening',type:'audio_choice',prompt:'電車は10時に出ます。何時に出ますか。',choices:['8時','9時','10時','11時']});
    const prior={qaVersion:'PRIOR',verdict:'PASS',hardFail:false};const c={...candidate(q),audioScript:'電車は10時に出ます。',contentQa:prior,answerOracleQa:prior,japaneseNaturalnessQa:prior,curriculumGroundingQa:prior} as unknown as FactoryCandidate;
    await runJftAlignmentGate(c,{category:'announcement_instruction',canDo:'Understand a simple spoken announcement or instruction.',taskType:'announcement_instruction'},new MockJftAlignmentProvider());
    expect(c.qa.passed).toBe(false);expect(c.jftAlignmentQa).toMatchObject({questionId:q.id,verdict:'FAIL'});expect(c.contentQa).toBe(prior);expect(c.answerOracleQa).toBe(prior);expect(c.japaneseNaturalnessQa).toBe(prior);expect(c.curriculumGroundingQa).toBe(prior);expect([c.contentQa,c.answerOracleQa,c.japaneseNaturalnessQa,c.curriculumGroundingQa].every(result=>result?.verdict==='PASS')).toBe(true);
    await runJftAlignmentGate(c,{category:'announcement_instruction',canDo:'Understand a simple spoken announcement or instruction.',taskType:'announcement_instruction'},new MockJftAlignmentProvider());
    expect(c.qa.issues.filter(issue=>issue.code==='jft_alignment_fail')).toHaveLength(1);
  });

  it('reports nullable rates and explicit sample counts instead of false-green zeroes',async()=>{
    expect(summarizeJftAlignmentMetrics([])).toMatchObject({alignmentSampleCount:0,alignmentEvaluableSampleCount:0,alignmentTechnicalReviewCount:0,listeningAlignmentSampleCount:0,sectionMismatchRate:null,listeningDependencyFailureRate:null,alignmentReviewRate:null});
    const q=question();const {input,analysis}=await mockAnalysis(q);const normalized=finalizeJftAlignment(analysis,{section:'reading',category:'information_search',canDo:analysis.independentAssessment.actualCanDo,taskType:'information_search'},input);
    const audited={...normalized,provider:'test',promptVersion:JFT_ALIGNMENT_PROMPT_VERSION,referenceVersion:JFT_ALIGNMENT_REFERENCE_VERSION,taxonomyVersion:JFT_ALIGNMENT_TAXONOMY_VERSION,checkedAt:now};
    expect(summarizeJftAlignmentMetrics([audited])).toMatchObject({alignmentSampleCount:1,readingAlignmentSampleCount:1,sectionMismatchRate:0,readingDependencyFailureRate:0,alignmentReviewRate:0});
    const technical=technicalJftAlignmentResult(input,buildDeclaredAlignmentTarget(q,{category:'information_search',canDo:'Read a notice.',taskType:'information_search'}),'JFT_ALIGNMENT_PROVIDER_FAILURE','offline');
    expect(summarizeJftAlignmentMetrics([technical])).toMatchObject({alignmentSampleCount:1,alignmentEvaluableSampleCount:0,alignmentTechnicalReviewCount:1,readingAlignmentSampleCount:0,readingDependencyFailureRate:null,alignmentReviewRate:1});
  });
});

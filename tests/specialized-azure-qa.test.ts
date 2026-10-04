import { afterEach, describe, expect, it, vi } from 'vitest';
import type { QuestionRecord } from '@/lib/admin-types';
import type { FactoryCandidate } from '@/lib/server/factory-domain';
import { buildAnswerOracleInput } from '@/lib/server/answer-oracle';
import { buildJapaneseNaturalnessInput } from '@/lib/server/japanese-naturalness';
import type { CurriculumGroundingInput } from '@/lib/server/curriculum-grounding';
import { buildJftAlignmentClassificationInput } from '@/lib/server/jft-alignment';
import { buildDifficultyCalibrationInput } from '@/lib/server/difficulty-calibration';
import { buildOriginalityDuplicateInput } from '@/lib/server/originality-duplicate';
import { getAnswerOracleProvider, DeterministicAnswerOracleProvider } from '@/lib/server/answer-oracle-provider';
import { getJapaneseNaturalnessProvider, MockJapaneseNaturalnessProvider } from '@/lib/server/japanese-naturalness-provider';
import { getCurriculumGroundingProvider, MockCurriculumGroundingProvider } from '@/lib/server/curriculum-grounding-provider';
import { getJftAlignmentProvider, MockJftAlignmentProvider } from '@/lib/server/jft-alignment-provider';
import { getDifficultyCalibrationProvider, MockDifficultyCalibrationProvider } from '@/lib/server/difficulty-calibration-provider';
import { getOriginalityDuplicateProvider, MockOriginalityDuplicateProvider } from '@/lib/server/originality-duplicate-provider';
import { SPECIALIZED_QA_PREFIXES, specializedAzureQaConfig } from '@/lib/server/specialized-azure-qa';
import { runAnswerOracleGate } from '@/lib/server/factory-service';
import { GET as system } from '@/app/api/v1/system/route';

const question: QuestionRecord = {id:'SECRET-A1',section:'reading',type:'choice',level:'A1',instruction:'読んで答えてください。',prompt:'店は九時に開きます。何時に開きますか。',choices:['八時','九時','十時','十一時'],answer:1,explanationVi:'SECRET-EXPLANATION',tags:[],version:1,status:'review',source:'ai',createdAt:'2026-01-01',updatedAt:'2026-01-01'};
function configure() {
  for (const prefix of SPECIALIZED_QA_PREFIXES) vi.stubEnv(`${prefix}_PROVIDER`, 'azure-openai');
  vi.stubEnv('AOAI_ENDPOINT','https://qa.openai.azure.com');
  vi.stubEnv('API_KEY','azure-secret');
  vi.stubEnv('AZURE_OPENAI_DEPLOYMENT','independent-judge');
}
afterEach(()=>{vi.unstubAllEnvs();vi.unstubAllGlobals()});

describe('native specialized Azure QA',()=>{
  it('runs all six judges through Azure JSON transport with their existing input contracts',async()=>{
    configure();
    const oracle=buildAnswerOracleInput(question);
    const naturalness=buildJapaneseNaturalnessInput(question);
    const curriculum:CurriculumGroundingInput={...oracle,targetLevel:'A1',approvedKnowledgeUnits:[],sourceChunks:[],retrieval:{complete:false,strategy:'UNAVAILABLE',totalApprovedUnits:0,returnedUnitCount:0,searchedSourceDocumentIds:[],intendedKnowledgeUnitIds:[],missingIntendedKnowledgeUnitIds:[]}};
    const alignment=buildJftAlignmentClassificationInput(question);
    const difficulty=buildDifficultyCalibrationInput(question);
    const originality=buildOriginalityDuplicateInput(question,{sourceExpected:false,corpus:[]});
    const cases=[
      {input:oracle,output:await new DeterministicAnswerOracleProvider().solve(oracle),run:()=>getAnswerOracleProvider().solve(oracle)},
      {input:naturalness,output:await new MockJapaneseNaturalnessProvider().judge(naturalness),run:()=>getJapaneseNaturalnessProvider().judge(naturalness)},
      {input:curriculum,output:await new MockCurriculumGroundingProvider().evaluate(curriculum),run:()=>getCurriculumGroundingProvider().evaluate(curriculum)},
      {input:alignment,output:await new MockJftAlignmentProvider().classify(alignment),run:()=>getJftAlignmentProvider().classify(alignment)},
      {input:difficulty,output:await new MockDifficultyCalibrationProvider().estimate(difficulty),run:()=>getDifficultyCalibrationProvider().estimate(difficulty)},
      {input:originality,output:await new MockOriginalityDuplicateProvider().analyze(originality),run:()=>getOriginalityDuplicateProvider().analyze(originality)},
    ];
    for(const item of cases){
      const fetch=vi.fn(async(url,init:RequestInit)=>{
        expect(url).toBe('https://qa.openai.azure.com/openai/v1/chat/completions');
        expect(init.headers).toMatchObject({'api-key':'azure-secret'});
        const payload=JSON.parse(String(init.body));
        expect(payload.model).toBe('independent-judge');
        expect(payload.messages[0].content).toContain('JSON');
        expect(JSON.parse(payload.messages[1].content)).toEqual(item.input);
        expect(payload.messages[1].content).not.toContain('SECRET-EXPLANATION');
        expect(item.input).not.toHaveProperty('answer');
        return Response.json({choices:[{message:{content:JSON.stringify(item.output)}}]});
      });
      vi.stubGlobal('fetch',fetch);
      expect(await item.run()).toEqual(item.output);
      expect(fetch).toHaveBeenCalledOnce();
    }
  });
  it('keeps Azure overrides separate from HTTP adapter credentials',()=>{
    configure();vi.stubEnv('ANSWER_ORACLE_API_KEY','http-secret');vi.stubEnv('ANSWER_ORACLE_ENDPOINT','https://adapter.test');
    expect(specializedAzureQaConfig('ANSWER_ORACLE')).toEqual({endpoint:'https://qa.openai.azure.com',apiKey:'azure-secret',deployment:'independent-judge'});
    vi.stubEnv('ANSWER_ORACLE_AZURE_ENDPOINT','https://oracle.openai.azure.com');vi.stubEnv('ANSWER_ORACLE_AZURE_API_KEY','oracle-key');vi.stubEnv('ANSWER_ORACLE_MODEL','oracle-deployment');
    expect(specializedAzureQaConfig('ANSWER_ORACLE')).toEqual({endpoint:'https://oracle.openai.azure.com',apiKey:'oracle-key',deployment:'oracle-deployment'});
  });
  it.each(['offline','invalid','wrong-id'])('keeps %s Azure evidence blocked by the existing Oracle gate',async failure=>{
    configure();
    vi.stubGlobal('fetch',vi.fn(async()=>{
      if(failure==='offline')throw new Error('offline');
      const input=buildAnswerOracleInput(question);
      const result=await new DeterministicAnswerOracleProvider().solve(input);
      return Response.json({choices:[{message:{content:failure==='invalid'?'not-json':JSON.stringify({...result,questionId:'OTHER'})}}]});
    }));
    const candidate:FactoryCandidate={id:'candidate',question,qa:{passed:true,score:100,issues:[]},generation:{provider:'test',promptVersion:'v1',createdAt:'2026-01-01'}};
    await runAnswerOracleGate(candidate);
    expect(candidate.answerOracleQa?.verdict).toBe('REVIEW');
    expect(candidate.qa.issues).toEqual(expect.arrayContaining([expect.objectContaining({code:'answer_oracle_review'})]));
  });
  it('does not report authoring ready just because Azure mode was selected without credentials',async()=>{
    configure();vi.stubEnv('API_KEY','');vi.stubEnv('AI_QA_API_KEY','');
    const body=await (await system()).json();
    expect(body.authoringReady).toBe(false);
    expect(body.specializedQa.answerOracle).toBe('azure-openai');
    expect(body.authoringBlockers).toContain('ANSWER_ORACLE Azure apiKey is not configured.');
  });
});

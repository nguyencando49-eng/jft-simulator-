import { afterEach, describe, expect, it } from 'vitest';
import { e2eSessionDurationMs } from '@/lib/server/e2e';
import { toCandidateQuestion } from '@/lib/server/candidate-question';
import type {QuestionRecord} from '@/lib/admin-types';

const originalMode=process.env.E2E_TEST_MODE;
const originalNodeEnv=process.env.NODE_ENV;
const mutableEnv=process.env as Record<string,string|undefined>;
afterEach(()=>{
  if(originalMode===undefined) delete mutableEnv.E2E_TEST_MODE; else mutableEnv.E2E_TEST_MODE=originalMode;
  if(originalNodeEnv===undefined) delete mutableEnv.NODE_ENV; else mutableEnv.NODE_ENV=originalNodeEnv;
});

it('candidate projection cannot expose answers, explanations, or QA evidence',()=>{
  const q={id:'q',section:'reading',type:'choice',level:'A1',instruction:'i',prompt:'p',choices:['a','b'],answer:1,explanationVi:'secret',tags:[],version:1,status:'approved',source:'ai',createdAt:'x',updatedAt:'x',answerOracleQa:{verdict:'PASS'},japaneseNaturalnessQa:{verdict:'PASS'},curriculumGroundingQa:{verdict:'PASS',knowledgeUnitIds:['KU-SECRET'],sourceChunkIds:['SC-SECRET']},jftAlignmentQa:{verdict:'FAIL',independentAssessment:{actualAssessmentTarget:'ALIGNMENT-SECRET'},provider:'QA5-PROVIDER-SECRET'},difficultyCalibrationQa:{verdict:'REVIEW',difficultyScore:.73,provider:'QA6-PROVIDER-SECRET',issues:[{evidence:'DIFFICULTY-SECRET'}]}} as QuestionRecord & {answerOracleQa:unknown;japaneseNaturalnessQa:unknown;curriculumGroundingQa:unknown;jftAlignmentQa:unknown;difficultyCalibrationQa:unknown};
  const safe=toCandidateQuestion(q);
  expect(safe).not.toHaveProperty('answer');expect(safe).not.toHaveProperty('explanationVi');expect(safe).not.toHaveProperty('answerOracleQa');expect(safe).not.toHaveProperty('japaneseNaturalnessQa');expect(safe).not.toHaveProperty('curriculumGroundingQa');expect(safe).not.toHaveProperty('jftAlignmentQa');expect(safe).not.toHaveProperty('difficultyCalibrationQa');expect(JSON.stringify(safe)).not.toContain('KU-SECRET');expect(JSON.stringify(safe)).not.toContain('SC-SECRET');expect(JSON.stringify(safe)).not.toContain('ALIGNMENT-SECRET');expect(JSON.stringify(safe)).not.toContain('QA5-PROVIDER-SECRET');expect(JSON.stringify(safe)).not.toContain('QA6-PROVIDER-SECRET');expect(JSON.stringify(safe)).not.toContain('DIFFICULTY-SECRET');
});
function requestWith(seconds:string){return new Request('http://local.test',{headers:{cookie:`jft-e2e-duration-seconds=${seconds}`}})}

describe('E2E duration override safety',()=>{
  it('is ignored unless E2E_TEST_MODE is explicitly enabled',()=>{
    mutableEnv.E2E_TEST_MODE='false';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(60_000);
  });
  it('accepts bounded test durations outside production',()=>{
    mutableEnv.E2E_TEST_MODE='true';
    mutableEnv.NODE_ENV='test';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(3_000);
    expect(e2eSessionDurationMs(requestWith('1'),60_000)).toBe(60_000);
    expect(e2eSessionDurationMs(requestWith('999'),60_000)).toBe(60_000);
  });
  it('is always ignored in production',()=>{
    mutableEnv.E2E_TEST_MODE='true';
    mutableEnv.NODE_ENV='production';
    expect(e2eSessionDurationMs(requestWith('3'),60_000)).toBe(60_000);
  });
});

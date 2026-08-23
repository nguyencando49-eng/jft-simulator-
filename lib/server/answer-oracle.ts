import type { QuestionRecord } from '@/lib/admin-types';

export const ANSWER_ORACLE_PROMPT_VERSION='JFT_ANSWER_ORACLE_V1' as const;
export const DEFAULT_ANSWER_ORACLE_CONFIDENCE_THRESHOLD=0.85;

export type OracleChoiceClassification='CORRECT'|'PLAUSIBLE_BUT_INCORRECT'|'CLEARLY_INCORRECT'|'AMBIGUOUS';
export type AnswerOracleOutcome='ORACLE_MATCH'|'ANSWER_KEY_MISMATCH'|'MULTIPLE_DEFENSIBLE_ANSWERS'|'NO_DEFENSIBLE_ANSWER'|'LOW_CONFIDENCE'|'HIDDEN_CONTEXT_REQUIRED'|'QA_ORACLE_INVALID_OUTPUT'|'QA_ORACLE_PROVIDER_FAILURE';

/** Learner-visible semantic evidence only. Deliberately has no answer/explanation fields. */
export interface AnswerOracleInput {
  questionId:string;
  section:QuestionRecord['section'];
  instruction:string;
  stem:string;
  choices:string[];
  audioScript?:string;
}
export interface AnswerOracleSolveResult {
  qaVersion:typeof ANSWER_ORACLE_PROMPT_VERSION;
  questionId:string;
  derivedCorrectOptions:number[];
  numberOfDefensibleAnswers:number;
  confidence:number;
  choiceAnalysis:Array<{index:number;classification:OracleChoiceClassification;reason:string}>;
  ambiguity:{detected:boolean;reason:string|null};
  hiddenContextRequired:boolean;
  solverNotes:string;
}
export interface AnswerOracleGateResult extends AnswerOracleSolveResult {
  verdict:'PASS'|'REVIEW'|'FAIL';
  outcome:AnswerOracleOutcome;
  hardFail:boolean;
  declaredCorrectOption:number;
  match:boolean;
  threshold:number;
  provider:string;
  model?:string;
  promptVersion:typeof ANSWER_ORACLE_PROMPT_VERSION;
  checkedAt:string;
}

export class AnswerOracleError extends Error {
  constructor(public readonly code:'QA_ORACLE_INVALID_OUTPUT'|'QA_ORACLE_PROVIDER_FAILURE',message:string){super(message);this.name='AnswerOracleError';}
}

export function buildAnswerOracleInput(question:QuestionRecord,audioScript?:string):AnswerOracleInput{
  return {questionId:question.id,section:question.section,instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(question.section==='listening'&&audioScript?.trim()?{audioScript}:{})};
}

const classifications=new Set<OracleChoiceClassification>(['CORRECT','PLAUSIBLE_BUT_INCORRECT','CLEARLY_INCORRECT','AMBIGUOUS']);
export function validateAnswerOracleOutput(value:unknown,input:AnswerOracleInput):AnswerOracleSolveResult{
  const fail=(message:string):never=>{throw new AnswerOracleError('QA_ORACLE_INVALID_OUTPUT',message)};
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Oracle output must be an object.');
  const v=value as Record<string,unknown>;
  if(v.qaVersion!==ANSWER_ORACLE_PROMPT_VERSION)fail('Invalid qaVersion.');
  if(v.questionId!==input.questionId)fail('questionId does not match the request.');
  if(!Array.isArray(v.derivedCorrectOptions)||v.derivedCorrectOptions.some(x=>!Number.isInteger(x)||Number(x)<0||Number(x)>=input.choices.length))fail('derivedCorrectOptions contains an invalid index.');
  const derived=[...(v.derivedCorrectOptions as number[])];
  if(new Set(derived).size!==derived.length)fail('derivedCorrectOptions contains duplicates.');
  if(!Number.isInteger(v.numberOfDefensibleAnswers)||v.numberOfDefensibleAnswers!==derived.length)fail('numberOfDefensibleAnswers must equal derivedCorrectOptions length.');
  if(typeof v.confidence!=='number'||!Number.isFinite(v.confidence)||v.confidence<0||v.confidence>1)fail('confidence must be between 0 and 1.');
  if(!Array.isArray(v.choiceAnalysis)||v.choiceAnalysis.length!==input.choices.length)fail('Every choice must be analyzed exactly once.');
  const choiceAnalysis=(v.choiceAnalysis as unknown[]).map((raw,i)=>{
    if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail(`choiceAnalysis[${i}] is invalid.`);
    const x=raw as Record<string,unknown>;
    if(!Number.isInteger(x.index)||Number(x.index)<0||Number(x.index)>=input.choices.length||!classifications.has(x.classification as OracleChoiceClassification)||typeof x.reason!=='string'||!x.reason.trim())return fail(`choiceAnalysis[${i}] is invalid.`);
    return {index:Number(x.index),classification:x.classification as OracleChoiceClassification,reason:x.reason};
  });
  if(new Set(choiceAnalysis.map(x=>x.index)).size!==input.choices.length)fail('Choice indexes must be unique and complete.');
  const correct=choiceAnalysis.filter(x=>x.classification==='CORRECT').map(x=>x.index).sort((a,b)=>a-b);
  const sorted=[...derived].sort((a,b)=>a-b);
  if(JSON.stringify(correct)!==JSON.stringify(sorted))fail('CORRECT choice classifications must equal derivedCorrectOptions.');
  if(!v.ambiguity||typeof v.ambiguity!=='object'||Array.isArray(v.ambiguity))fail('ambiguity is invalid.');
  const ambiguity=v.ambiguity as Record<string,unknown>;
  if(typeof ambiguity.detected!=='boolean'||!(ambiguity.reason===null||typeof ambiguity.reason==='string'))fail('ambiguity fields are invalid.');
  if(typeof v.hiddenContextRequired!=='boolean'||typeof v.solverNotes!=='string')fail('Oracle context fields are invalid.');
  return {qaVersion:ANSWER_ORACLE_PROMPT_VERSION,questionId:input.questionId,derivedCorrectOptions:derived,numberOfDefensibleAnswers:derived.length,confidence:v.confidence as number,choiceAnalysis,ambiguity:{detected:ambiguity.detected as boolean,reason:ambiguity.reason as string|null},hiddenContextRequired:v.hiddenContextRequired as boolean,solverNotes:v.solverNotes as string};
}

export function compareOracleWithDeclaredAnswer(result:AnswerOracleSolveResult,declaredAnswerKey:number,metadata:{provider:string;model?:string;threshold?:number;checkedAt?:string}):AnswerOracleGateResult{
  const threshold=metadata.threshold??DEFAULT_ANSWER_ORACLE_CONFIDENCE_THRESHOLD;
  let outcome:AnswerOracleOutcome='ORACLE_MATCH',verdict:'PASS'|'REVIEW'|'FAIL'='PASS',hardFail=false;
  if(result.hiddenContextRequired){outcome='HIDDEN_CONTEXT_REQUIRED';verdict='FAIL';hardFail=true;}
  else if(result.derivedCorrectOptions.length===0){outcome='NO_DEFENSIBLE_ANSWER';verdict='FAIL';hardFail=true;}
  else if(result.derivedCorrectOptions.length>1){outcome='MULTIPLE_DEFENSIBLE_ANSWERS';verdict='FAIL';hardFail=true;}
  else if(result.derivedCorrectOptions[0]!==declaredAnswerKey){outcome='ANSWER_KEY_MISMATCH';verdict='FAIL';hardFail=true;}
  else if(result.confidence<threshold){outcome='LOW_CONFIDENCE';verdict='REVIEW';}
  return {...result,verdict,outcome,hardFail,declaredCorrectOption:declaredAnswerKey,match:result.derivedCorrectOptions.length===1&&result.derivedCorrectOptions[0]===declaredAnswerKey,threshold,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:ANSWER_ORACLE_PROMPT_VERSION,checkedAt:metadata.checkedAt||new Date().toISOString()};
}

export function technicalAnswerOracleResult(questionId:string,code:'QA_ORACLE_INVALID_OUTPUT'|'QA_ORACLE_PROVIDER_FAILURE',provider:string,model?:string):AnswerOracleGateResult{
  return {qaVersion:ANSWER_ORACLE_PROMPT_VERSION,questionId,derivedCorrectOptions:[],numberOfDefensibleAnswers:0,confidence:0,choiceAnalysis:[],ambiguity:{detected:false,reason:null},hiddenContextRequired:false,solverNotes:code,verdict:'REVIEW',outcome:code,hardFail:false,declaredCorrectOption:-1,match:false,threshold:DEFAULT_ANSWER_ORACLE_CONFIDENCE_THRESHOLD,provider,...(model?{model}:{}),promptVersion:ANSWER_ORACLE_PROMPT_VERSION,checkedAt:new Date().toISOString()};
}

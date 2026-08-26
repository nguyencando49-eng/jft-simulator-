import { ANSWER_ORACLE_PROMPT_VERSION,AnswerOracleError,type AnswerOracleInput,type AnswerOracleSolveResult,validateAnswerOracleOutput } from './answer-oracle';

export interface AnswerOracleProvider {name:string;model?:string;solve(input:AnswerOracleInput):Promise<AnswerOracleSolveResult>}

function normalizeEvidence(value:string){return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase()}
function occurrences(text:string,choice:string){const normalizedChoice=normalizeEvidence(choice);return normalizedChoice&&normalizeEvidence(text).includes(normalizedChoice)?1:0}
export class DeterministicAnswerOracleProvider implements AnswerOracleProvider{
  name='mock-answer-oracle';model='learner-visible-heuristic-v1';
  async solve(input:AnswerOracleInput):Promise<AnswerOracleSolveResult>{
    const evidence=input.section==='listening'?(input.audioScript||''):input.stem;
    const hidden=(input.section==='listening'&&!input.audioScript?.trim())||/(画像|写真|図|イラスト|audio|音声)を見て/.test(input.stem)&&!input.audioScript;
    const hits=input.choices.map(choice=>occurrences(evidence,choice));
    const derived=hits.map((hit,index)=>({hit,index})).filter(x=>x.hit).map(x=>x.index);
    const result:AnswerOracleSolveResult={qaVersion:ANSWER_ORACLE_PROMPT_VERSION,questionId:input.questionId,derivedCorrectOptions:derived,numberOfDefensibleAnswers:derived.length,confidence:hidden?0:derived.length===1?.9:.55,choiceAnalysis:input.choices.map((choice,index)=>({index,classification:derived.includes(index)?'CORRECT':choice.trim()?'PLAUSIBLE_BUT_INCORRECT':'CLEARLY_INCORRECT',reason:derived.includes(index)?'This option is directly supported by the learner-visible evidence.':'This option is not directly supported by the learner-visible evidence.'})),ambiguity:{detected:derived.length>1,reason:derived.length>1?'More than one choice is directly supported.':null},hiddenContextRequired:hidden,solverNotes:'Deterministic learner-visible evidence comparison.'};
    return validateAnswerOracleOutput(result,input);
  }
}

export class HttpAnswerOracleProvider implements AnswerOracleProvider{
  name='http-answer-oracle';model=process.env.ANSWER_ORACLE_MODEL||process.env.AI_QA_MODEL||'external';
  async solve(input:AnswerOracleInput):Promise<AnswerOracleSolveResult>{
    const endpoint=process.env.ANSWER_ORACLE_ENDPOINT||process.env.AI_QA_ENDPOINT;
    if(!endpoint)throw new AnswerOracleError('QA_ORACLE_PROVIDER_FAILURE','ANSWER_ORACLE_ENDPOINT or AI_QA_ENDPOINT is required.');
    let response:Response;
    try{response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.ANSWER_ORACLE_API_KEY||process.env.AI_QA_API_KEY?{authorization:`Bearer ${process.env.ANSWER_ORACLE_API_KEY||process.env.AI_QA_API_KEY}`}:{})},body:JSON.stringify({task:'jft_independent_answer_oracle',promptVersion:ANSWER_ORACLE_PROMPT_VERSION,input})});}
    catch(error){throw new AnswerOracleError('QA_ORACLE_PROVIDER_FAILURE',error instanceof Error?error.message:String(error));}
    if(!response.ok)throw new AnswerOracleError('QA_ORACLE_PROVIDER_FAILURE',`Answer Oracle provider failed: ${response.status}`);
    let json:unknown;try{json=await response.json();}catch{throw new AnswerOracleError('QA_ORACLE_INVALID_OUTPUT','Answer Oracle response is not valid JSON.');}
    return validateAnswerOracleOutput(json,input);
  }
}

export function getAnswerOracleProvider():AnswerOracleProvider{return process.env.ANSWER_ORACLE_PROVIDER==='http'?new HttpAnswerOracleProvider():new DeterministicAnswerOracleProvider()}
export function answerOracleProviderMode(){return process.env.ANSWER_ORACLE_PROVIDER==='http'?'http':'mock'}

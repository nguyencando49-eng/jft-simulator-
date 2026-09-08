import { ANSWER_ORACLE_PROMPT_VERSION,AnswerOracleError,type AnswerOracleInput,type AnswerOracleSolveResult,validateAnswerOracleOutput } from './answer-oracle';

export interface AnswerOracleProvider {name:string;model?:string;solve(input:AnswerOracleInput):Promise<AnswerOracleSolveResult>}

function normalizeEvidence(value:string){return value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase()}
function occurrences(text:string,choice:string){const normalizedChoice=normalizeEvidence(choice);return normalizedChoice&&normalizeEvidence(text).includes(normalizedChoice)?1:0}
function choiceForms(choice:string){
  const full=normalizeEvidence(choice);const core=full.replace(/(?:ではありません|じゃありません|ありません|でした|です|ません|ました|ます|をします|に行きます|へ行きます|をする|に行く|へ行く|する)$/u,'').replace(/(?:へ|に|を)$/u,'');
  return Array.from(new Set([full,core].filter(value=>value.length>=1)));
}
function semanticOccurrences(text:string,choice:string){const normalized=normalizeEvidence(text);return choiceForms(choice).some(form=>normalized.includes(form));}
function semanticResolve(input:AnswerOracleInput):{derived:number[];reason:string}|null{
  const evidence=input.section==='listening'?(input.audioScript||''):input.stem;
  if(!evidence.trim())return null;
  const matching=input.choices.map((choice,index)=>({index,match:semanticOccurrences(evidence,choice)})).filter(x=>x.match).map(x=>x.index);
  if(matching.length===1)return {derived:matching,reason:'One choice has a unique lexical core explicitly supported by learner-visible evidence.'};
  if(!matching.length)return null;
  const segments=evidence.split(/[。！？!?\n／、]/u).map(value=>value.trim()).filter(Boolean);
  const segmentMatches=segments.map((segment,position)=>({segment,position,choices:matching.filter(index=>semanticOccurrences(segment,input.choices[index]))}));
  const choose=(predicate:(value:{segment:string;position:number;choices:number[]})=>boolean,latest=false)=>{const rows=segmentMatches.filter(row=>row.choices.length===1&&predicate(row));if(!rows.length)return null;const row=latest?rows[rows.length-1]:rows[0];return {derived:row.choices,reason:`Explicit discourse relation resolves the answer from: ${row.segment}`};};
  if(/(?:ないもの|食べない|飲まない|ありません|いません|ではない|じゃない|ではなく)/u.test(input.stem)){
    const result=choose(row=>/(?:ません|ない|ではなく|じゃなく|だめ|不可)/u.test(row.segment));if(result)return result;
  }
  if(/(?:最初|はじめ|まず)/u.test(input.stem)){const result=choose(row=>/(?:最初|はじめ|まず)/u.test(row.segment));if(result)return result;}
  if(/(?:次|つぎ|そのあと|あとで|後で)/u.test(input.stem)){const result=choose(row=>/(?:次|つぎ|そのあと|あとで|後で)/u.test(row.segment));if(result)return result;}
  if(/(?:何時まで|いつまで|終わ|開始|始ま|集合|集ま)/u.test(input.stem)){
    const cue=/(?:まで|終わ|開始|始ま|集合|集ま|来てください)/u;const result=choose(row=>cue.test(row.segment),true);if(result)return result;
  }
  if(/(?:では|じゃあ|それでは|それで).*(?:しましょう|にします)|(?:決まり|お願いします|わかりました)/u.test(evidence)){
    const result=choose(row=>/(?:しましょう|にします|決まり|お願いします|わかりました)/u.test(row.segment),true);if(result)return result;
  }
  if(/いいえ/u.test(evidence)){const result=choose(row=>/いいえ/u.test(row.segment),true);if(result)return result;}
  const target=(input.stem.match(/(?:「[^」]+」について、)?([^。\n]{1,20}?)(?:は|が|を)(?:どこ|だれ|誰|何|いつ|何時|いくつ)/u)||[])[1];
  if(target){const compactTarget=target.replace(/^(?:音声|案内|カード)の/u,'').replace(/[「」]/gu,'');const result=choose(row=>normalizeEvidence(row.segment).includes(normalizeEvidence(compactTarget)),true);if(result)return result;}
  const requestedValue=(input.stem.match(/([^。\n]{1,16}?)(?:に|で)(?:住んでいる|いる|あります|ある).*?(?:だれ|誰|何|どれ)/u)||[])[1];
  if(requestedValue){const result=choose(row=>normalizeEvidence(row.segment).includes(normalizeEvidence(requestedValue)),true);if(result)return result;}
  return null;
}
export class DeterministicAnswerOracleProvider implements AnswerOracleProvider{
  name='mock-answer-oracle';model='learner-visible-heuristic-v1';
  async solve(input:AnswerOracleInput):Promise<AnswerOracleSolveResult>{
    const evidence=input.section==='listening'?(input.audioScript||''):input.stem;
    const hidden=(input.section==='listening'&&!input.audioScript?.trim())||/(画像|写真|図|イラスト|audio|音声)を見て/.test(input.stem)&&!input.audioScript;
    const hits=input.choices.map(choice=>occurrences(evidence,choice));
    const literal=hits.map((hit,index)=>({hit,index})).filter(x=>x.hit).map(x=>x.index);const semantic=!hidden?semanticResolve(input):null;const derived=semantic?.derived||literal;
    const result:AnswerOracleSolveResult={qaVersion:ANSWER_ORACLE_PROMPT_VERSION,questionId:input.questionId,derivedCorrectOptions:derived,numberOfDefensibleAnswers:derived.length,confidence:hidden?0:derived.length===1?.9:.55,choiceAnalysis:input.choices.map((choice,index)=>({index,classification:derived.includes(index)?'CORRECT':choice.trim()?'PLAUSIBLE_BUT_INCORRECT':'CLEARLY_INCORRECT',reason:derived.includes(index)?(semantic?.reason||'This option is directly supported by the learner-visible evidence.'):'This option is not supported as the answer by the encoded learner-visible relation.'})),ambiguity:{detected:derived.length>1,reason:derived.length>1?'More than one choice is directly supported and no safe relation disambiguates them.':null},hiddenContextRequired:hidden,solverNotes:semantic?'Deterministic semantic-relation resolution.':'Deterministic learner-visible evidence comparison.'};
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

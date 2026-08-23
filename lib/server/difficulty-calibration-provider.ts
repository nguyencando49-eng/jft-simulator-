import {DIFFICULTY_CALIBRATION_POLICY_V1,DIFFICULTY_CALIBRATION_PROMPT_VERSION,DIFFICULTY_CALIBRATION_SYSTEM_PROMPT_V1,type AcousticAssessment,type DifficultyCalibrationAnalysis,type DifficultyCalibrationInput,type DifficultyProfile,type DifficultyReasoningDepth,type DistractorStrength} from './difficulty-calibration';

export interface DifficultyCalibrationProvider {name:string;model?:string;estimate(input:DifficultyCalibrationInput):Promise<unknown>}
const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const normalized=(value:string)=>value.normalize('NFKC').toLocaleLowerCase().replace(/[\s\p{P}\p{S}_]+/gu,'');
const sentenceCount=(value:string)=>Math.max(1,value.split(/[。！？!?\n]+/u).filter(Boolean).length);
const turnCount=(value:string)=>value.split(/\n/u).filter(line=>/^(?:A|B|客|店員|男の人|女の人|先生|学生|受付)\s*[:：]/iu.test(line.trim())).length;
const facts=(value:string)=>new Set(value.match(/\d+(?:[:：]\d+)?|[一二三四五六七八九十百千]+(?:時|分|円|人|個|日|月)|(?:月曜|火曜|水曜|木曜|金曜|土曜|日曜)/gu)||[]).size;
function choiceCompetitiveness(choices:string[]):{score:number;strength:DistractorStrength}{
  const values=choices.map(normalized);const lengths=values.map(value=>value.length);const mean=lengths.reduce((sum,value)=>sum+value,0)/Math.max(1,lengths.length);const spread=mean?Math.max(...lengths)-Math.min(...lengths):0;const balanced=clamp(1-spread/Math.max(1,mean));
  const suffixes=values.map(value=>value.slice(-2));const sharedSuffix=new Set(suffixes).size<=Math.max(1,Math.ceil(choices.length/2));const score=clamp(.18+balanced*.45+(sharedSuffix?.2:0));return {score,strength:score>=.67?'STRONG':score>=.38?'MODERATE':'WEAK'};
}

export class MockDifficultyCalibrationProvider implements DifficultyCalibrationProvider{
  name='mock-difficulty-calibration';model='deterministic-difficulty-v1';
  async estimate(input:DifficultyCalibrationInput):Promise<DifficultyCalibrationAnalysis>{
    const visible=`${input.instruction}\n${input.stem}\n${input.choices.join('\n')}`,audio=input.audioScript||'',all=`${visible}\n${audio}`,chars=Array.from(all).length,turns=turnCount(audio),factCount=facts(all),sentences=sentenceCount(all);
    const advancedGrammar=/(ざるを得ない|にもかかわらず|わけではない|ことになっている|に違いない|一方で|unless|despite|whereas)/iu.test(all);
    const conditional=/(場合|なら|たら|ても|ただし|以外|までに|とき|if|unless|except|only when)/iu.test(all);
    const inference=/(なぜ|どうして|理由|もっとも|一番|考えられ|infer|imply|reason)/iu.test(all);
    const directLexical=/(読み方|よみかた|意味|どういう意味|word meaning|pronunciation)/iu.test(visible);
    const practicalSearch=/(営業時間|予定表|時刻表|メニュー|何時|いつ|どこ|いくら|schedule|opening|closing|price)/iu.test(input.stem);
    const competitor=choiceCompetitiveness(input.choices);
    const kanji=Array.from(all).filter(char=>/\p{Script=Han}/u.test(char)).length;const kanjiDensity=kanji/Math.max(1,chars);
    const linguisticComplexity=clamp(.08+Math.min(.25,chars/900)+kanjiDensity*.35+(advancedGrammar?.42:0)+(conditional?.13:0));
    const cognitiveComplexity=clamp(directLexical?.08:inference?.72:conditional&&factCount>=2?.62:factCount>=4?.50:practicalSearch?.36:.25);
    const processingLoad=clamp(.06+Math.min(.38,chars/650)+Math.min(.25,turns*.055)+Math.min(.20,factCount*.035));
    const informationDensity=clamp(.05+Math.min(.58,factCount*.10)+Math.min(.22,sentences*.025)+(conditional?.12:0));
    const modalityLoad=input.section==='listening'?clamp(.20+Math.min(.35,audio.length/350)+Math.min(.28,turns*.055)+Math.min(.18,facts(audio)*.04)):input.section==='reading'?clamp(.10+Math.min(.42,input.stem.length/500)+(practicalSearch?.12:0)+(conditional?.12:0)):.06;
    const reasoningDepth:DifficultyReasoningDepth=directLexical?'DIRECT_RECALL':inference&&conditional?'MULTI_FACTOR_INFERENCE':inference?'SIMPLE_INFERENCE':conditional&&factCount>=2?'MULTI_STEP_COMPREHENSION':factCount>=3?'MULTI_STEP_COMPREHENSION':practicalSearch?'SINGLE_STEP_COMPREHENSION':'DIRECT_MATCH';
    const profile:DifficultyProfile={linguisticComplexity,cognitiveComplexity,processingLoad,distractorCompetitiveness:competitor.score,informationDensity,modalityLoad};
    const acousticAssessment:AcousticAssessment=input.section==='listening'&&input.audioEvidence?.available&&(Number.isFinite(input.audioEvidence.durationMs)||Number.isFinite(input.audioEvidence.speechRateWpm))?'ASSESSED':input.section==='listening'?'NOT_ASSESSED':'NOT_APPLICABLE';
    return {qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:input.questionId,confidence:'MEDIUM',profile,reasoningDepth,distractorStrength:competitor.strength,acousticAssessment,evidence:{linguisticComplexity:`Character, kanji, grammar, and sentence-form signals produce ${linguisticComplexity.toFixed(2)}.`,cognitiveComplexity:`Task directness, conditions, and inference signals produce ${cognitiveComplexity.toFixed(2)}.`,processingLoad:`${chars} characters, ${sentences} segments, ${turns} dialogue turns, and ${factCount} explicit facts produce ${processingLoad.toFixed(2)}.`,distractorCompetitiveness:`Choice length/type similarity produces ${competitor.strength} distractors at ${competitor.score.toFixed(2)}.`,informationDensity:`Relevant and competing factual signals produce ${informationDensity.toFixed(2)}.`,modalityLoad:`The ${input.section} script/text burden produces ${modalityLoad.toFixed(2)}; acoustic quality is ${acousticAssessment.toLowerCase().replaceAll('_',' ')}.`,reasoningDepth:`The learner operation is classified as ${reasoningDepth}.`}};
  }
}

export class HttpDifficultyCalibrationProvider implements DifficultyCalibrationProvider{
  name='http-difficulty-calibration';model=process.env.DIFFICULTY_CALIBRATION_MODEL||'external';
  async estimate(input:DifficultyCalibrationInput):Promise<unknown>{
    const endpoint=process.env.DIFFICULTY_CALIBRATION_ENDPOINT;if(!endpoint)throw new Error('DIFFICULTY_CALIBRATION_ENDPOINT is required for the HTTP provider.');
    const response=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.DIFFICULTY_CALIBRATION_API_KEY?{authorization:`Bearer ${process.env.DIFFICULTY_CALIBRATION_API_KEY}`}:{})},body:JSON.stringify({task:'difficulty_calibration_profile',promptVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,calibrationVersion:DIFFICULTY_CALIBRATION_POLICY_V1.version,systemPrompt:DIFFICULTY_CALIBRATION_SYSTEM_PROMPT_V1,input})});
    if(!response.ok)throw new Error(`Difficulty calibration provider failed: ${response.status}`);return response.json();
  }
}

export function getDifficultyCalibrationProvider():DifficultyCalibrationProvider{return process.env.DIFFICULTY_CALIBRATION_PROVIDER==='http'?new HttpDifficultyCalibrationProvider():new MockDifficultyCalibrationProvider()}

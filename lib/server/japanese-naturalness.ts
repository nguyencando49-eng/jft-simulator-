import type {QuestionRecord} from '@/lib/admin-types';

export const JAPANESE_NATURALNESS_PROMPT_VERSION='JFT_JAPANESE_NATURALNESS_V1' as const;
export const JAPANESE_NATURALNESS_SYSTEM_PROMPT_V1=`You are an independent Japanese Naturalness Judge. Judge only whether the supplied Japanese is grammatical, natural, contextually and pragmatically appropriate, register-appropriate, and suitable for its declared spoken or written setting. Inspect the instruction, stem or passage, listening script, and every choice. Evaluate particles, collocations, word choice, politeness, keigo, conversation flow, punctuation, practical realism, and spoken-versus-written fit. Do not solve the answer, judge curriculum grounding, classify JFT categories, or rewrite the content. If naturalness and target-level simplicity conflict, report NATURALNESS_LEVEL_TENSION.

Return JSON only with this exact JFT_JAPANESE_NATURALNESS_V1 shape: {qaVersion,questionId,verdict:"PASS|REVIEW|FAIL",hardFail,confidence:"HIGH|MEDIUM|LOW",scores:{grammar,naturalness,collocation,register,contextFit,spokenWrittenFit,conversationFlow,overall},contextAssessment:{declaredContext,actualStyle:"SPOKEN|WRITTEN|MIXED",fit:"GOOD|ACCEPTABLE|POOR"},choiceLanguageAnalysis:[{index,natural,issues:[]}],issues:[{code,severity:"INFO|WARNING|MAJOR|CRITICAL",evidence,reason,suggestedAction}],release:{eligibleToProceed,requiresHumanReview,blockReason:[]}}. Analyze every choice exactly once. Score maxima are 20,20,15,15,10,10,10; overall is their exact sum. PASS is 90-100, REVIEW is 80-89 or LOW confidence, FAIL is below 80. Hard-fail codes are BROKEN_JAPANESE, MEANING_CORRUPTED_BY_LANGUAGE_ERROR, SEVERE_REGISTER_MISMATCH, UNINTELLIGIBLE_DIALOGUE, and LANGUAGE_ERROR_LEAKS_CORRECT_ANSWER; they always force FAIL. Every choice issue must also have a top-level evidence issue. Non-PASS requiresHumanReview=true. Evidence, reason, and suggestedAction must be non-empty.`;

export type NaturalnessConfidence='HIGH'|'MEDIUM'|'LOW';
export type NaturalnessSeverity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
export type NaturalnessStyle='SPOKEN'|'WRITTEN'|'MIXED';
export type NaturalnessContextFit='GOOD'|'ACCEPTABLE'|'POOR';
export type JapaneseNaturalnessIssueCode=
  'GRAMMAR_ERROR'|'BROKEN_JAPANESE'|'MEANING_CORRUPTED_BY_LANGUAGE_ERROR'|'PARTICLE_ERROR'|'PARTICLE_UNNATURAL'|
  'UNNATURAL_COLLOCATION'|'UNNATURAL_WORD_CHOICE'|'REGISTER_TOO_FORMAL'|'REGISTER_TOO_CASUAL'|'POLITENESS_MISMATCH'|
  'KEIGO_MISUSE'|'SEVERE_REGISTER_MISMATCH'|'PRAGMATIC_MISMATCH'|'WRITTEN_STYLE_IN_SPOKEN_CONTEXT'|
  'SPOKEN_STYLE_IN_WRITTEN_CONTEXT'|'ARTIFICIAL_DIALOGUE_FLOW'|'UNINTELLIGIBLE_DIALOGUE'|
  'PUNCTUATION_INCONSISTENT'|'LANGUAGE_ERROR_LEAKS_CORRECT_ANSWER'|'NATURALNESS_LEVEL_TENSION'|
  'JAPANESE_NATURALNESS_INVALID_OUTPUT'|'JAPANESE_NATURALNESS_PROVIDER_FAILURE';

export interface JapaneseNaturalnessInput {
  questionId:string;
  instruction:string;
  stem:string;
  choices:string[];
  audioScript?:string;
  declaredContext:string;
  declaredSituation:string;
  section:QuestionRecord['section'];
  category?:string;
  targetLevel:QuestionRecord['level'];
}
export interface NaturalnessScores {grammar:number;naturalness:number;collocation:number;register:number;contextFit:number;spokenWrittenFit:number;conversationFlow:number;overall:number}
export interface JapaneseNaturalnessIssue {code:JapaneseNaturalnessIssueCode;severity:NaturalnessSeverity;evidence:string;reason:string;suggestedAction:string}
export interface JapaneseNaturalnessAssessment {
  qaVersion:typeof JAPANESE_NATURALNESS_PROMPT_VERSION;
  questionId:string;
  verdict:'PASS'|'REVIEW'|'FAIL';
  hardFail:boolean;
  confidence:NaturalnessConfidence;
  scores:NaturalnessScores;
  contextAssessment:{declaredContext:string;actualStyle:NaturalnessStyle;fit:NaturalnessContextFit};
  choiceLanguageAnalysis:Array<{index:number;natural:boolean;issues:JapaneseNaturalnessIssueCode[]}>;
  issues:JapaneseNaturalnessIssue[];
  release:{eligibleToProceed:boolean;requiresHumanReview:boolean;blockReason:JapaneseNaturalnessIssueCode[]};
}
export interface JapaneseNaturalnessGateResult extends JapaneseNaturalnessAssessment {provider:string;model?:string;promptVersion:typeof JAPANESE_NATURALNESS_PROMPT_VERSION;checkedAt:string}

export class JapaneseNaturalnessError extends Error{
  constructor(public readonly code:'JAPANESE_NATURALNESS_INVALID_OUTPUT'|'JAPANESE_NATURALNESS_PROVIDER_FAILURE',message:string){super(message);this.name='JapaneseNaturalnessError'}
}

export function buildJapaneseNaturalnessInput(question:QuestionRecord,context:{audioScript?:string;category?:string;topic?:string;canDo?:string}={}):JapaneseNaturalnessInput{
  const defaultContext=question.section==='listening'?'spoken listening audio':question.section==='conversation_expression'?'spoken conversation':question.section==='reading'?'practical written material':'short Japanese item';
  return {questionId:question.id,instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(question.section==='listening'&&context.audioScript?.trim()?{audioScript:context.audioScript}:{}),declaredContext:[defaultContext,context.category].filter(Boolean).join(' / '),declaredSituation:[context.topic,context.canDo].filter(Boolean).join(' / ')||'unspecified everyday situation',section:question.section,...(context.category?{category:context.category}:{}),targetLevel:question.level};
}

const maxScores:Record<keyof Omit<NaturalnessScores,'overall'>,number>={grammar:20,naturalness:20,collocation:15,register:15,contextFit:10,spokenWrittenFit:10,conversationFlow:10};
const confidenceValues=new Set<NaturalnessConfidence>(['HIGH','MEDIUM','LOW']);
const styles=new Set<NaturalnessStyle>(['SPOKEN','WRITTEN','MIXED']);
const fits=new Set<NaturalnessContextFit>(['GOOD','ACCEPTABLE','POOR']);
const severities=new Set<NaturalnessSeverity>(['INFO','WARNING','MAJOR','CRITICAL']);
const knownIssueCodes=new Set<JapaneseNaturalnessIssueCode>(['GRAMMAR_ERROR','BROKEN_JAPANESE','MEANING_CORRUPTED_BY_LANGUAGE_ERROR','PARTICLE_ERROR','PARTICLE_UNNATURAL','UNNATURAL_COLLOCATION','UNNATURAL_WORD_CHOICE','REGISTER_TOO_FORMAL','REGISTER_TOO_CASUAL','POLITENESS_MISMATCH','KEIGO_MISUSE','SEVERE_REGISTER_MISMATCH','PRAGMATIC_MISMATCH','WRITTEN_STYLE_IN_SPOKEN_CONTEXT','SPOKEN_STYLE_IN_WRITTEN_CONTEXT','ARTIFICIAL_DIALOGUE_FLOW','UNINTELLIGIBLE_DIALOGUE','PUNCTUATION_INCONSISTENT','LANGUAGE_ERROR_LEAKS_CORRECT_ANSWER','NATURALNESS_LEVEL_TENSION','JAPANESE_NATURALNESS_INVALID_OUTPUT','JAPANESE_NATURALNESS_PROVIDER_FAILURE']);
const hardFailCodes=new Set<JapaneseNaturalnessIssueCode>(['BROKEN_JAPANESE','MEANING_CORRUPTED_BY_LANGUAGE_ERROR','SEVERE_REGISTER_MISMATCH','UNINTELLIGIBLE_DIALOGUE','LANGUAGE_ERROR_LEAKS_CORRECT_ANSWER']);

export function finalizeJapaneseNaturalnessAssessment(value:Omit<JapaneseNaturalnessAssessment,'verdict'|'hardFail'|'release'>):JapaneseNaturalnessAssessment{
  const blockReason=[...value.issues.map(issue=>issue.code),...value.choiceLanguageAnalysis.flatMap(choice=>choice.issues)].filter(code=>hardFailCodes.has(code));
  const hardFail=blockReason.length>0;
  const verdict:'PASS'|'REVIEW'|'FAIL'=hardFail||value.scores.overall<80?'FAIL':value.scores.overall<90||value.confidence==='LOW'?'REVIEW':'PASS';
  return {...value,verdict,hardFail,release:{eligibleToProceed:verdict==='PASS',requiresHumanReview:verdict!=='PASS',blockReason:Array.from(new Set(blockReason))}};
}

export function validateJapaneseNaturalnessOutput(value:unknown,input:JapaneseNaturalnessInput):JapaneseNaturalnessAssessment{
  const fail=(message:string):never=>{throw new JapaneseNaturalnessError('JAPANESE_NATURALNESS_INVALID_OUTPUT',message)};
  if(!value||typeof value!=='object'||Array.isArray(value))fail('Naturalness output must be an object.');
  const v=value as Record<string,unknown>;
  if(v.qaVersion!==JAPANESE_NATURALNESS_PROMPT_VERSION||v.questionId!==input.questionId)fail('QA version or questionId is invalid.');
  if(!confidenceValues.has(v.confidence as NaturalnessConfidence))fail('confidence is invalid.');
  if(!v.scores||typeof v.scores!=='object'||Array.isArray(v.scores))fail('scores are required.');
  const rawScores=v.scores as Record<string,unknown>;const scores={} as NaturalnessScores;let total=0;
  for(const [key,max] of Object.entries(maxScores) as Array<[keyof typeof maxScores,number]>){const score=rawScores[key];if(typeof score!=='number'||!Number.isFinite(score)||score<0||score>max)fail(`${key} score is invalid.`);scores[key]=score as number;total+=score as number;}
  if(typeof rawScores.overall!=='number'||rawScores.overall!==total)fail('overall must equal the dimension score total.');scores.overall=total;
  if(!v.contextAssessment||typeof v.contextAssessment!=='object'||Array.isArray(v.contextAssessment))fail('contextAssessment is required.');
  const context=v.contextAssessment as Record<string,unknown>;
  if(typeof context.declaredContext!=='string'||!styles.has(context.actualStyle as NaturalnessStyle)||!fits.has(context.fit as NaturalnessContextFit))fail('contextAssessment is invalid.');
  if(!Array.isArray(v.choiceLanguageAnalysis)||v.choiceLanguageAnalysis.length!==input.choices.length)fail('Every choice must be evaluated.');
  const choices=(v.choiceLanguageAnalysis as unknown[]).map((raw,i)=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail(`choiceLanguageAnalysis[${i}] is invalid.`);const x=raw as Record<string,unknown>;if(!Number.isInteger(x.index)||Number(x.index)<0||Number(x.index)>=input.choices.length||typeof x.natural!=='boolean'||!Array.isArray(x.issues)||x.issues.some(code=>!knownIssueCodes.has(code as JapaneseNaturalnessIssueCode))||x.natural!==(x.issues.length===0))return fail(`choiceLanguageAnalysis[${i}] is invalid.`);return {index:Number(x.index),natural:x.natural as boolean,issues:[...(x.issues as JapaneseNaturalnessIssueCode[])]};});
  if(new Set(choices.map(choice=>choice.index)).size!==input.choices.length)fail('Choice indexes must be unique and complete.');
  if(!Array.isArray(v.issues))fail('issues must be an array.');
  const issues=(v.issues as unknown[]).map((raw,i)=>{if(!raw||typeof raw!=='object'||Array.isArray(raw))return fail(`issues[${i}] is invalid.`);const x=raw as Record<string,unknown>;if(!knownIssueCodes.has(x.code as JapaneseNaturalnessIssueCode)||!severities.has(x.severity as NaturalnessSeverity)||typeof x.evidence!=='string'||!x.evidence.trim()||typeof x.reason!=='string'||!x.reason.trim()||typeof x.suggestedAction!=='string'||!x.suggestedAction.trim())return fail(`issues[${i}] is invalid.`);return {code:x.code as JapaneseNaturalnessIssueCode,severity:x.severity as NaturalnessSeverity,evidence:x.evidence,reason:x.reason,suggestedAction:x.suggestedAction};});
  const topLevelCodes=new Set(issues.map(issue=>issue.code));
  if(choices.some(choice=>choice.issues.some(code=>!topLevelCodes.has(code))))fail('Every choice issue requires corresponding top-level evidence.');
  if(total<100&&issues.length===0)fail('A reduced score requires actionable issue evidence.');
  const normalized=finalizeJapaneseNaturalnessAssessment({qaVersion:JAPANESE_NATURALNESS_PROMPT_VERSION,questionId:input.questionId,confidence:v.confidence as NaturalnessConfidence,scores,contextAssessment:{declaredContext:context.declaredContext as string,actualStyle:context.actualStyle as NaturalnessStyle,fit:context.fit as NaturalnessContextFit},choiceLanguageAnalysis:choices,issues});
  if(v.verdict!==normalized.verdict||v.hardFail!==normalized.hardFail||!v.release||typeof v.release!=='object'||Array.isArray(v.release))fail('Verdict or release state is inconsistent with validated evidence.');
  const release=v.release as Record<string,unknown>;
  if(release.eligibleToProceed!==normalized.release.eligibleToProceed||release.requiresHumanReview!==normalized.release.requiresHumanReview||!Array.isArray(release.blockReason)||release.blockReason.some(code=>!knownIssueCodes.has(code as JapaneseNaturalnessIssueCode))||JSON.stringify(release.blockReason)!==JSON.stringify(normalized.release.blockReason))fail('release is inconsistent with validated evidence.');
  return normalized;
}

export function withJapaneseNaturalnessAudit(result:JapaneseNaturalnessAssessment,metadata:{provider:string;model?:string;checkedAt?:string}):JapaneseNaturalnessGateResult{return {...result,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:JAPANESE_NATURALNESS_PROMPT_VERSION,checkedAt:metadata.checkedAt||new Date().toISOString()}}

export function technicalJapaneseNaturalnessResult(input:JapaneseNaturalnessInput,code:'JAPANESE_NATURALNESS_INVALID_OUTPUT'|'JAPANESE_NATURALNESS_PROVIDER_FAILURE',provider:string,model?:string):JapaneseNaturalnessGateResult{
  return {qaVersion:JAPANESE_NATURALNESS_PROMPT_VERSION,questionId:input.questionId,verdict:'REVIEW',hardFail:false,confidence:'LOW',scores:{grammar:0,naturalness:0,collocation:0,register:0,contextFit:0,spokenWrittenFit:0,conversationFlow:0,overall:0},contextAssessment:{declaredContext:input.declaredContext,actualStyle:'MIXED',fit:'POOR'},choiceLanguageAnalysis:input.choices.map((_,index)=>({index,natural:false,issues:[code]})),issues:[{code,severity:'MAJOR',evidence:'Provider evidence unavailable.',reason:code,suggestedAction:'Require human Japanese-language review or retry the independent provider.'}],release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:[code]},provider,...(model?{model}:{}),promptVersion:JAPANESE_NATURALNESS_PROMPT_VERSION,checkedAt:new Date().toISOString()};
}

import {createHash} from 'node:crypto';
import type {QuestionRecord} from '@/lib/admin-types';
import type {QuestionPerformanceAggregate} from './question-performance';
import {emptyQuestionPerformance,QUESTION_PERFORMANCE_POLICY_V1} from './question-performance';

export const DIFFICULTY_CALIBRATION_PROMPT_VERSION='JFT_DIFFICULTY_CALIBRATION_V1' as const;
export const DIFFICULTY_CALIBRATION_POLICY_V1={
  version:'DIFFICULTY_CALIBRATION_V1',
  weights:{linguisticComplexity:.23,cognitiveComplexity:.20,processingLoad:.17,distractorCompetitiveness:.16,informationDensity:.12,modalityLoad:.12},
  reasoningAdjustment:{DIRECT_RECALL:-.05,DIRECT_MATCH:-.03,SINGLE_STEP_COMPREHENSION:0,MULTI_STEP_COMPREHENSION:.04,SIMPLE_INFERENCE:.05,MULTI_FACTOR_INFERENCE:.10},
  levelBoundaries:{a1Maximum:.34,a2_1Maximum:.66},
  adjacentMismatch:'REVIEW',
  extremeMismatch:'HARD_FAIL',
  mixedSignalSpread:.65,
  calibrationDisagreementDelta:.35,
  unexpectedlyLowCorrectRate:.25,
  unexpectedlyHighCorrectRate:.90,
  empirical:QUESTION_PERFORMANCE_POLICY_V1,
} as const;

export const DIFFICULTY_CALIBRATION_SYSTEM_PROMPT_V1=`You are QA6, an independent Difficulty Calibration Judge. Estimate the effective difficulty of the complete learner task, never from vocabulary or length alone. Evaluate linguistic complexity, cognitive complexity, processing load, distractor competitiveness, information density, and modality load. Consider inference depth, contextual familiarity, memory burden, competing facts, option similarity, and the actual learner operation. For Listening, evaluate only script-semantic load unless acoustic metadata is supplied; never claim pronunciation or audio speed was assessed from text. For Reading, distinguish search/inference burden from raw passage length. Do not judge correctness, naturalness, curriculum grounding, JFT alignment, originality, or rewrite the item.

Return JSON only with exactly this analysis-only shape:
{"qaVersion":"JFT_DIFFICULTY_CALIBRATION_V1","questionId":"...","confidence":"HIGH|MEDIUM|LOW","profile":{"linguisticComplexity":0,"cognitiveComplexity":0,"processingLoad":0,"distractorCompetitiveness":0,"informationDensity":0,"modalityLoad":0},"reasoningDepth":"DIRECT_RECALL|DIRECT_MATCH|SINGLE_STEP_COMPREHENSION|MULTI_STEP_COMPREHENSION|SIMPLE_INFERENCE|MULTI_FACTOR_INFERENCE","distractorStrength":"WEAK|MODERATE|STRONG","acousticAssessment":"ASSESSED|NOT_ASSESSED|NOT_APPLICABLE","evidence":{"linguisticComplexity":"...","cognitiveComplexity":"...","processingLoad":"...","distractorCompetitiveness":"...","informationDensity":"...","modalityLoad":"...","reasoningDepth":"..."}}.

Every profile value must be between 0 and 1. Analyze every choice when judging distractors. Do not include or infer the declared target level, verdict, release decision, empirical result, answer key, explanation, QA1-QA5 evidence, or replacement content.`;

export type DifficultyConfidence='HIGH'|'MEDIUM'|'LOW';
export type DifficultyReasoningDepth='DIRECT_RECALL'|'DIRECT_MATCH'|'SINGLE_STEP_COMPREHENSION'|'MULTI_STEP_COMPREHENSION'|'SIMPLE_INFERENCE'|'MULTI_FACTOR_INFERENCE';
export type DistractorStrength='WEAK'|'MODERATE'|'STRONG';
export type AcousticAssessment='ASSESSED'|'NOT_ASSESSED'|'NOT_APPLICABLE';
export type DifficultyLevelMatch='MATCH'|'SLIGHTLY_EASIER'|'TOO_EASY'|'SLIGHTLY_HARDER'|'TOO_HARD';
export type CalibrationSource='CONTENT_ESTIMATE'|'EMPIRICAL'|'HYBRID';
export type CalibrationStatus='UNVALIDATED'|'CONTENT_ESTIMATED'|'DATA_PENDING'|'EMPIRICAL_REVIEW'|'CALIBRATED'|'REVIEW_REQUIRED';
export type DifficultyVerdict='PASS'|'REVIEW'|'FAIL';
export type DifficultyIssueSeverity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
export type DifficultyIssueCode='LEVEL_SLIGHTLY_EASIER'|'LEVEL_SLIGHTLY_HARDER'|'EXTREME_LEVEL_MISMATCH'|'LOW_CONFIDENCE'|'MIXED_DIFFICULTY_SIGNAL'|'ACOUSTIC_DIFFICULTY_NOT_ASSESSED'|'DIFFICULTY_EVIDENCE_MISSING'|'EMPIRICAL_DATA_INSUFFICIENT'|'CALIBRATION_DISAGREEMENT'|'DIFFICULTY_REVIEW_REQUIRED'|'DIFFICULTY_CALIBRATION_INVALID_OUTPUT'|'DIFFICULTY_CALIBRATION_PROVIDER_FAILURE';

export interface DifficultyProfile {
  linguisticComplexity:number;
  cognitiveComplexity:number;
  processingLoad:number;
  distractorCompetitiveness:number;
  informationDensity:number;
  modalityLoad:number;
}

export interface DifficultyCalibrationInput {
  questionId:string;
  instruction:string;
  stem:string;
  choices:string[];
  section:QuestionRecord['section'];
  category?:string;
  audioScript?:string;
  audioEvidence?:{available:boolean;durationMs?:number;speechRateWpm?:number};
  calibrationVersion:string;
  rubric:{dimensions:string[];levelMapping:'APPLICATION_DETERMINISTIC';acousticRule:string};
}

export interface DifficultyCalibrationAnalysis {
  qaVersion:typeof DIFFICULTY_CALIBRATION_PROMPT_VERSION;
  questionId:string;
  confidence:DifficultyConfidence;
  profile:DifficultyProfile;
  reasoningDepth:DifficultyReasoningDepth;
  distractorStrength:DistractorStrength;
  acousticAssessment:AcousticAssessment;
  evidence:Record<keyof DifficultyProfile| 'reasoningDepth',string>;
}

export interface DifficultyIssue {code:DifficultyIssueCode;severity:DifficultyIssueSeverity;evidence:string;reason:string;suggestedAction:string}

export interface DifficultyCalibrationResult {
  qaVersion:typeof DIFFICULTY_CALIBRATION_PROMPT_VERSION;
  questionId:string;
  verdict:DifficultyVerdict;
  hardFail:boolean;
  confidence:DifficultyConfidence;
  declaredLevel:QuestionRecord['level'];
  estimatedLevel:QuestionRecord['level'];
  levelMatch:DifficultyLevelMatch;
  difficultyScore:number;
  calibrationSource:CalibrationSource;
  calibrationStatus:CalibrationStatus;
  profile:DifficultyProfile;
  reasoningDepth:DifficultyReasoningDepth;
  distractorStrength:DistractorStrength;
  empirical:{available:boolean;attemptCount:number;correctCount:number;incorrectCount:number;correctRate:number|null;medianResponseTimeMs:number|null;averageResponseTimeMs:number|null;responseTimeSampleCount:number;sufficientSample:boolean;strongSample:boolean;discriminationIndex:number|null;policyVersion:string};
  issues:DifficultyIssue[];
  release:{eligibleToProceed:boolean;requiresHumanReview:boolean;blockReason:string[]};
}

export interface DifficultyCalibrationGateResult extends DifficultyCalibrationResult {
  provider:string;
  model?:string;
  promptVersion:string;
  calibrationVersion:string;
  checkedAt:string;
  reviewBindingFingerprint?:string;
}

export class DifficultyCalibrationError extends Error {constructor(public code:'DIFFICULTY_CALIBRATION_INVALID_OUTPUT',message:string){super(message)}}

const profileKeys=['linguisticComplexity','cognitiveComplexity','processingLoad','distractorCompetitiveness','informationDensity','modalityLoad'] as const;
const evidenceKeys=[...profileKeys,'reasoningDepth'] as const;
const confidences=new Set<unknown>(['HIGH','MEDIUM','LOW']);
const reasoningDepths=new Set<unknown>(['DIRECT_RECALL','DIRECT_MATCH','SINGLE_STEP_COMPREHENSION','MULTI_STEP_COMPREHENSION','SIMPLE_INFERENCE','MULTI_FACTOR_INFERENCE']);
const distractorStrengths=new Set<unknown>(['WEAK','MODERATE','STRONG']);
const acousticAssessments=new Set<unknown>(['ASSESSED','NOT_ASSESSED','NOT_APPLICABLE']);
const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
function exactKeys(value:Record<string,unknown>,keys:readonly string[]){return Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key))}
const nonEmpty=(value:unknown)=>typeof value==='string'&&value.trim().length>0&&value.length<=1000;
const opaqueQuestionId=(question:QuestionRecord,audioScript?:string)=>`QA6-${createHash('sha256').update(JSON.stringify([question.instruction,question.prompt,question.choices,audioScript||'',question.section])).digest('hex').slice(0,16)}`;

export function buildDifficultyCalibrationInput(question:QuestionRecord,context:{category?:string;audioScript?:string;audioEvidence?:DifficultyCalibrationInput['audioEvidence']}={}):DifficultyCalibrationInput{
  return {questionId:opaqueQuestionId(question,context.audioScript),instruction:question.instruction,stem:question.prompt,choices:[...question.choices],section:question.section,...(context.category?{category:context.category}:{}),...(question.section==='listening'&&context.audioScript?.trim()?{audioScript:context.audioScript}:{}),...(context.audioEvidence?{audioEvidence:{...context.audioEvidence}}:{}),calibrationVersion:DIFFICULTY_CALIBRATION_POLICY_V1.version,rubric:{dimensions:[...profileKeys],levelMapping:'APPLICATION_DETERMINISTIC',acousticRule:'Script evidence cannot certify acoustic speed, pronunciation, or recording quality.'}};
}

export function validateDifficultyCalibrationAnalysis(value:unknown,input:DifficultyCalibrationInput):DifficultyCalibrationAnalysis{
  const fail=(message:string):never=>{throw new DifficultyCalibrationError('DIFFICULTY_CALIBRATION_INVALID_OUTPUT',message)};
  if(!isObject(value)||!exactKeys(value,['qaVersion','questionId','confidence','profile','reasoningDepth','distractorStrength','acousticAssessment','evidence']))fail('Provider output must match the analysis-only contract exactly.');
  const root=value as Record<string,unknown>;
  if(root.qaVersion!==DIFFICULTY_CALIBRATION_PROMPT_VERSION||root.questionId!==input.questionId)fail('Provider output version or question id does not match the request.');
  if(!confidences.has(root.confidence)||!reasoningDepths.has(root.reasoningDepth)||!distractorStrengths.has(root.distractorStrength)||!acousticAssessments.has(root.acousticAssessment))fail('Provider output contains an invalid enum.');
  const profile=root.profile;if(!isObject(profile)||!exactKeys(profile,profileKeys)||!profileKeys.every(key=>typeof profile[key]==='number'&&Number.isFinite(profile[key])&&(profile[key] as number)>=0&&(profile[key] as number)<=1))fail('Every difficulty dimension must be a finite number from 0 to 1.');
  const evidence=root.evidence;if(!isObject(evidence)||!exactKeys(evidence,evidenceKeys)||!evidenceKeys.every(key=>nonEmpty(evidence[key])))fail('Every difficulty dimension requires concise evidence.');
  if(root.acousticAssessment==='ASSESSED'&&(!input.audioEvidence?.available||(!Number.isFinite(input.audioEvidence.durationMs)&&!Number.isFinite(input.audioEvidence.speechRateWpm))))fail('Acoustic difficulty cannot be assessed without acoustic metadata.');
  if(input.section!=='listening'&&root.acousticAssessment!=='NOT_APPLICABLE')fail('Non-Listening items must mark acoustic assessment not applicable.');
  return root as unknown as DifficultyCalibrationAnalysis;
}

const clamp=(value:number)=>Math.max(0,Math.min(1,value));
const rounded=(value:number,places=4)=>Number(value.toFixed(places));
export function calculateDifficultyScore(profile:DifficultyProfile,reasoningDepth:DifficultyReasoningDepth,policy=DIFFICULTY_CALIBRATION_POLICY_V1){
  const weighted=profileKeys.reduce((sum,key)=>sum+profile[key]*policy.weights[key],0);
  return rounded(clamp(weighted+policy.reasoningAdjustment[reasoningDepth]));
}
export function estimatedLevelForDifficulty(score:number,policy=DIFFICULTY_CALIBRATION_POLICY_V1):QuestionRecord['level']{
  if(score<=policy.levelBoundaries.a1Maximum)return 'A1';
  if(score<=policy.levelBoundaries.a2_1Maximum)return 'A2.1';
  return 'A2.2';
}
const levelRank:Record<QuestionRecord['level'],number>={A1:0,'A2.1':1,'A2.2':2};
export function compareDifficultyLevel(declared:QuestionRecord['level'],estimated:QuestionRecord['level']):DifficultyLevelMatch{
  const delta=levelRank[estimated]-levelRank[declared];
  if(delta===0)return 'MATCH';if(delta===1)return 'SLIGHTLY_HARDER';if(delta===-1)return 'SLIGHTLY_EASIER';if(delta>1)return 'TOO_HARD';return 'TOO_EASY';
}

function issue(code:DifficultyIssueCode,severity:DifficultyIssueSeverity,evidence:string,reason:string,suggestedAction='Review the expected level and difficulty evidence; do not relabel automatically.'):DifficultyIssue{return {code,severity,evidence,reason,suggestedAction}}
function empiricalView(value:QuestionPerformanceAggregate){return {available:value.attemptCount>0,attemptCount:value.attemptCount,correctCount:value.correctCount,incorrectCount:value.incorrectCount,correctRate:value.correctRate,medianResponseTimeMs:value.medianResponseTimeMs,averageResponseTimeMs:value.averageResponseTimeMs,responseTimeSampleCount:value.responseTimeSampleCount,sufficientSample:value.sufficientSample,strongSample:value.strongSample,discriminationIndex:value.discriminationIndex,policyVersion:value.policyVersion}}

export function finalizeDifficultyCalibration(analysis:DifficultyCalibrationAnalysis,declaredLevel:QuestionRecord['level'],input:DifficultyCalibrationInput,performance:QuestionPerformanceAggregate=emptyQuestionPerformance(input.questionId),persistedQuestionId=input.questionId):DifficultyCalibrationResult{
  const difficultyScore=calculateDifficultyScore(analysis.profile,analysis.reasoningDepth);const estimatedLevel=estimatedLevelForDifficulty(difficultyScore);const levelMatch=compareDifficultyLevel(declaredLevel,estimatedLevel);
  const issues:DifficultyIssue[]=[];const add=(entry:DifficultyIssue)=>{if(!issues.some(item=>item.code===entry.code&&item.evidence===entry.evidence))issues.push(entry)};
  if(levelMatch==='SLIGHTLY_EASIER')add(issue('LEVEL_SLIGHTLY_EASIER','MAJOR',`${declaredLevel} declared; ${estimatedLevel} estimated at ${difficultyScore}.`,'The content estimate is one canonical level easier than declared.'));
  if(levelMatch==='SLIGHTLY_HARDER')add(issue('LEVEL_SLIGHTLY_HARDER','MAJOR',`${declaredLevel} declared; ${estimatedLevel} estimated at ${difficultyScore}.`,'The content estimate is one canonical level harder than declared.'));
  if(levelMatch==='TOO_EASY'||levelMatch==='TOO_HARD')add(issue('EXTREME_LEVEL_MISMATCH','CRITICAL',`${declaredLevel} declared; ${estimatedLevel} estimated at ${difficultyScore}.`,'The declared and estimated levels are separated by two canonical levels.'));
  if(analysis.confidence==='LOW')add(issue('LOW_CONFIDENCE','MAJOR','Difficulty estimate confidence is LOW.','Low-confidence difficulty evidence cannot pass automatically.'));
  const values=profileKeys.map(key=>analysis.profile[key]);if(Math.max(...values)-Math.min(...values)>=DIFFICULTY_CALIBRATION_POLICY_V1.mixedSignalSpread)add(issue('MIXED_DIFFICULTY_SIGNAL','WARNING',`Profile range ${rounded(Math.min(...values),2)}–${rounded(Math.max(...values),2)}.`,'Difficulty dimensions disagree strongly and require human interpretation.'));
  if(input.section==='listening'&&analysis.acousticAssessment!=='ASSESSED')add(issue('ACOUSTIC_DIFFICULTY_NOT_ASSESSED','WARNING',analysis.evidence.modalityLoad,'Script-semantic load was estimated, but actual speech rate, pronunciation, and recording quality were not assessed.','Review actual audio in the dedicated audio workflow before treating difficulty as fully calibrated.'));
  if(input.section==='listening'&&!input.audioScript?.trim())add(issue('DIFFICULTY_EVIDENCE_MISSING','MAJOR','No Listening script was supplied to QA6.','Listening processing and information load cannot be estimated from learner-visible text alone.'));
  if(performance.attemptCount>0&&!performance.sufficientSample)add(issue('EMPIRICAL_DATA_INSUFFICIENT','INFO',`${performance.attemptCount}/${DIFFICULTY_CALIBRATION_POLICY_V1.empirical.minimumAttempts} submitted attempts.`,'The sample is retained for later aggregation but cannot alter the content-based judgment.','Collect more valid attempts; do not infer item difficulty from the current sample.'));
  if(performance.sufficientSample&&performance.correctRate!==null){
    const empiricalDifficulty=1-performance.correctRate;const disagreement=Math.abs(empiricalDifficulty-difficultyScore);
    if(disagreement>=DIFFICULTY_CALIBRATION_POLICY_V1.calibrationDisagreementDelta)add(issue('CALIBRATION_DISAGREEMENT','MAJOR',`Content score ${difficultyScore}; empirical difficulty ${rounded(empiricalDifficulty)} from ${performance.attemptCount} attempts.`,'Content and empirical signals disagree; response performance may reflect difficulty or another item defect.'));
    if(performance.correctRate<=DIFFICULTY_CALIBRATION_POLICY_V1.unexpectedlyLowCorrectRate||performance.correctRate>=DIFFICULTY_CALIBRATION_POLICY_V1.unexpectedlyHighCorrectRate)add(issue('DIFFICULTY_REVIEW_REQUIRED','MAJOR',`Correct rate ${rounded(performance.correctRate*100,1)}% across ${performance.attemptCount} attempts.`,'An extreme correct rate is a review signal, not authority to relabel the item.','Compare QA2–QA5 evidence and human review before changing expected difficulty.'));
  }
  const hardFail=issues.some(item=>item.code==='EXTREME_LEVEL_MISMATCH');
  const reviewCodes=new Set<DifficultyIssueCode>(['LEVEL_SLIGHTLY_EASIER','LEVEL_SLIGHTLY_HARDER','LOW_CONFIDENCE','MIXED_DIFFICULTY_SIGNAL','ACOUSTIC_DIFFICULTY_NOT_ASSESSED','DIFFICULTY_EVIDENCE_MISSING','CALIBRATION_DISAGREEMENT','DIFFICULTY_REVIEW_REQUIRED']);
  const requiresReview=!hardFail&&issues.some(item=>reviewCodes.has(item.code));const verdict:DifficultyVerdict=hardFail?'FAIL':requiresReview?'REVIEW':'PASS';
  const calibrationSource:CalibrationSource=performance.sufficientSample?'HYBRID':'CONTENT_ESTIMATE';
  const calibrationStatus:CalibrationStatus=verdict!=='PASS'?(performance.sufficientSample?'EMPIRICAL_REVIEW':'REVIEW_REQUIRED'):performance.sufficientSample?'DATA_PENDING':performance.attemptCount?'DATA_PENDING':'CONTENT_ESTIMATED';
  return {qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:persistedQuestionId,verdict,hardFail,confidence:analysis.confidence,declaredLevel,estimatedLevel,levelMatch,difficultyScore,calibrationSource,calibrationStatus,profile:{...analysis.profile},reasoningDepth:analysis.reasoningDepth,distractorStrength:analysis.distractorStrength,empirical:empiricalView(performance),issues,release:{eligibleToProceed:verdict==='PASS',requiresHumanReview:verdict!=='PASS',blockReason:issues.filter(item=>item.severity==='MAJOR'||item.severity==='CRITICAL').map(item=>item.code)}};
}

export function withDifficultyCalibrationAudit(result:DifficultyCalibrationResult,metadata:{provider:string;model?:string}):DifficultyCalibrationGateResult{return {...result,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,calibrationVersion:DIFFICULTY_CALIBRATION_POLICY_V1.version,checkedAt:new Date().toISOString()}}

export function technicalDifficultyCalibrationResult(input:DifficultyCalibrationInput,declaredLevel:QuestionRecord['level'],code:'DIFFICULTY_CALIBRATION_INVALID_OUTPUT'|'DIFFICULTY_CALIBRATION_PROVIDER_FAILURE',provider:string,model?:string,persistedQuestionId=input.questionId):DifficultyCalibrationGateResult{
  const evidence=code==='DIFFICULTY_CALIBRATION_INVALID_OUTPUT'?'Provider output failed strict schema validation.':'The difficulty provider could not complete the request.';
  const base:DifficultyCalibrationResult={qaVersion:DIFFICULTY_CALIBRATION_PROMPT_VERSION,questionId:persistedQuestionId,verdict:'REVIEW',hardFail:false,confidence:'LOW',declaredLevel,estimatedLevel:declaredLevel,levelMatch:'MATCH',difficultyScore:0,calibrationSource:'CONTENT_ESTIMATE',calibrationStatus:'UNVALIDATED',profile:{linguisticComplexity:0,cognitiveComplexity:0,processingLoad:0,distractorCompetitiveness:0,informationDensity:0,modalityLoad:0},reasoningDepth:'DIRECT_MATCH',distractorStrength:'WEAK',empirical:empiricalView(emptyQuestionPerformance(persistedQuestionId)),issues:[issue(code,'MAJOR',evidence,'Technical failure cannot become a calibration PASS.','Retry QA6 or route the item to human review.')],release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:[code]}};
  return withDifficultyCalibrationAudit(base,{provider,model});
}

export function bindDifficultyReviewEvidence(value:DifficultyCalibrationGateResult,input:DifficultyCalibrationInput,declaredLevel:QuestionRecord['level']){
  if(value.verdict!=='REVIEW')return value;
  value.reviewBindingFingerprint=createHash('sha256').update(JSON.stringify({learnerVisible:input,declaredLevel,promptVersion:value.promptVersion,calibrationVersion:value.calibrationVersion})).digest('hex');return value;
}
export function difficultyReviewFingerprint(value:DifficultyCalibrationGateResult){const {checkedAt,...stable}=value;void checkedAt;return JSON.stringify(stable)}

export function summarizeDifficultyCalibrationMetrics(results:DifficultyCalibrationGateResult[]){
  const technical=(result:DifficultyCalibrationGateResult)=>result.issues.some(issue=>issue.code==='DIFFICULTY_CALIBRATION_INVALID_OUTPUT'||issue.code==='DIFFICULTY_CALIBRATION_PROVIDER_FAILURE');
  const evaluable=results.filter(result=>!technical(result));const rate=(count:number,total:number)=>total?count/total:null;
  const mismatch=evaluable.filter(result=>result.levelMatch!=='MATCH').length;const review=results.filter(result=>result.verdict==='REVIEW').length;const empirical=evaluable.filter(result=>result.empirical.sufficientSample).length;
  const unexpectedlyEasy=evaluable.filter(result=>result.issues.some(issue=>issue.code==='DIFFICULTY_REVIEW_REQUIRED')&&result.empirical.correctRate!==null&&result.empirical.correctRate>=DIFFICULTY_CALIBRATION_POLICY_V1.unexpectedlyHighCorrectRate).length;
  const unexpectedlyHard=evaluable.filter(result=>result.issues.some(issue=>issue.code==='DIFFICULTY_REVIEW_REQUIRED')&&result.empirical.correctRate!==null&&result.empirical.correctRate<=DIFFICULTY_CALIBRATION_POLICY_V1.unexpectedlyLowCorrectRate).length;
  return {difficultySampleCount:results.length,difficultyEvaluableSampleCount:evaluable.length,difficultyTechnicalReviewCount:results.length-evaluable.length,declaredVsEstimatedMismatchRate:rate(mismatch,evaluable.length),difficultyReviewRate:rate(review,results.length),empiricalCalibrationCoverage:rate(empirical,evaluable.length),unexpectedlyEasyRate:rate(unexpectedlyEasy,evaluable.length),unexpectedlyHardRate:rate(unexpectedlyHard,evaluable.length),questionsByEstimatedLevel:{A1:evaluable.filter(result=>result.estimatedLevel==='A1').length,'A2.1':evaluable.filter(result=>result.estimatedLevel==='A2.1').length,'A2.2':evaluable.filter(result=>result.estimatedLevel==='A2.2').length}};
}

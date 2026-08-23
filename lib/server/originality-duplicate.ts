import {createHash} from 'node:crypto';
import type {QuestionRecord} from '@/lib/admin-types';

export const ORIGINALITY_DUPLICATE_PROMPT_VERSION='JFT_ORIGINALITY_DUPLICATE_V1' as const;
export const ORIGINALITY_DUPLICATE_POLICY_V1={
  version:'ORIGINALITY_DUPLICATE_POLICY_V1',
  algorithmVersion:'NORMALIZED_TRIGRAM_JACCARD_PATTERN_V1',
  semanticComparisonLimit:30,
  thresholds:{
    sourceHard:.88,sourceReview:.72,
    duplicateHard:.9,duplicateReview:.76,
    patternHard:.94,patternReview:.82,
    containmentHard:.94,containmentReview:.86,
  },
} as const;

export type OriginalityComparisonKind='SOURCE'|'BATCH'|'BANK';
export type OriginalitySemanticRisk='NONE'|'LOW'|'MEDIUM'|'HIGH';
export type OriginalityRelationship='DISTINCT'|'SHARED_KNOWLEDGE'|'NEAR_DUPLICATE'|'SOURCE_COPY';
export type OriginalityConfidence='HIGH'|'MEDIUM'|'LOW';
export type OriginalityVerdict='PASS'|'REVIEW'|'FAIL';
export type OriginalityIssueSeverity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
export type OriginalityIssueCode='SOURCE_COPY_CONFIRMED'|'SOURCE_COPY_RISK'|'EXACT_DUPLICATE'|'NEAR_DUPLICATE_HIGH'|'DUPLICATE_RISK'|'SOURCE_EVIDENCE_MISSING'|'LOW_CONFIDENCE'|'ORIGINALITY_DUPLICATE_INVALID_OUTPUT'|'ORIGINALITY_DUPLICATE_PROVIDER_FAILURE';

export interface OriginalityCorpusItem {id:string;kind:OriginalityComparisonKind;text:string}
export interface OriginalityComparisonInput {
  id:string;kind:OriginalityComparisonKind;text:string;
  exactNormalized:boolean;ngramSimilarity:number;patternSimilarity:number;containmentSimilarity:number;
}
export interface OriginalityDuplicateInput {
  questionId:string;
  candidate:{instruction:string;stem:string;choices:string[];audioScript?:string};
  comparisons:OriginalityComparisonInput[];
  sourceExpected:boolean;
  corpusCounts:Record<OriginalityComparisonKind,number>;
  policyVersion:string;
  algorithmVersion:string;
}
export interface OriginalityRelationshipAnalysis {comparisonId:string;kind:OriginalityComparisonKind;semanticRisk:OriginalitySemanticRisk;relationship:OriginalityRelationship;evidence:string}
export interface OriginalityDuplicateAnalysis {qaVersion:typeof ORIGINALITY_DUPLICATE_PROMPT_VERSION;questionId:string;confidence:OriginalityConfidence;relationships:OriginalityRelationshipAnalysis[]}
export interface OriginalityComparisonResult extends Omit<OriginalityComparisonInput,'text'> {semanticRisk:OriginalitySemanticRisk;relationship:OriginalityRelationship;evidence:string}
export interface OriginalityIssue {code:OriginalityIssueCode;severity:OriginalityIssueSeverity;evidence:string;reason:string;suggestedAction:string}
export interface OriginalityDuplicateResult {
  qaVersion:typeof ORIGINALITY_DUPLICATE_PROMPT_VERSION;
  questionId:string;
  verdict:OriginalityVerdict;
  hardFail:boolean;
  confidence:OriginalityConfidence;
  policyVersion:string;
  algorithmVersion:string;
  candidateFingerprint:string;
  summary:{sourceCopyRisk:OriginalitySemanticRisk;batchDuplicateRisk:OriginalitySemanticRisk;bankDuplicateRisk:OriginalitySemanticRisk;maxSourceSimilarity:number;maxBatchSimilarity:number;maxBankSimilarity:number;comparisonCount:number};
  comparisons:OriginalityComparisonResult[];
  issues:OriginalityIssue[];
  release:{eligibleToProceed:boolean;requiresHumanReview:boolean;blockReason:string[]};
}
export interface OriginalityDuplicateGateResult extends OriginalityDuplicateResult {provider:string;model?:string;promptVersion:string;checkedAt:string;reviewBindingFingerprint?:string}

export class OriginalityDuplicateError extends Error {constructor(public code:'ORIGINALITY_DUPLICATE_INVALID_OUTPUT',message:string){super(message)}}

const round=(value:number)=>Number(value.toFixed(4));
const compact=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const structural=(value:string)=>compact(value)
  .replace(/[0-9０-９一二三四五六七八九十百千万億]+/gu,'<n>')
  .replace(/[a-z][a-z0-9_-]{1,20}/giu,'<name>')
  .replace(/[\p{Script=Han}\p{Script=Katakana}]{1,8}(?=さん|さま|様|くん|君)/gu,'<name>');
function gramSet(value:string,n=3){const text=compact(value),result=new Set<string>();if(!text)return result;if(text.length<=n){result.add(text);return result}for(let index=0;index<=text.length-n;index++)result.add(text.slice(index,index+n));return result}
function intersection(left:Set<string>,right:Set<string>){let common=0;for(const gram of left)if(right.has(gram))common++;return common}
function similarity(left:Set<string>,right:Set<string>){if(!left.size&&!right.size)return 1;const common=intersection(left,right);return common/(left.size+right.size-common||1)}
function containment(left:Set<string>,right:Set<string>){if(!left.size||!right.size)return left.size===right.size?1:0;return intersection(left,right)/Math.min(left.size,right.size)}
function segments(value:string){const normalized=value.normalize('NFKC').trim();const pieces=normalized.split(/(?<=[。！？!?\n])/u).map(part=>part.trim()).filter(part=>compact(part).length>=6);return Array.from(new Set([normalized,...pieces])).filter(part=>compact(part).length>=6)}
function candidateParts(candidate:OriginalityDuplicateInput['candidate']){return Array.from(new Set([candidate.stem,candidate.audioScript||'',`${candidate.instruction} ${candidate.stem} ${candidate.choices.join(' ')} ${candidate.audioScript||''}`].map(value=>value.trim()).filter(value=>compact(value).length>=6)))}
type PreparedText={compact:string;grams:Set<string>;patternGrams:Set<string>};
function prepare(value:string):PreparedText{const normalized=compact(value);return {compact:normalized,grams:gramSet(normalized),patternGrams:gramSet(structural(value))}}
function scoreComparison(left:PreparedText[],item:OriginalityCorpusItem):OriginalityComparisonInput{
  const right=segments(item.text).map(prepare);let exactNormalized=false,ngramSimilarity=0,patternSimilarity=0,containmentSimilarity=0;
  for(const a of left)for(const b of right){if(a.compact.length>=8&&a.compact===b.compact)exactNormalized=true;ngramSimilarity=Math.max(ngramSimilarity,similarity(a.grams,b.grams));patternSimilarity=Math.max(patternSimilarity,similarity(a.patternGrams,b.patternGrams));containmentSimilarity=Math.max(containmentSimilarity,containment(a.grams,b.grams))}
  return {id:item.id,kind:item.kind,text:item.text.slice(0,4000),exactNormalized,ngramSimilarity:round(ngramSimilarity),patternSimilarity:round(patternSimilarity),containmentSimilarity:round(containmentSimilarity)};
}
function opaqueId(candidate:OriginalityDuplicateInput['candidate']){return `QA7-${createHash('sha256').update(JSON.stringify(candidate)).digest('hex').slice(0,16)}`}
export function buildOriginalityDuplicateInput(question:QuestionRecord,context:{audioScript?:string;sourceExpected?:boolean;corpus:OriginalityCorpusItem[]}):OriginalityDuplicateInput{
  const candidate={instruction:question.instruction,stem:question.prompt,choices:[...question.choices],...(context.audioScript?.trim()?{audioScript:context.audioScript}: {})};
  const counts:Record<OriginalityComparisonKind,number>={SOURCE:0,BATCH:0,BANK:0};for(const item of context.corpus)counts[item.kind]++;
  const preparedCandidate=candidateParts(candidate).map(prepare);
  const scored=context.corpus.map(item=>scoreComparison(preparedCandidate,item)).sort((a,b)=>Math.max(b.ngramSimilarity,b.patternSimilarity,b.containmentSimilarity)-Math.max(a.ngramSimilarity,a.patternSimilarity,a.containmentSimilarity));
  const selected:Array<OriginalityComparisonInput>=[];
  for(const kind of ['SOURCE','BATCH','BANK'] as const){selected.push(...scored.filter(item=>item.kind===kind).slice(0,Math.max(2,Math.floor(ORIGINALITY_DUPLICATE_POLICY_V1.semanticComparisonLimit/3))))}
  return {questionId:opaqueId(candidate),candidate,comparisons:selected.slice(0,ORIGINALITY_DUPLICATE_POLICY_V1.semanticComparisonLimit),sourceExpected:!!context.sourceExpected,corpusCounts:counts,policyVersion:ORIGINALITY_DUPLICATE_POLICY_V1.version,algorithmVersion:ORIGINALITY_DUPLICATE_POLICY_V1.algorithmVersion};
}

const isObject=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
const exactKeys=(value:Record<string,unknown>,keys:readonly string[])=>Object.keys(value).length===keys.length&&keys.every(key=>Object.prototype.hasOwnProperty.call(value,key));
const confidences=new Set(['HIGH','MEDIUM','LOW']);const risks=new Set(['NONE','LOW','MEDIUM','HIGH']);const relationships=new Set(['DISTINCT','SHARED_KNOWLEDGE','NEAR_DUPLICATE','SOURCE_COPY']);const kinds=new Set(['SOURCE','BATCH','BANK']);
export function validateOriginalityDuplicateAnalysis(value:unknown,input:OriginalityDuplicateInput):OriginalityDuplicateAnalysis{
  const fail=(message:string):never=>{throw new OriginalityDuplicateError('ORIGINALITY_DUPLICATE_INVALID_OUTPUT',message)};
  if(!isObject(value))fail('Provider output must be an object.');
  const root=value as Record<string,unknown>;
  if(!exactKeys(root,['qaVersion','questionId','confidence','relationships']))fail('Provider output must match the analysis-only QA7 contract exactly.');
  if(root.qaVersion!==ORIGINALITY_DUPLICATE_PROMPT_VERSION||root.questionId!==input.questionId||!confidences.has(String(root.confidence)))fail('Provider output has an invalid version, id, or confidence.');
  if(!Array.isArray(root.relationships))fail('Provider output has an invalid relationship list.');
  const relationshipList=root.relationships as unknown[];
  const supplied=new Map(input.comparisons.map(item=>[item.id,item]));const seen=new Set<string>();
  if(relationshipList.length!==input.comparisons.length)fail('Every shortlisted comparison must be classified exactly once.');
  for(const raw of relationshipList){
    if(!isObject(raw))fail('A relationship must be an object.');
    const relation=raw as Record<string,unknown>;
    if(!exactKeys(relation,['comparisonId','kind','semanticRisk','relationship','evidence']))fail('A relationship has an invalid shape.');
    const id=String(relation.comparisonId),expected=supplied.get(id);
    if(!expected||seen.has(id)||relation.kind!==expected.kind||!kinds.has(String(relation.kind))||!risks.has(String(relation.semanticRisk))||!relationships.has(String(relation.relationship))||typeof relation.evidence!=='string'||!relation.evidence.trim()||relation.evidence.length>1000)fail('A relationship contains fabricated, duplicate, inconsistent, or empty evidence.');
    seen.add(id);
  }
  return root as unknown as OriginalityDuplicateAnalysis;
}

const riskRank:Record<OriginalitySemanticRisk,number>={NONE:0,LOW:1,MEDIUM:2,HIGH:3};
const rankRisk=(values:OriginalitySemanticRisk[])=>values.reduce((best,value)=>riskRank[value]>riskRank[best]?value:best,'NONE' as OriginalitySemanticRisk);
const issue=(code:OriginalityIssueCode,severity:OriginalityIssueSeverity,evidence:string,reason:string,suggestedAction='Send the item to a human originality reviewer; QA7 must not rewrite it.'):OriginalityIssue=>({code,severity,evidence,reason,suggestedAction});
function deterministicRisk(item:OriginalityComparisonInput):OriginalitySemanticRisk{
  const p=ORIGINALITY_DUPLICATE_POLICY_V1.thresholds,source=item.kind==='SOURCE';const hard=source?p.sourceHard:p.duplicateHard,review=source?p.sourceReview:p.duplicateReview;
  if(item.exactNormalized||item.ngramSimilarity>=hard||item.patternSimilarity>=p.patternHard||(item.containmentSimilarity>=p.containmentHard&&item.ngramSimilarity>=.5))return 'HIGH';
  if(item.ngramSimilarity>=review||item.patternSimilarity>=p.patternReview||(item.containmentSimilarity>=p.containmentReview&&item.ngramSimilarity>=.3))return 'MEDIUM';
  return Math.max(item.ngramSimilarity,item.patternSimilarity)>=.55?'LOW':'NONE';
}
export function finalizeOriginalityDuplicate(analysis:OriginalityDuplicateAnalysis,input:OriginalityDuplicateInput,persistedQuestionId=input.questionId):OriginalityDuplicateResult{
  const relationMap=new Map(analysis.relationships.map(item=>[item.comparisonId,item]));
  const comparisons:OriginalityComparisonResult[]=input.comparisons.map(item=>{const relation=relationMap.get(item.id)!;const semanticRisk=rankRisk([deterministicRisk(item),relation.semanticRisk]);return {id:item.id,kind:item.kind,exactNormalized:item.exactNormalized,ngramSimilarity:item.ngramSimilarity,patternSimilarity:item.patternSimilarity,containmentSimilarity:item.containmentSimilarity,semanticRisk,relationship:relation.relationship,evidence:relation.evidence}});
  const issues:OriginalityIssue[]=[];const add=(entry:OriginalityIssue)=>{if(!issues.some(item=>item.code===entry.code&&item.evidence===entry.evidence))issues.push(entry)};
  for(const item of comparisons){const evidence=`${item.kind} ${item.id}: n-gram ${item.ngramSimilarity}, pattern ${item.patternSimilarity}, containment ${item.containmentSimilarity}; ${item.evidence}`;if(item.semanticRisk==='HIGH'){if(item.kind==='SOURCE')add(issue('SOURCE_COPY_CONFIRMED','CRITICAL',evidence,'The candidate reproduces source wording or structure beyond permitted knowledge abstraction.'));else if(item.exactNormalized)add(issue('EXACT_DUPLICATE','CRITICAL',evidence,'The candidate is an exact normalized duplicate of existing content.'));else add(issue('NEAR_DUPLICATE_HIGH','CRITICAL',evidence,`The candidate is a high-risk ${item.kind.toLowerCase()} near duplicate.`))}else if(item.semanticRisk==='MEDIUM'){add(issue(item.kind==='SOURCE'?'SOURCE_COPY_RISK':'DUPLICATE_RISK','MAJOR',evidence,item.kind==='SOURCE'?'The item may be too close to source wording or exercise structure.':'The item may assess the same decision with only superficial changes.'))}}
  if(input.sourceExpected&&input.corpusCounts.SOURCE===0)add(issue('SOURCE_EVIDENCE_MISSING','MAJOR','The source-grounded Factory job supplied no source comparison text.','Originality against the curriculum source cannot be established.'));
  if(analysis.confidence==='LOW')add(issue('LOW_CONFIDENCE','MAJOR','The QA7 relationship classifier returned LOW confidence.','Uncertain semantic duplicate evidence cannot pass automatically.'));
  const hardFail=issues.some(item=>item.severity==='CRITICAL');const review=!hardFail&&issues.some(item=>item.severity==='MAJOR');const verdict:OriginalityVerdict=hardFail?'FAIL':review?'REVIEW':'PASS';
  const values=(kind:OriginalityComparisonKind)=>comparisons.filter(item=>item.kind===kind);const max=(kind:OriginalityComparisonKind)=>round(Math.max(0,...values(kind).map(item=>Math.max(item.ngramSimilarity,item.patternSimilarity,item.containmentSimilarity))));
  return {qaVersion:ORIGINALITY_DUPLICATE_PROMPT_VERSION,questionId:persistedQuestionId,verdict,hardFail,confidence:analysis.confidence,policyVersion:input.policyVersion,algorithmVersion:input.algorithmVersion,candidateFingerprint:createHash('sha256').update(JSON.stringify(input.candidate)).digest('hex'),summary:{sourceCopyRisk:rankRisk(values('SOURCE').map(item=>item.semanticRisk)),batchDuplicateRisk:rankRisk(values('BATCH').map(item=>item.semanticRisk)),bankDuplicateRisk:rankRisk(values('BANK').map(item=>item.semanticRisk)),maxSourceSimilarity:max('SOURCE'),maxBatchSimilarity:max('BATCH'),maxBankSimilarity:max('BANK'),comparisonCount:comparisons.length},comparisons,issues,release:{eligibleToProceed:verdict==='PASS',requiresHumanReview:verdict!=='PASS',blockReason:Array.from(new Set(issues.filter(item=>item.severity==='CRITICAL'||item.severity==='MAJOR').map(item=>item.code)))}};
}
export function withOriginalityDuplicateAudit(result:OriginalityDuplicateResult,metadata:{provider:string;model?:string}):OriginalityDuplicateGateResult{return {...result,provider:metadata.provider,...(metadata.model?{model:metadata.model}:{}),promptVersion:ORIGINALITY_DUPLICATE_PROMPT_VERSION,checkedAt:new Date().toISOString()}}
export function technicalOriginalityDuplicateResult(input:OriginalityDuplicateInput,code:'ORIGINALITY_DUPLICATE_INVALID_OUTPUT'|'ORIGINALITY_DUPLICATE_PROVIDER_FAILURE',provider:string,model?:string,persistedQuestionId=input.questionId):OriginalityDuplicateGateResult{
  const detail=code==='ORIGINALITY_DUPLICATE_INVALID_OUTPUT'?'Provider output failed strict QA7 validation.':'The QA7 relationship provider could not complete the request.';const base:OriginalityDuplicateResult={qaVersion:ORIGINALITY_DUPLICATE_PROMPT_VERSION,questionId:persistedQuestionId,verdict:'REVIEW',hardFail:false,confidence:'LOW',policyVersion:input.policyVersion,algorithmVersion:input.algorithmVersion,candidateFingerprint:createHash('sha256').update(JSON.stringify(input.candidate)).digest('hex'),summary:{sourceCopyRisk:'NONE',batchDuplicateRisk:'NONE',bankDuplicateRisk:'NONE',maxSourceSimilarity:0,maxBatchSimilarity:0,maxBankSimilarity:0,comparisonCount:input.comparisons.length},comparisons:[],issues:[issue(code,'MAJOR',detail,'A technical failure cannot become an originality PASS.','Retry QA7 or require explicit human originality review.')],release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:[code]}};return withOriginalityDuplicateAudit(base,{provider,model})
}
export function bindOriginalityReviewEvidence(value:OriginalityDuplicateGateResult,input:OriginalityDuplicateInput){if(value.verdict==='REVIEW')value.reviewBindingFingerprint=createHash('sha256').update(JSON.stringify({input,promptVersion:value.promptVersion,policyVersion:value.policyVersion,algorithmVersion:value.algorithmVersion})).digest('hex');return value}
export function originalityReviewFingerprint(value:OriginalityDuplicateGateResult){const {checkedAt,...stable}=value;void checkedAt;return JSON.stringify(stable)}
export function summarizeOriginalityDuplicateMetrics(results:OriginalityDuplicateGateResult[]){const technical=(result:OriginalityDuplicateGateResult)=>result.issues.some(item=>item.code==='ORIGINALITY_DUPLICATE_INVALID_OUTPUT'||item.code==='ORIGINALITY_DUPLICATE_PROVIDER_FAILURE');const evaluable=results.filter(result=>!technical(result));const rate=(count:number,total:number)=>total?count/total:null;return {originalitySampleCount:results.length,originalityEvaluableSampleCount:evaluable.length,originalityTechnicalReviewCount:results.length-evaluable.length,sourceCopyFailureRate:rate(evaluable.filter(result=>result.issues.some(item=>item.code==='SOURCE_COPY_CONFIRMED')).length,evaluable.length),bankDuplicateFailureRate:rate(evaluable.filter(result=>result.summary.bankDuplicateRisk==='HIGH').length,evaluable.length),batchDuplicateFailureRate:rate(evaluable.filter(result=>result.summary.batchDuplicateRisk==='HIGH').length,evaluable.length),originalityReviewRate:rate(results.filter(result=>result.verdict==='REVIEW').length,results.length)}}

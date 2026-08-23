import { createHash } from 'node:crypto';
import type { QuestionRecord } from '../admin-types';
import { seedQuestions } from '../../data/admin/seed';
import qaReportJson from '../../data/qa/jft-content-qa-v1-report.json';
import type { FactoryCandidate, FactoryJob } from './factory-domain';
import type { Repository } from './domain';
import { runQuestionQa } from './qa';

export type PendingReviewDecision='APPROVE'|'KEEP_REVIEW'|'REJECT';
export type PendingReviewConfidence='HIGH'|'MEDIUM'|'LOW';
type GateVerdict='PASS'|'REVIEW'|'FAIL'|'MISSING'|'STALE';

interface QaIssueEvidence {code:string;severity:string;evidence:string;reason:string;suggestedAction:string}
interface Qa1Evidence {
  questionId:string;verdict:'PASS'|'REVIEW'|'FAIL';hardFail:boolean;confidence:string;
  issues:QaIssueEvidence[];
}

export interface PendingQuestionReviewRecord {
  questionId:string;
  decision:PendingReviewDecision;
  confidence:PendingReviewConfidence;
  reasons:string[];
  qaSummary:{qa1:GateVerdict;qa2:GateVerdict;qa3:GateVerdict;qa4:GateVerdict;qa5:GateVerdict;qa6:GateVerdict;qa7:GateVerdict};
  recommendedFix:string|null;
  level:QuestionRecord['level'];
  section:QuestionRecord['section'];
  issueCodes:string[];
}

const qaReport=qaReportJson as unknown as {results:Qa1Evidence[]};
const qa1ById=new Map(qaReport.results.map(result=>[result.questionId,result]));
const seedById=new Map(seedQuestions.map(question=>[question.id,question]));
const evidenceOnlyIssueCodes=new Set(['INSUFFICIENT_EVIDENCE','ORIGINALITY_EVIDENCE_MISSING','PROVENANCE_MISSING']);

function learnerVisibleFingerprint(question:QuestionRecord){
  const semanticTags=question.tags.filter(tag=>!tag.startsWith('production-batch:')&&!tag.startsWith('qa-state:')).sort();
  return createHash('sha256').update(JSON.stringify({
    section:question.section,type:question.type,level:question.level,instruction:question.instruction,
    prompt:question.prompt,choices:question.choices,answer:question.answer,explanationVi:question.explanationVi,
    audioSrc:question.audioSrc??null,tags:semanticTags,
  })).digest('hex');
}

function gate(candidate:FactoryCandidate|undefined,key:'contentQa'|'answerOracleQa'|'japaneseNaturalnessQa'|'curriculumGroundingQa'|'jftAlignmentQa'|'difficultyCalibrationQa'|'originalityDuplicateQa'):GateVerdict{
  const evidence=candidate?.[key] as {verdict?:GateVerdict}|undefined;
  return evidence?.verdict??'MISSING';
}

function factoryCandidates(jobs:FactoryJob[]){
  const result=new Map<string,FactoryCandidate>();
  for(const job of jobs)for(const candidate of job.candidates){
    const id=candidate.question.id,current=result.get(id);
    if(!current||candidate.generation.createdAt>current.generation.createdAt)result.set(id,candidate);
  }
  return result;
}

function unique(values:string[]){return Array.from(new Set(values.filter(Boolean)))}

export function buildPendingQuestionReviewRecords(questions:QuestionRecord[],jobs:FactoryJob[]=[]){
  const candidates=factoryCandidates(jobs);
  return questions.filter(question=>question.status==='review').sort((a,b)=>a.id.localeCompare(b.id)).map(question=>{
    const candidate=candidates.get(question.id),seed=seedById.get(question.id),reported=qa1ById.get(question.id);
    const evidenceCurrent=!!seed&&learnerVisibleFingerprint(seed)===learnerVisibleFingerprint(question);
    const qa1:GateVerdict=candidate?.contentQa?.verdict??(reported&&evidenceCurrent?reported.verdict:reported?'STALE':'MISSING');
    const qaSummary={
      qa1,qa2:gate(candidate,'answerOracleQa'),qa3:gate(candidate,'japaneseNaturalnessQa'),
      qa4:gate(candidate,'curriculumGroundingQa'),qa5:gate(candidate,'jftAlignmentQa'),
      qa6:gate(candidate,'difficultyCalibrationQa'),qa7:gate(candidate,'originalityDuplicateQa'),
    };
    const q0=runQuestionQa(question),gateValues=Object.values(qaSummary);
    const qaIssues=reported&&evidenceCurrent?reported.issues:[];
    const issueCodes=unique([
      ...qaIssues.map(issue=>issue.code),
      ...q0.issues.map(issue=>issue.code),
      ...(question.section==='listening'&&!question.audioSrc?['LISTENING_AUDIO_MISSING']:[]),
      ...(!evidenceCurrent&&reported?['QA_EVIDENCE_STALE']:[]),
      ...(!reported?['QA1_EVIDENCE_MISSING']:[]),
      ...(gateValues.slice(1).some(value=>value==='MISSING')?['SPECIALIZED_QA_EVIDENCE_MISSING']:[]),
    ]);
    const specializedFail=Object.values(qaSummary).slice(1).includes('FAIL');
    const substantiveQa1Failure=qa1==='FAIL'&&!!reported&&(reported.hardFail||reported.issues.some(issue=>(issue.severity==='CRITICAL'||issue.severity==='MAJOR')&&!evidenceOnlyIssueCodes.has(issue.code)));
    const hardBlock=!q0.passed||question.section==='listening'&&!question.audioSrc||specializedFail||substantiveQa1Failure;
    const allPass=gateValues.every(value=>value==='PASS');
    const decision:PendingReviewDecision=hardBlock?'REJECT':allPass?'APPROVE':'KEEP_REVIEW';
    const critical=qaIssues.filter(issue=>issue.severity==='CRITICAL'||issue.severity==='MAJOR');
    const reasons=decision==='REJECT'
      ? unique([
          ...critical.map(issue=>`${issue.code}: ${issue.reason}`),
          ...(!q0.passed?['Q0 deterministic validation failed.']:[]),
          ...(question.section==='listening'&&!question.audioSrc?['Listening audio is missing.']:[]),
          ...Object.entries(qaSummary).filter(([,value])=>value==='FAIL').map(([name])=>`${name.toUpperCase()} returned FAIL.`),
        ])
      : decision==='APPROVE'
        ? ['All QA1–QA7 gates are PASS and deterministic structure/audio requirements are satisfied.']
        : unique([
            ...(qa1==='REVIEW'||qa1==='FAIL'?['QA1 requires unresolved human review and remains blocked.']:[]),
            ...(qa1==='MISSING'?['QA1 evidence is missing.']:[]),
            ...(qa1==='STALE'?['QA1 evidence does not match the current learner-visible content.']:[]),
            ...(Object.entries(qaSummary).slice(1).filter(([,value])=>value!=='PASS').length?['One or more specialized QA2–QA7 results are missing or unresolved.']:[]),
          ]);
    const recommendedFix=decision==='APPROVE'?null:decision==='REJECT'
      ? unique([...critical.map(issue=>issue.suggestedAction),'Edit or regenerate the item, then rerun the complete QA1–QA7 pipeline before reconsideration.']).join(' ')
      : 'Complete the missing QA2–QA7 evidence and resolve every REVIEW result through explicit item-level inspection; do not approve from score alone.';
    return {questionId:question.id,decision,confidence:decision==='REJECT'&&(reported?.hardFail||critical.length)?'HIGH':decision==='REJECT'?'MEDIUM':'LOW',reasons,qaSummary,recommendedFix,level:question.level,section:question.section,issueCodes} satisfies PendingQuestionReviewRecord;
  });
}

export function summarizePendingQuestionReviews(records:PendingQuestionReviewRecord[]){
  const decisions=(value:PendingReviewDecision)=>records.filter(record=>record.decision===value).length;
  const row=(items:PendingQuestionReviewRecord[])=>({reviewed:items.length,approved:items.filter(item=>item.decision==='APPROVE').length,review:items.filter(item=>item.decision==='KEEP_REVIEW').length,rejected:items.filter(item=>item.decision==='REJECT').length});
  const issueCounts=new Map<string,number>();for(const record of records)for(const code of record.issueCodes)issueCounts.set(code,(issueCounts.get(code)??0)+1);
  return {
    reviewed:records.length,approved:decisions('APPROVE'),review:decisions('KEEP_REVIEW'),rejected:decisions('REJECT'),
    byLevel:Object.fromEntries(['A1','A2.1','A2.2'].map(level=>[level,row(records.filter(item=>item.level===level))])),
    bySection:Object.fromEntries(['script_vocabulary','conversation_expression','listening','reading'].map(section=>[section,row(records.filter(item=>item.section===section))])),
    issueCounts:Object.fromEntries([...issueCounts.entries()].sort((a,b)=>b[1]-a[1]||a[0].localeCompare(b[0]))),
  };
}

export function pendingReviewDigest(records:PendingQuestionReviewRecord[]){
  return createHash('sha256').update(records.map(record=>`${record.questionId}:${record.decision}`).join('\n')).digest('hex');
}

export function auditPendingQuestionReviewState(questions:QuestionRecord[],jobs:FactoryJob[]=[]){
  const authoredIds=new Set(seedQuestions.filter(question=>question.source==='original').map(question=>question.id));
  const governed=questions.filter(question=>seedById.has(question.id)&&!authoredIds.has(question.id));
  const expected=buildPendingQuestionReviewRecords(governed.map(question=>({...question,status:'review'})),jobs);
  const actualById=new Map(governed.map(question=>[question.id,question.status]));
  const expectedStatus=(decision:PendingReviewDecision)=>decision==='APPROVE'?'approved':decision==='REJECT'?'archived':'review';
  const drift=expected.filter(record=>actualById.get(record.questionId)!==expectedStatus(record.decision)).map(record=>({id:record.questionId,decision:record.decision,expectedStatus:expectedStatus(record.decision),actualStatus:actualById.get(record.questionId)??'missing'}));
  const statusCounts=questions.reduce<Record<string,number>>((counts,question)=>{counts[question.status]=(counts[question.status]??0)+1;return counts},{});
  return {governedCount:governed.length,expectedSummary:summarizePendingQuestionReviews(expected),expectedDigest:pendingReviewDigest(expected),statusCounts,driftCount:drift.length,drift};
}

export async function reviewPendingQuestionBatch(repo:Repository,options:{afterId?:string;limit?:number;apply?:boolean}={}){
  const questions=await repo.listQuestions(),jobs=await repo.listFactoryJobs();
  const all=buildPendingQuestionReviewRecords(questions,jobs),afterId=options.afterId??'',limit=Math.min(100,Math.max(1,options.limit??50));
  const batch=all.filter(record=>record.questionId>afterId).slice(0,limit),byId=new Map(questions.map(question=>[question.id,question]));
  const changed:QuestionRecord[]=[];
  if(options.apply)for(const record of batch){
    if(record.decision==='KEEP_REVIEW')continue;
    const question=byId.get(record.questionId);if(!question)continue;
    changed.push({...question,status:record.decision==='APPROVE'?'approved':'archived',version:question.version+1,updatedAt:new Date().toISOString()});
  }
  if(changed.length)await repo.upsertQuestions(changed);
  const nextAfterId=batch.at(-1)?.questionId??afterId;
  return {summary:summarizePendingQuestionReviews(all),digest:pendingReviewDigest(all),processed:batch.length,changed:changed.map(question=>({id:question.id,status:question.status})),decisions:batch.map(record=>({id:record.questionId,decision:record.decision})),nextAfterId,done:batch.length<limit};
}

export async function reconcilePendingQuestionReviewState(repo:Repository){
  const questions=await repo.listQuestions(),jobs=await repo.listFactoryJobs(),audit=auditPendingQuestionReviewState(questions,jobs),byId=new Map(questions.map(question=>[question.id,question]));
  const changed:QuestionRecord[]=[];
  for(const drift of audit.drift){
    if(drift.expectedStatus==='approved')throw new Error(`Reconciliation cannot approve ${drift.id}.`);
    const question=byId.get(drift.id);if(!question)continue;
    changed.push({...question,status:drift.expectedStatus as 'review'|'archived',version:question.version+1,updatedAt:new Date().toISOString()});
  }
  if(changed.length)await repo.upsertQuestions(changed);
  return {before:audit,changed:changed.map(question=>({id:question.id,status:question.status}))};
}

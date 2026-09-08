import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import type {ExamDraft, QuestionRecord} from '@/lib/admin-types';

export const A1_RELEASE_ID='a1-machine-bank';
export const A1_RELEASE_VERSION='v1';
export const A1_RELEASE_BANK_PATH='data/production/releases/a1-machine-bank-v1.json';
export const A1_RELEASE_MANIFEST_PATH='data/production/releases/a1-machine-bank-v1.manifest.json';

export type A1ReleaseStatus='MACHINE_ACCEPTED'|'RECOVERED_MACHINE_ACCEPTED';
export interface A1ReleaseQuestion extends Omit<QuestionRecord,'status'> {
  status: A1ReleaseStatus;
  sourceId?: string;
  derivedFrom?: string | null;
  category: string;
  knowledgeUnitIds: string[];
  canDo: string;
  taskType: string;
  contentHash: string;
  approvalMode: 'MACHINE';
  machineAcceptanceState: A1ReleaseStatus;
  pipelineVersion: string;
  provenance: Record<string, unknown>;
}
export interface A1ReleaseBankArtifact {
  releaseId: string;
  releaseVersion: string;
  releaseDecision: 'A1_BANK_RELEASE_READY';
  approvalMode: 'MACHINE';
  questionCount: number;
  questions: A1ReleaseQuestion[];
}
export interface A1ReleaseManifest {
  releaseId: string;
  releaseVersion: string;
  createdAt: string;
  questionCount: number;
  originalMachineAcceptedCount: number;
  recoveredCECount: number;
  releaseBankHash: string;
  releaseDecision: 'A1_BANK_RELEASE_READY';
  approvalMode: 'MACHINE';
  questionIds: string[];
  sourceArtifactHashes: Record<string,string>;
  qaEvidenceHashes: Record<string,string>;
  assembler: {version:string;codeHashes:Record<string,string>};
  pipelineVersion: string;
  counts: {
    sections: Record<string,number>;
    categories: Record<string,number>;
    knowledgeUnits: Record<string,number>;
    canDos: Record<string,number>;
    taskTypes: Record<string,number>;
  };
}

export class A1ReleaseBankIntegrityError extends Error {
  constructor(public readonly reasonCodes:string[]) {
    super(`A1 release bank integrity failed: ${reasonCodes.join(', ')}`);
    this.name='A1ReleaseBankIntegrityError';
  }
}

function stable(value:unknown):string {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
export function sha256(value:string|Buffer) {
  return createHash('sha256').update(value).digest('hex');
}
export function hashA1ReleaseBank(bank:A1ReleaseBankArtifact) {
  const payload=JSON.parse(JSON.stringify({
    releaseId: bank.releaseId,
    releaseVersion: bank.releaseVersion,
    releaseDecision: bank.releaseDecision,
    approvalMode: bank.approvalMode,
    questionCount: bank.questionCount,
    questions: bank.questions,
  }));
  return sha256(stable(payload));
}

export function validateA1ReleaseBank(input:{
  bank: A1ReleaseBankArtifact;
  manifest: A1ReleaseManifest;
  rejectedIds?: Set<string>;
  evidenceById?: Map<string,{contentHash?:string;finalDecision?:string}>;
}) {
  const {bank,manifest}=input;
  const reasonCodes:string[]=[];
  if (bank.releaseId!==A1_RELEASE_ID || manifest.releaseId!==A1_RELEASE_ID) reasonCodes.push('RELEASE_ID_MISMATCH');
  if (bank.releaseVersion!==A1_RELEASE_VERSION || manifest.releaseVersion!==A1_RELEASE_VERSION) reasonCodes.push('RELEASE_VERSION_MISMATCH');
  if (bank.releaseDecision!=='A1_BANK_RELEASE_READY' || manifest.releaseDecision!=='A1_BANK_RELEASE_READY') reasonCodes.push('RELEASE_DECISION_INVALID');
  if (bank.approvalMode!=='MACHINE' || manifest.approvalMode!=='MACHINE') reasonCodes.push('APPROVAL_MODE_INVALID');
  if (bank.questionCount!==486 || bank.questions.length!==486 || manifest.questionCount!==486) reasonCodes.push('QUESTION_COUNT_INVALID');
  const ids=bank.questions.map(q=>q.id);
  if (new Set(ids).size!==ids.length) reasonCodes.push('DUPLICATE_ID');
  if (JSON.stringify(ids)!==JSON.stringify(manifest.questionIds)) reasonCodes.push('MANIFEST_IDENTITY_MISMATCH');
  if (manifest.releaseBankHash!==hashA1ReleaseBank(bank)) reasonCodes.push('RELEASE_BANK_HASH_MISMATCH');
  for (const q of bank.questions) {
    if (!['MACHINE_ACCEPTED','RECOVERED_MACHINE_ACCEPTED'].includes(q.status)) reasonCodes.push('INVALID_MACHINE_STATE');
    if (q.approvalMode!=='MACHINE') reasonCodes.push('QUESTION_APPROVAL_MODE_INVALID');
    if (['PENDING','REVIEW','AUTO_REPAIR_REQUIRED','GOLD','HUMAN_GOLD'].includes(String((q as unknown as Record<string,unknown>).humanReviewStatus)) || ['GOLD','HUMAN_GOLD'].includes(String((q as unknown as Record<string,unknown>).goldStatus))) reasonCodes.push('HUMAN_GOLD_OR_REVIEW_STATE_PRESENT');
    if (!Array.isArray(q.choices) || q.choices.length!==4) reasonCodes.push('CHOICE_COUNT_INVALID');
    if (!Number.isInteger(q.answer) || q.answer<0 || q.answer>=q.choices.length) reasonCodes.push('ANSWER_INDEX_INVALID');
    if (!q.knowledgeUnitIds?.length) reasonCodes.push('MISSING_KU');
    if (input.rejectedIds?.has(q.id)) reasonCodes.push('REJECTED_ID_INCLUDED');
    const evidence=input.evidenceById?.get(q.id);
    if (input.evidenceById && (!evidence || evidence.contentHash!==q.contentHash || evidence.finalDecision!=='MACHINE_ACCEPTED')) reasonCodes.push('MISSING_OR_INVALID_EVIDENCE');
  }
  const unique=Array.from(new Set(reasonCodes)).sort();
  if (unique.length) throw new A1ReleaseBankIntegrityError(unique);
  return {ok:true as const,releaseBankHash:manifest.releaseBankHash,questionIds:ids};
}

export function toRuntimeQuestionRecord(question:A1ReleaseQuestion):QuestionRecord {
  return {
    id: question.id,
    section: question.section,
    type: question.type,
    level: question.level,
    instruction: question.instruction,
    prompt: question.prompt,
    choices: [...question.choices],
    answer: question.answer,
    explanationVi: question.explanationVi,
    audioSrc: question.audioSrc,
    tags: [...question.tags, `release:${A1_RELEASE_VERSION}`, `machine:${question.machineAcceptanceState}`],
    version: question.version,
    status: 'approved',
    source: 'ai',
    createdAt: question.createdAt,
    updatedAt: question.updatedAt,
    category: question.category,
    knowledgeUnitIds: [...question.knowledgeUnitIds],
    canDo: question.canDo,
    taskType: question.taskType,
    contentHash: question.contentHash,
    approvalMode: question.approvalMode,
    machineAcceptanceState: question.machineAcceptanceState,
    pipelineVersion: question.pipelineVersion,
    provenance: question.provenance,
  } as QuestionRecord;
}

export async function loadA1ReleaseBank(paths={bank:A1_RELEASE_BANK_PATH,manifest:A1_RELEASE_MANIFEST_PATH}) {
  const [bank,manifest]=await Promise.all([
    readFile(paths.bank,'utf8').then(text=>JSON.parse(text) as A1ReleaseBankArtifact),
    readFile(paths.manifest,'utf8').then(text=>JSON.parse(text) as A1ReleaseManifest),
  ]);
  validateA1ReleaseBank({bank,manifest});
  return {bank,manifest,questions:bank.questions.map(toRuntimeQuestionRecord)};
}

export function isA1OnlyDraft(draft:ExamDraft) {
  return draft.rules.length>0 && draft.rules.every(rule=>rule.levels.length===1 && rule.levels[0]==='A1');
}

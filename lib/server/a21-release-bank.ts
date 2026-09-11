import {createHash} from 'node:crypto';
import type {QuestionRecord} from '@/lib/admin-types';
import staticReleaseBank from '@/data/production/releases/a21-machine-bank-v1.json';
import staticReleaseManifest from '@/data/production/releases/a21-machine-bank-v1.manifest.json';

export const A21_RELEASE_ID='A21_MACHINE_BANK_V1';
export const A21_RELEASE_VERSION='a21-machine-bank-v1';

export interface A21ReleaseQuestion extends Omit<QuestionRecord,'status'|'source'|'version'|'createdAt'|'updatedAt'> {
  sourceId: string;
  derivedFrom?: string | null;
  blueprintId: string;
  knowledgeUnitIds: string[];
  sourceChunkIds: string[];
  generationBatchId: string;
  approvalMode: 'MACHINE';
  status: 'MACHINE_ACCEPTED';
  machineState: 'MACHINE_ACCEPTED';
  finalDecision: 'MACHINE_ACCEPTED';
  contentHash: string;
  pipelineVersion: string;
  provenance: Record<string,unknown>;
  acceptanceEvidence: Record<string,unknown>;
  templateId: string;
  semanticTarget: string;
}

export interface A21ReleaseBankArtifact {
  artifactVersion: 'A21_MACHINE_BANK_RELEASE_V1';
  releaseId: typeof A21_RELEASE_ID;
  releaseVersion: typeof A21_RELEASE_VERSION;
  level: 'A2.1';
  questionCount: number;
  questions: A21ReleaseQuestion[];
}

export interface A21ReleaseManifest {
  releaseId: typeof A21_RELEASE_ID;
  releaseVersion: typeof A21_RELEASE_VERSION;
  questionCount: number;
  counts: {sections:Record<string,number>;knowledgeUnits:Record<string,number>};
  pilotAnchorCount: number;
  releaseBankHash: string;
  canonicalBankHash: string;
  releaseDecision: 'A21_RELEASE_CANDIDATE_READY';
  approvalMode: 'MACHINE';
  pipelineVersion: string;
}

export class A21ReleaseBankIntegrityError extends Error {
  constructor(public readonly reasonCodes:string[]) {
    super(`A2.1 release bank integrity failed: ${reasonCodes.join(', ')}`);
    this.name='A21ReleaseBankIntegrityError';
  }
}

function cloneJson<T>(value:T):T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function sha(value:unknown) {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

export function hashA21ReleaseBank(bank:A21ReleaseBankArtifact) {
  return sha(bank);
}

export function validateA21ReleaseBank(input:{bank:A21ReleaseBankArtifact;manifest:A21ReleaseManifest}) {
  const {bank,manifest}=input;
  const reasonCodes:string[]=[];
  if(bank.releaseId!==A21_RELEASE_ID || manifest.releaseId!==A21_RELEASE_ID) reasonCodes.push('RELEASE_ID_MISMATCH');
  if(bank.releaseVersion!==A21_RELEASE_VERSION || manifest.releaseVersion!==A21_RELEASE_VERSION) reasonCodes.push('RELEASE_VERSION_MISMATCH');
  if(bank.level!=='A2.1') reasonCodes.push('LEVEL_INVALID');
  if(bank.questionCount!==334 || bank.questions.length!==334 || manifest.questionCount!==334) reasonCodes.push('QUESTION_COUNT_INVALID');
  if(manifest.releaseDecision!=='A21_RELEASE_CANDIDATE_READY') reasonCodes.push('RELEASE_DECISION_INVALID');
  if(manifest.approvalMode!=='MACHINE') reasonCodes.push('APPROVAL_MODE_INVALID');
  if(manifest.canonicalBankHash!==hashA21ReleaseBank(bank)) reasonCodes.push('CANONICAL_BANK_HASH_MISMATCH');
  const ids=bank.questions.map(q=>q.id);
  if(new Set(ids).size!==ids.length) reasonCodes.push('DUPLICATE_ID');
  const sectionCounts=bank.questions.reduce<Record<string,number>>((counts,q)=>{counts[q.section]=(counts[q.section]??0)+1;return counts;},{});
  if(JSON.stringify(sectionCounts)!==JSON.stringify(manifest.counts.sections)) reasonCodes.push('SECTION_COUNTS_MISMATCH');
  if(JSON.stringify(sectionCounts)!==JSON.stringify({script_vocabulary:87,conversation_expression:80,listening:87,reading:80})) reasonCodes.push('SECTION_COUNTS_INVALID');
  for(const q of bank.questions) {
    if(q.level!=='A2.1') reasonCodes.push('QUESTION_LEVEL_INVALID');
    if(q.approvalMode!=='MACHINE' || q.status!=='MACHINE_ACCEPTED' || q.machineState!=='MACHINE_ACCEPTED' || q.finalDecision!=='MACHINE_ACCEPTED') reasonCodes.push('QUESTION_MACHINE_STATE_INVALID');
    if(['PENDING','REVIEW','AUTO_REPAIR_REQUIRED','GOLD','HUMAN_GOLD','PUBLISHED'].includes(String((q as unknown as Record<string,unknown>).humanReviewStatus)) || ['GOLD','HUMAN_GOLD'].includes(String((q as unknown as Record<string,unknown>).goldStatus))) reasonCodes.push('HUMAN_OR_PUBLISH_STATE_PRESENT');
    if(!Array.isArray(q.choices) || q.choices.length!==4) reasonCodes.push('CHOICE_COUNT_INVALID');
    if(!Number.isInteger(q.answer) || q.answer<0 || q.answer>=q.choices.length) reasonCodes.push('ANSWER_INDEX_INVALID');
    if(new Set(q.choices.map(choice=>choice.normalize('NFKC').trim())).size!==4) reasonCodes.push('DUPLICATE_CHOICES');
    if(!q.knowledgeUnitIds?.length) reasonCodes.push('MISSING_KU');
    if(!q.sourceChunkIds?.length) reasonCodes.push('MISSING_SOURCE_CHUNKS');
    if(q.section==='listening' && !q.audioSrc) reasonCodes.push('LISTENING_AUDIO_SRC_MISSING');
    if(!q.contentHash || !q.pipelineVersion || !q.provenance || !q.acceptanceEvidence) reasonCodes.push('MISSING_ACCEPTANCE_LINEAGE');
  }
  const unique=Array.from(new Set(reasonCodes)).sort();
  if(unique.length) throw new A21ReleaseBankIntegrityError(unique);
  return {ok:true as const,releaseBankHash:manifest.releaseBankHash,canonicalBankHash:manifest.canonicalBankHash,questionIds:ids};
}

export function toRuntimeA21QuestionRecord(question:A21ReleaseQuestion):QuestionRecord {
  return {
    id:question.id,
    section:question.section,
    type:question.type,
    level:question.level,
    instruction:question.instruction,
    prompt:question.prompt,
    choices:[...question.choices],
    answer:question.answer,
    explanationVi:question.explanationVi,
    audioSrc:question.audioSrc,
    tags:[...question.tags,`release:${A21_RELEASE_VERSION}`,`machine:${question.machineState}`],
    version:1,
    status:'approved',
    source:'ai',
    createdAt:'2026-09-11T00:00:00.000Z',
    updatedAt:'2026-09-11T00:00:00.000Z',
    category:question.section,
    knowledgeUnitIds:[...question.knowledgeUnitIds],
    sourceChunkIds:[...question.sourceChunkIds],
    contentHash:question.contentHash,
    approvalMode:question.approvalMode,
    machineAcceptanceState:question.machineState,
    pipelineVersion:question.pipelineVersion,
    provenance:question.provenance,
    canDo:String(question.provenance.communicativeTarget ?? question.semanticTarget),
    taskType:question.templateId,
  } as QuestionRecord;
}

export async function loadA21ReleaseBank() {
  const bank=cloneJson(staticReleaseBank) as unknown as A21ReleaseBankArtifact;
  const manifest=cloneJson(staticReleaseManifest) as unknown as A21ReleaseManifest;
  validateA21ReleaseBank({bank,manifest});
  return {bank,manifest,questions:bank.questions.map(toRuntimeA21QuestionRecord)};
}

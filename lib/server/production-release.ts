import type { ExamDraft,ExamVersion,QuestionRecord } from '@/lib/admin-types';
import { PRODUCTION_EXAM_DRAFTS,PRODUCTION_EXAM_DURATION_MINUTES,PRODUCTION_EXAM_LEVELS,PRODUCTION_EXAM_QUESTIONS,PRODUCTION_EXAM_QUESTIONS_PER_SECTION } from '@/data/production/exam-catalog';
import { generateExamVersion } from '@/lib/exam-generator';
import type { Repository } from './domain';
import { PRODUCTION_BANK_RELEASE_VERSION } from './production-bank-release';
import { importProductionQuestionBank } from './production-question-import';

export const PRODUCTION_RELEASE_VERSION='JFT_3000_PRODUCTION_RELEASE_V2' as const;
export const PRODUCTION_EXAM_VERSION=2 as const;

export interface ProductionReleaseExamSummary{
  examId:string;
  versionId:string;
  title:string;
  level:(typeof PRODUCTION_EXAM_LEVELS)[number];
  questionCount:number;
  sectionCounts:Record<string,number>;
}
export interface ProductionReleaseReport{
  releaseVersion:typeof PRODUCTION_RELEASE_VERSION;
  questionBankVersion:typeof PRODUCTION_BANK_RELEASE_VERSION;
  expectedQuestionBankSize:number;
  examCount:number;
  questionsPerExam:number;
  questionsPerSection:number;
  durationMinutes:number;
  levels:readonly string[];
  exams:ProductionReleaseExamSummary[];
}
export interface ProductionReleasePreview{
  ready:boolean;
  bankCount:number;
  expectedBankCount:number;
  publishedVersionIds:string[];
  missingVersionIds:string[];
  conflictingVersionIds:string[];
  report:ProductionReleaseReport;
}

export class ProductionReleaseError extends Error{
  constructor(public readonly code:string,message:string){super(message);this.name='ProductionReleaseError';}
}

function controlledBank(bank:QuestionRecord[]){
  return bank.filter(question=>question.tags.includes(`release:${PRODUCTION_BANK_RELEASE_VERSION}`));
}
function sectionCounts(version:ExamVersion){
  return Object.fromEntries(['script_vocabulary','conversation_expression','listening','reading'].map(section=>[
    section,
    version.questions.filter(item=>item.snapshot.section===section).length,
  ]));
}
function snapshotSignature(version:ExamVersion){
  return JSON.stringify({
    id:version.id,examId:version.examId,version:version.version,title:version.title,
    durationMinutes:version.durationMinutes,rules:version.rules,
    questions:version.questions.map(item=>({questionId:item.questionId,questionVersion:item.questionVersion,snapshot:item.snapshot})),
  });
}

export function buildProductionExamReleasePack(bank:QuestionRecord[],publishedAt=new Date().toISOString()){
  const releaseBank=controlledBank(bank);
  if(releaseBank.length!==3000)throw new ProductionReleaseError('PRODUCTION_BANK_NOT_READY',`Expected 3,000 controlled release questions, received ${releaseBank.length}.`);
  const drafts=structuredClone(PRODUCTION_EXAM_DRAFTS);
  const versions:ExamVersion[]=drafts.map((draft,index)=>{
    const result=generateExamVersion(draft,releaseBank,PRODUCTION_EXAM_VERSION);
    if(!result.ok)throw new ProductionReleaseError('PRODUCTION_EXAM_GENERATION_FAILED',result.errors.join(' | '));
    const version={...result.version,createdAt:publishedAt,publishedAt};
    const level=PRODUCTION_EXAM_LEVELS[index];
    if(version.questions.length!==PRODUCTION_EXAM_QUESTIONS)throw new ProductionReleaseError('PRODUCTION_EXAM_SIZE_MISMATCH',`${version.id} must contain 48 questions.`);
    if(version.durationMinutes!==PRODUCTION_EXAM_DURATION_MINUTES)throw new ProductionReleaseError('PRODUCTION_EXAM_DURATION_MISMATCH',`${version.id} must be 60 minutes.`);
    if(version.questions.some(item=>item.snapshot.status!=='approved'||item.snapshot.level!==level))throw new ProductionReleaseError('PRODUCTION_EXAM_CONTENT_MISMATCH',`${version.id} contains an unapproved or wrong-level question.`);
    const counts=sectionCounts(version);
    if(Object.values(counts).some(count=>count!==PRODUCTION_EXAM_QUESTIONS_PER_SECTION))throw new ProductionReleaseError('PRODUCTION_EXAM_SECTION_MISMATCH',`${version.id} must contain 12 questions in each section.`);
    return version;
  });
  const report:ProductionReleaseReport={
    releaseVersion:PRODUCTION_RELEASE_VERSION,
    questionBankVersion:PRODUCTION_BANK_RELEASE_VERSION,
    expectedQuestionBankSize:3000,
    examCount:versions.length,
    questionsPerExam:PRODUCTION_EXAM_QUESTIONS,
    questionsPerSection:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,
    durationMinutes:PRODUCTION_EXAM_DURATION_MINUTES,
    levels:PRODUCTION_EXAM_LEVELS,
    exams:versions.map((version,index)=>({
      examId:version.examId,versionId:version.id,title:version.title,level:PRODUCTION_EXAM_LEVELS[index],
      questionCount:version.questions.length,sectionCounts:sectionCounts(version),
    })),
  };
  return {drafts,versions,report};
}

export async function previewProductionRelease(repo:Repository):Promise<ProductionReleasePreview>{
  const bank=await repo.listQuestions();
  const bankCount=controlledBank(bank).length;
  // The code-owned seed is authoritative for the expected immutable release composition.
  const { seedQuestions }=await import('@/data/admin/seed');
  const pack=buildProductionExamReleasePack(seedQuestions,'2026-09-21T17:00:00.000Z');
  const existing=await repo.listExamVersions();
  const existingById=new Map(existing.map(version=>[version.id,version]));
  const publishedVersionIds:string[]=[],missingVersionIds:string[]=[],conflictingVersionIds:string[]=[];
  for(const expected of pack.versions){
    const current=existingById.get(expected.id);
    if(!current)missingVersionIds.push(expected.id);
    else if(snapshotSignature(current)===snapshotSignature(expected))publishedVersionIds.push(expected.id);
    else conflictingVersionIds.push(expected.id);
  }
  return {ready:bankCount===3000&&missingVersionIds.length===0&&conflictingVersionIds.length===0,bankCount,expectedBankCount:3000,publishedVersionIds,missingVersionIds,conflictingVersionIds,report:pack.report};
}

export async function publishProductionRelease(repo:Repository,publishedAt=new Date().toISOString()){
  const bankImport=await importProductionQuestionBank(repo);
  const importedBank=await repo.listQuestions();
  if(controlledBank(importedBank).length!==3000)throw new ProductionReleaseError('PRODUCTION_BANK_IMPORT_INCOMPLETE','Production database does not contain all 3,000 controlled release questions after import.');
  const { seedQuestions }=await import('@/data/admin/seed');
  const pack=buildProductionExamReleasePack(seedQuestions,publishedAt);
  const existing=await repo.listExamVersions();
  const existingById=new Map(existing.map(version=>[version.id,version]));
  const published:string[]=[],skipped:string[]=[];
  for(let index=0;index<pack.versions.length;index++){
    const draft:ExamDraft=pack.drafts[index];
    const version=pack.versions[index];
    const current=existingById.get(version.id);
    if(current){
      if(snapshotSignature(current)!==snapshotSignature(version))throw new ProductionReleaseError('PRODUCTION_VERSION_CONFLICT',`${version.id} already exists with a different immutable snapshot.`);
      await repo.saveExamDraft(draft);
      skipped.push(version.id);
      continue;
    }
    await repo.saveExamDraft(draft);
    await repo.saveExamVersion(version);
    published.push(version.id);
  }
  return {bankImport,published,skipped,report:pack.report};
}

import type { ExamDraft,ExamVersion,QuestionRecord } from '@/lib/admin-types';
import { PRODUCTION_EXAM_DRAFTS,PRODUCTION_EXAM_DURATION_MINUTES,PRODUCTION_EXAM_LEVELS,PRODUCTION_EXAM_QUESTIONS,PRODUCTION_EXAM_QUESTIONS_PER_SECTION,PRODUCTION_EXAMS_PER_LEVEL,type ProductionExamLevel } from '@/data/production/exam-catalog';
import { createHash } from 'node:crypto';
import type { Repository } from './domain';
import { PRODUCTION_BANK_RELEASE_VERSION } from './production-bank-release';
import { importProductionQuestionBank } from './production-question-import';

export const PRODUCTION_RELEASE_VERSION='JFT_3000_PRODUCTION_RELEASE_V3_20_FORMS' as const;
export const PRODUCTION_EXAM_VERSION=3 as const;
const PRODUCTION_SECTIONS=['script_vocabulary','conversation_expression','listening','reading'] as const;

export interface ProductionReleaseExamSummary{
  examId:string;
  versionId:string;
  title:string;
  level:ProductionExamLevel;
  questionCount:number;
  sectionCounts:Record<string,number>;
}
export interface ProductionReleaseReport{
  releaseVersion:typeof PRODUCTION_RELEASE_VERSION;
  questionBankVersion:typeof PRODUCTION_BANK_RELEASE_VERSION;
  expectedQuestionBankSize:number;
  examCount:number;
  examsPerLevel:number;
  questionsPerExam:number;
  questionsPerSection:number;
  durationMinutes:number;
  maxPairwiseOverlap:number;
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
  return Object.fromEntries(PRODUCTION_SECTIONS.map(section=>[
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
function draftLevel(draft:ExamDraft):ProductionExamLevel{
  const levels=Array.from(new Set(draft.rules.flatMap(rule=>rule.levels)));
  if(levels.length!==1||!PRODUCTION_EXAM_LEVELS.includes(levels[0] as ProductionExamLevel)){
    throw new ProductionReleaseError('PRODUCTION_EXAM_LEVEL_MISMATCH',`${draft.id} must target exactly one production level.`);
  }
  return levels[0] as ProductionExamLevel;
}
function pairKey(left:number,right:number){
  return left<right?`${left}:${right}`:`${right}:${left}`;
}

function stablePoolOrder(
  bank:QuestionRecord[],
  level:ProductionExamLevel,
  section:(typeof PRODUCTION_SECTIONS)[number],
){
  const prefix=`${PRODUCTION_RELEASE_VERSION}:${level}:${section}:`;
  return bank
    .filter(question=>question.status==='approved'&&question.level===level&&question.section===section)
    .map(question=>({
      question,
      key:createHash('md5').update(`${prefix}${question.id}`).digest('hex'),
    }))
    .sort((left,right)=>left.key.localeCompare(right.key)||left.question.id.localeCompare(right.question.id))
    .map(item=>item.question);
}

function allocateSectionAcrossForms(
  bank:QuestionRecord[],
  level:ProductionExamLevel,
  section:(typeof PRODUCTION_SECTIONS)[number],
  formCount:number,
  countPerForm:number,
){
  const pool=stablePoolOrder(bank,level,section);
  if(pool.length<countPerForm){
    throw new ProductionReleaseError('PRODUCTION_EXAM_GENERATION_FAILED',`${level}/${section}: need at least ${countPerForm} approved questions, received ${pool.length}.`);
  }

  const totalSlots=formCount*countPerForm;
  const assignments:Array<QuestionRecord[]>=Array.from({length:formCount},()=>[]);

  // When the pool can cover every slot, each form receives a disjoint slice.
  if(pool.length>=totalSlots){
    for(let form=0;form<formCount;form++){
      assignments[form]=pool.slice(form*countPerForm,(form+1)*countPerForm);
    }
    return assignments;
  }

  // Listening currently has 175 questions for 240 slots. Give every item one
  // owner form first, then add deterministic cross-form edges. Each repeated
  // question is used by exactly one extra form and each unordered form pair is
  // used at most once. This layout is reproducible in PostgreSQL for controlled
  // production publication without shipping question snapshots through a client.
  if(pool.length*2<totalSlots){
    throw new ProductionReleaseError(
      'PRODUCTION_EXAM_POOL_TOO_SMALL',
      `${level}/${section}: ${pool.length} questions cannot fill ${totalSlots} slots with max exposure 2.`,
    );
  }

  const owned:Array<QuestionRecord[]>=Array.from({length:formCount},()=>[]);
  pool.forEach((question,index)=>owned[index%formCount].push(question));
  for(let form=0;form<formCount;form++)assignments[form]=[...owned[form]];

  const edges:Array<{owner:number;target:number}>=[];
  const usedPairs=new Set<string>();
  for(let target=0;target<formCount;target++){
    const deficit=countPerForm-owned[target].length;
    for(let offset=1;offset<=deficit;offset++){
      const owner=(target+offset)%formCount;
      const key=pairKey(target,owner);
      if(usedPairs.has(key)){
        throw new ProductionReleaseError('PRODUCTION_EXAM_ALLOCATION_FAILED',`${level}/${section}: duplicate form-pair reuse detected.`);
      }
      usedPairs.add(key);
      edges.push({owner,target});
    }
  }

  const outgoing=new Map<number,Array<{owner:number;target:number}>>();
  for(const edge of edges){
    const list=outgoing.get(edge.owner)??[];
    list.push(edge);
    outgoing.set(edge.owner,list);
  }
  for(const [owner,list] of outgoing){
    list.sort((left,right)=>left.target-right.target);
    if(list.length>owned[owner].length){
      throw new ProductionReleaseError('PRODUCTION_EXAM_ALLOCATION_FAILED',`${level}/${section}: owner form ${owner+1} lacks unique questions for controlled reuse.`);
    }
    list.forEach((edge,index)=>assignments[edge.target].push(owned[owner][index]));
  }

  if(assignments.some(items=>items.length!==countPerForm)){
    throw new ProductionReleaseError('PRODUCTION_EXAM_ALLOCATION_FAILED',`${level}/${section}: allocation did not fill every form.`);
  }
  return assignments;
}

function maxPairwiseOverlap(versions:ExamVersion[]){
  let max=0;
  for(const level of PRODUCTION_EXAM_LEVELS){
    const sameLevel=versions.filter(version=>version.questions[0]?.snapshot.level===level);
    for(let left=0;left<sameLevel.length;left++){
      const ids=new Set(sameLevel[left].questions.map(item=>item.questionId));
      for(let right=left+1;right<sameLevel.length;right++){
        const overlap=sameLevel[right].questions.reduce((count,item)=>count+(ids.has(item.questionId)?1:0),0);
        max=Math.max(max,overlap);
      }
    }
  }
  return max;
}

export function buildProductionExamReleasePack(bank:QuestionRecord[],publishedAt=new Date().toISOString()){
  const releaseBank=controlledBank(bank);
  if(releaseBank.length!==3000)throw new ProductionReleaseError('PRODUCTION_BANK_NOT_READY',`Expected 3,000 controlled release questions, received ${releaseBank.length}.`);
  const drafts=structuredClone(PRODUCTION_EXAM_DRAFTS);
  const versions:ExamVersion[]=[];
  const levelByExamId=new Map<string,ProductionExamLevel>();

  for(const level of PRODUCTION_EXAM_LEVELS){
    const levelDrafts=drafts.filter(draft=>draftLevel(draft)===level);
    if(levelDrafts.length!==PRODUCTION_EXAMS_PER_LEVEL){
      throw new ProductionReleaseError('PRODUCTION_EXAM_COUNT_MISMATCH',`${level} must define ${PRODUCTION_EXAMS_PER_LEVEL} forms.`);
    }
    const allocated=Object.fromEntries(PRODUCTION_SECTIONS.map(section=>[
      section,
      allocateSectionAcrossForms(releaseBank,level,section,levelDrafts.length,PRODUCTION_EXAM_QUESTIONS_PER_SECTION),
    ])) as Record<(typeof PRODUCTION_SECTIONS)[number],Array<QuestionRecord[]>>;

    levelDrafts.forEach((draft,formIndex)=>{
      const picked=draft.rules.flatMap(rule=>allocated[rule.section as (typeof PRODUCTION_SECTIONS)[number]][formIndex]);
      const version:ExamVersion={
        id:`${draft.id}-v${PRODUCTION_EXAM_VERSION}`,
        examId:draft.id,
        version:PRODUCTION_EXAM_VERSION,
        title:draft.title,
        durationMinutes:draft.durationMinutes,
        rules:structuredClone(draft.rules),
        createdAt:publishedAt,
        publishedAt,
        questions:picked.map(question=>({
          questionId:question.id,
          questionVersion:question.version,
          snapshot:structuredClone(question),
        })),
      };
      if(version.questions.length!==PRODUCTION_EXAM_QUESTIONS)throw new ProductionReleaseError('PRODUCTION_EXAM_SIZE_MISMATCH',`${version.id} must contain 48 questions.`);
      if(version.durationMinutes!==PRODUCTION_EXAM_DURATION_MINUTES)throw new ProductionReleaseError('PRODUCTION_EXAM_DURATION_MISMATCH',`${version.id} must be 60 minutes.`);
      if(version.questions.some(item=>item.snapshot.status!=='approved'||item.snapshot.level!==level))throw new ProductionReleaseError('PRODUCTION_EXAM_CONTENT_MISMATCH',`${version.id} contains an unapproved or wrong-level question.`);
      const counts=sectionCounts(version);
      if(Object.values(counts).some(count=>count!==PRODUCTION_EXAM_QUESTIONS_PER_SECTION))throw new ProductionReleaseError('PRODUCTION_EXAM_SECTION_MISMATCH',`${version.id} must contain 12 questions in each section.`);
      versions.push(version);
      levelByExamId.set(version.examId,level);
    });
  }

  const overlap=maxPairwiseOverlap(versions);
  if(overlap>1)throw new ProductionReleaseError('PRODUCTION_EXAM_OVERLAP_MISMATCH',`Same-level forms overlap by up to ${overlap} questions; expected at most 1.`);

  const report:ProductionReleaseReport={
    releaseVersion:PRODUCTION_RELEASE_VERSION,
    questionBankVersion:PRODUCTION_BANK_RELEASE_VERSION,
    expectedQuestionBankSize:3000,
    examCount:versions.length,
    examsPerLevel:PRODUCTION_EXAMS_PER_LEVEL,
    questionsPerExam:PRODUCTION_EXAM_QUESTIONS,
    questionsPerSection:PRODUCTION_EXAM_QUESTIONS_PER_SECTION,
    durationMinutes:PRODUCTION_EXAM_DURATION_MINUTES,
    maxPairwiseOverlap:overlap,
    levels:PRODUCTION_EXAM_LEVELS,
    exams:versions.map(version=>({
      examId:version.examId,versionId:version.id,title:version.title,level:levelByExamId.get(version.examId)!,
      questionCount:version.questions.length,sectionCounts:sectionCounts(version),
    })),
  };
  return {drafts,versions,report};
}

export async function previewProductionRelease(repo:Repository):Promise<ProductionReleasePreview>{
  const bank=await repo.listQuestions();
  const bankCount=controlledBank(bank).length;
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

import type { ExamDraft, ExamVersion, QuestionRecord } from '@/lib/admin-types';
import type { SectionId } from '@/lib/types';
import type { Repository } from './domain';
import { questions as authoredQuestions } from '@/data/questions';
import { runQuestionQa } from './qa';

export const A1_MVP_BLUEPRINT_VERSION = 'JFT_A1_MVP_5X8_V1';
export const A1_MVP_EXAM_COUNT = 5;
export const A1_MVP_QUESTIONS_PER_EXAM = 8;
export const A1_MVP_MAX_QUESTION_REUSE = 3;
export const A1_MVP_MAX_PAIRWISE_OVERLAP = 3;

const sections: SectionId[] = [
  'script_vocabulary',
  'conversation_expression',
  'listening',
  'reading',
];

export const A1_MVP_LISTENING_SCRIPTS: Record<string,string> = {
  'LI-001': '男の人：わたしは毎朝八時に会社へ行きます。',
  'LI-003': '女の人：牛乳がありませんね。帰りに一本買います。',
  'LI-004': 'お知らせします。駅前行きのバスは、九時二十分に出発します。',
  'LI-005': '男の人：六時に駅の前で待っています。着いたら電話してください。',
};

// Five balanced block designs. This is an explicit simulator MVP policy, not
// an official JFT composition or overlap rule.
const selections: Record<SectionId,string[][]> = {
  script_vocabulary: [
    ['SV-001','SV-003'],
    ['SV-003','SV-004'],
    ['SV-004','SV-005'],
    ['SV-005','SV-012'],
    ['SV-012','SV-001'],
  ],
  conversation_expression: [
    ['CE-003','CE-004'],
    ['CE-005','CE-012'],
    ['CE-003','CE-005'],
    ['CE-004','CE-012'],
    ['CE-003','CE-012'],
  ],
  listening: [
    ['LI-001','LI-005'],
    ['LI-001','LI-003'],
    ['LI-004','LI-005'],
    ['LI-001','LI-004'],
    ['LI-003','LI-005'],
  ],
  reading: [
    ['RE-004','RE-005'],
    ['RE-001','RE-004'],
    ['RE-001','RE-005'],
    ['RE-003','RE-005'],
    ['RE-001','RE-003'],
  ],
};

export interface A1MvpExamSummary {
  examId: string;
  versionId: string;
  title: string;
  questionIds: string[];
}

export interface A1MvpOverlap {
  leftExamId: string;
  rightExamId: string;
  sharedQuestionIds: string[];
  count: number;
  ratio: number;
}

export interface A1MvpReleaseReport {
  blueprintVersion: typeof A1_MVP_BLUEPRINT_VERSION;
  examCount: number;
  questionsPerExam: number;
  uniqueQuestionCount: number;
  maxQuestionReuse: number;
  maxPairwiseOverlap: number;
  maxPairwiseOverlapRatio: number;
  listeningQuestionIds: string[];
  exams: A1MvpExamSummary[];
  pairwiseOverlap: A1MvpOverlap[];
}

export class A1MvpReleaseError extends Error {
  constructor(public readonly code:string, message:string){ super(message); this.name='A1MvpReleaseError'; }
}

export function buildApprovedAuthoredSeed(now=new Date().toISOString()):QuestionRecord[]{
  return authoredQuestions.map(question=>{
    const record:QuestionRecord={...structuredClone(question),version:1,status:'approved',source:'original',createdAt:now,updatedAt:now};
    if(!runQuestionQa(record).passed)throw new A1MvpReleaseError('A1_MVP_SEED_Q0_FAILED',`${record.id} không đạt kiểm tra cấu trúc.`);
    return record;
  });
}

export function previewApprovedAuthoredSeed(bank:QuestionRecord[],now=new Date().toISOString()){
  const existing=new Map(bank.map(question=>[question.id,question]));
  const approvedSeed=buildApprovedAuthoredSeed(now).map(question=>{
    const saved=existing.get(question.id);
    return saved?.status==='approved'||saved?.status==='archived'?saved:question;
  });
  const seedIds=new Set(approvedSeed.map(question=>question.id));
  return [...bank.filter(question=>!seedIds.has(question.id)),...approvedSeed];
}

export async function syncApprovedAuthoredSeed(repo:Repository,now=new Date().toISOString()){
  const existing=new Map((await repo.listQuestions()).map(question=>[question.id,question]));
  const promoted:QuestionRecord[]=[];
  const preserved:string[]=[];
  for(const question of buildApprovedAuthoredSeed(now)){
    const saved=existing.get(question.id);
    if(saved?.status==='approved'||saved?.status==='archived'){preserved.push(question.id);continue;}
    promoted.push(question);
  }
  if(promoted.length)await repo.upsertQuestions(promoted);
  return {promoted:promoted.map(question=>question.id),preserved};
}

function draftFor(index:number):ExamDraft {
  const number=String(index+1).padStart(2,'0');
  return {
    id:`JFT-A1-${number}`,
    title:`JFT Practice A1 — Đề ${number}`,
    durationMinutes:20,
    status:'published',
    rules:sections.map(section=>({section,count:2,allowBack:section!=='listening',levels:['A1']})),
  };
}

function questionIdsFor(index:number){
  return sections.flatMap(section=>selections[section][index]);
}

function sameQuestionIds(left:ExamVersion,right:ExamVersion){
  const a=left.questions.map(item=>item.questionId),b=right.questions.map(item=>item.questionId);
  return a.length===b.length&&a.every((id,index)=>id===b[index]);
}

export function buildA1MvpReleasePack(bank:QuestionRecord[],publishedAt=new Date().toISOString()){
  const byId=new Map(bank.map(question=>[question.id,question]));
  const drafts=Array.from({length:A1_MVP_EXAM_COUNT},(_,index)=>draftFor(index));
  const versions:ExamVersion[]=drafts.map((draft,index)=>{
    const ids=questionIdsFor(index);
    const snapshots=ids.map(id=>{
      const question=byId.get(id);
      if(!question)throw new A1MvpReleaseError('A1_MVP_QUESTION_MISSING',`${id} không tồn tại trong Question Bank.`);
      if(question.status!=='approved')throw new A1MvpReleaseError('A1_MVP_QUESTION_NOT_APPROVED',`${id} chưa được duyệt.`);
      if(question.level!=='A1')throw new A1MvpReleaseError('A1_MVP_LEVEL_MISMATCH',`${id} không thuộc A1.`);
      if(!selections[question.section][index]?.includes(id))throw new A1MvpReleaseError('A1_MVP_SECTION_MISMATCH',`${id} không khớp phần thi đã khai báo.`);
      if(question.section==='listening'&&(question.type!=='audio_choice'||!question.audioSrc))throw new A1MvpReleaseError('A1_MVP_AUDIO_MISSING',`${id} thiếu audio Listening.`);
      return {questionId:id,questionVersion:question.version,snapshot:structuredClone(question)};
    });
    if(new Set(ids).size!==A1_MVP_QUESTIONS_PER_EXAM)throw new A1MvpReleaseError('A1_MVP_DUPLICATE_WITHIN_EXAM',`${draft.id} chứa câu trùng.`);
    return {
      id:`${draft.id}-v1`,examId:draft.id,version:1,title:draft.title,
      durationMinutes:draft.durationMinutes,rules:structuredClone(draft.rules),
      createdAt:publishedAt,publishedAt,questions:snapshots,
    };
  });

  const reuse=new Map<string,number>();
  for(const version of versions)for(const item of version.questions)reuse.set(item.questionId,(reuse.get(item.questionId)??0)+1);
  const pairwiseOverlap:A1MvpOverlap[]=[];
  for(let left=0;left<versions.length;left++)for(let right=left+1;right<versions.length;right++){
    const rightIds=new Set(versions[right].questions.map(item=>item.questionId));
    const sharedQuestionIds=versions[left].questions.map(item=>item.questionId).filter(id=>rightIds.has(id));
    pairwiseOverlap.push({leftExamId:versions[left].examId,rightExamId:versions[right].examId,sharedQuestionIds,count:sharedQuestionIds.length,ratio:sharedQuestionIds.length/A1_MVP_QUESTIONS_PER_EXAM});
  }
  const maxQuestionReuse=Math.max(...reuse.values());
  const maxPairwiseOverlap=Math.max(...pairwiseOverlap.map(item=>item.count));
  if(maxQuestionReuse>A1_MVP_MAX_QUESTION_REUSE)throw new A1MvpReleaseError('A1_MVP_REUSE_EXCEEDED',`Tái sử dụng ${maxQuestionReuse} vượt giới hạn ${A1_MVP_MAX_QUESTION_REUSE}.`);
  if(maxPairwiseOverlap>A1_MVP_MAX_PAIRWISE_OVERLAP)throw new A1MvpReleaseError('A1_MVP_OVERLAP_EXCEEDED',`Overlap ${maxPairwiseOverlap} vượt giới hạn ${A1_MVP_MAX_PAIRWISE_OVERLAP}.`);
  const exams=versions.map(version=>({examId:version.examId,versionId:version.id,title:version.title,questionIds:version.questions.map(item=>item.questionId)}));
  return {
    drafts,versions,
    report:{
      blueprintVersion:A1_MVP_BLUEPRINT_VERSION,
      examCount:versions.length,
      questionsPerExam:A1_MVP_QUESTIONS_PER_EXAM,
      uniqueQuestionCount:reuse.size,
      maxQuestionReuse,
      maxPairwiseOverlap,
      maxPairwiseOverlapRatio:maxPairwiseOverlap/A1_MVP_QUESTIONS_PER_EXAM,
      listeningQuestionIds:Object.keys(A1_MVP_LISTENING_SCRIPTS),
      exams,pairwiseOverlap,
    } satisfies A1MvpReleaseReport,
  };
}

export async function publishA1MvpReleasePack(repo:Repository,publishedAt=new Date().toISOString()){
  const pack=buildA1MvpReleasePack(await repo.listQuestions(),publishedAt);
  const existing=await repo.listExamVersions();
  const existingById=new Map(existing.map(version=>[version.id,version]));
  for(const version of pack.versions){
    const current=existingById.get(version.id);
    if(current&&!sameQuestionIds(current,version))throw new A1MvpReleaseError('A1_MVP_VERSION_CONFLICT',`${version.id} đã tồn tại với snapshot khác.`);
  }
  const published:string[]=[],skipped:string[]=[];
  for(let index=0;index<pack.versions.length;index++){
    const version=pack.versions[index];
    if(existingById.has(version.id)){skipped.push(version.id);continue;}
    await repo.saveExamDraft(pack.drafts[index]);
    await repo.saveExamVersion(version);
    published.push(version.id);
  }
  return {published,skipped,report:pack.report};
}

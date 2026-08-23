import { seedQuestions } from '../data/admin/seed';
import pendingReview from '../data/reviews/pending-question-review-2026-08-23.json';

const sectionOrder:Record<string,number>={script_vocabulary:0,conversation_expression:1,listening:2,reading:3};
const levelOrder:Record<string,number>={'A1':0,'A2.1':1,'A2.2':2};
const byId=new Map(seedQuestions.map(question=>[question.id,question]));
const requestedBatch=Number(process.argv[2]??'1');
const compact=process.argv.includes('--compact');
const inventoryOnly=process.argv.includes('--inventory');
const batchSize=25;

const queue=pendingReview.records
  .filter(record=>record.decision==='KEEP_REVIEW')
  .sort((left,right)=>
    levelOrder[left.level]-levelOrder[right.level]
    ||sectionOrder[left.section]-sectionOrder[right.section]
    ||left.questionId.localeCompare(right.questionId),
  );
const selected=queue.slice((requestedBatch-1)*batchSize,requestedBatch*batchSize);

if(inventoryOnly){
  const decisionById=new Map(pendingReview.records.map(record=>[record.questionId,record.decision]));
  const rows=seedQuestions.map(question=>{
    const decision=decisionById.get(question.id);
    const status=decision==='REJECT'?'archived':decision==='APPROVE'?'approved':decision==='KEEP_REVIEW'?'review':question.status;
    return {...question,status} as typeof question&{audioScript?:string};
  });
  const group=(property:'status'|'source'|'level'|'section')=>Object.fromEntries(
    [...new Set(rows.map(question=>question[property]))].sort().map(value=>[value,rows.filter(question=>question[property]===value).length]),
  );
  const listening=rows.filter(question=>question.section==='listening');
  console.log(JSON.stringify({
    source:'repository signed snapshot',total:rows.length,status:group('status'),bySource:group('source'),byLevel:group('level'),bySection:group('section'),
    listening:{total:listening.length,withAudio:listening.filter(question=>!!question.audioSrc).length,withoutAudio:listening.filter(question=>!question.audioSrc).length,withScript:listening.filter(question=>!!question.audioScript).length,withoutScript:listening.filter(question=>!question.audioScript).length},
  },null,2));
  process.exit(0);
}

const questions=selected.map(record=>{
  const question=byId.get(record.questionId) as typeof seedQuestions[number]&{
    category?:string;
    canDo?:string;
    knowledgeUnitIds?:string[];
    sourceDocument?:string;
    audioScript?:string;
  }|undefined;
  if(!question)throw new Error(`Question ${record.questionId} is absent from the repository seed.`);
  return compact?{
    id:question.id,level:question.level,section:question.section,category:question.category,canDo:question.canDo,
    instruction:question.instruction,prompt:question.prompt,choices:question.choices,answer:question.answer,
    explanationVi:question.explanationVi,audioSrc:question.audioSrc,audioScript:question.audioScript,
    tags:question.tags,knowledgeUnitIds:question.knowledgeUnitIds,sourceDocument:question.sourceDocument,
    existingIssues:record.issueCodes,
  }:{record,question};
});

console.log(JSON.stringify({
  queueSize:queue.length,
  batchId:`BATCH-${String(requestedBatch).padStart(3,'0')}`,
  start:(requestedBatch-1)*batchSize,
  end:(requestedBatch-1)*batchSize+selected.length-1,
  questions,
},null,2));

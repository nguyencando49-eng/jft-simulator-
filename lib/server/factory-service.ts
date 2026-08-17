import { QuestionRecord } from '@/lib/admin-types';
import { FactoryCandidate, FactoryJob, FactoryRequest } from './factory-domain';
import { getFactoryProvider } from './factory-provider';
import { runFactoryQa } from './factory-qa';
import { runQuestionQa } from './qa';
import { getRepository } from './repository';
import { getSemanticQaProvider } from './semantic-qa-provider';
import { findNearDuplicates, textSimilarity } from './duplicate-detection';
import { getTtsProvider } from './tts-provider';
import { persistGeneratedAudio } from './asset-storage';
import { hasQuestionIdCollision } from './question-integrity';
import { checkSourceSimilarity } from './source-similarity';
import { runCurriculumQa } from './curriculum-production';

function applySourceOriginalityQa(job:FactoryJob,candidate:FactoryCandidate,existing:QuestionRecord[]){
  if(!job.sourceContext) return;
  const report=checkSourceSimilarity(
    [candidate.question.instruction,candidate.question.prompt,candidate.question.choices.join(' '),candidate.audioScript||''].filter(Boolean),
    {
      source:job.sourceContext.sourceTexts.map((text,i)=>({id:job.sourceContext!.sourceChunkIds[i]||String(i),text})),
      bank:existing.map(q=>({id:q.id,text:`${q.prompt} ${q.choices.join(' ')}`})),
      batch:job.candidates.filter(x=>x.id!==candidate.id).map(x=>({id:x.id,text:`${x.question.prompt} ${x.question.choices.join(' ')}`})),
    },
  );
  if(report.passed) return;
  candidate.qa.issues.push({code:'source_similarity',severity:'error',category:'pedagogy',message:`Originality FAIL: ${report.best?.kind} similarity ${Math.round((report.best?.score||0)*100)}% (${job.sourceContext.originalityPromptVersion||'source-originality-v1'}).`});
  candidate.qa.passed=false;
  candidate.qa.score=Math.max(0,candidate.qa.score-40);
}

export function validateFactoryRequest(input:FactoryRequest){
  if(!input.topic?.trim()) throw new Error('topic is required');
  if(!['script_vocabulary','conversation_expression','listening','reading'].includes(input.section)) throw new Error('invalid section');
  if(!['A1','A2.1','A2.2'].includes(input.level)) throw new Error('invalid level');
  if(!Number.isInteger(input.count)||input.count<1||input.count>20) throw new Error('count must be 1..20');
}

export async function runFactoryJob(job:FactoryJob):Promise<FactoryJob>{
  const repo=getRepository(); const provider=getFactoryProvider(); const semantic=getSemanticQaProvider();
  job.status='running'; job.updatedAt=new Date().toISOString(); await repo.saveFactoryJob(job);
  try{
    const drafts=await provider.generate(job.request);
    const candidates:FactoryCandidate[]=[];
    for(let i=0;i<drafts.length;i++){
      const d=drafts[i], now=new Date().toISOString();
      const q:QuestionRecord={id:`AI-${job.request.section.toUpperCase().replaceAll('_','-')}-${job.id.slice(0,8)}-${String(i+1).padStart(3,'0')}`,section:job.request.section,type:job.request.section==='listening'?'audio_choice':'choice',level:job.request.level,instruction:d.instruction,prompt:d.prompt,choices:d.choices,answer:d.answer,explanationVi:job.request.includeExplanation?d.explanationVi:'',audioSrc:undefined,tags:Array.from(new Set([...(d.tags||[]),job.request.topic,job.request.canDo||''].filter(Boolean))),version:1,status:'review',source:'ai',createdAt:now,updatedAt:now};
      const bare:Omit<FactoryCandidate,'qa'>={id:crypto.randomUUID(),question:q,audioScript:job.request.generateAudioScript?d.audioScript:undefined,generation:{provider:provider.name,model:provider.model,promptVersion:'v5.1',createdAt:now},audio:q.type==='audio_choice'?{status:'pending'}:undefined};
      const semanticQa=await semantic.review(bare,job.request);
      const withSemantic={...bare,semanticQa};
      candidates.push({...withSemantic,qa:runFactoryQa(withSemantic)});
    }
    job.candidates=candidates;

    for(const hit of findNearDuplicates(job.candidates,c=>c.question.prompt,.82)){
      for(const c of [hit.a,hit.b]){c.qa.issues.push({code:'duplicate_similarity',severity:'error',category:'pedagogy',message:`Near-duplicate prompt in this batch (${Math.round(hit.score*100)}% similarity).`});c.qa.passed=false;c.qa.score=Math.max(0,c.qa.score-35);}
    }
    const existing=await repo.listQuestions();
    for(const c of job.candidates){
      let best=0; for(const q of existing) best=Math.max(best,textSimilarity(c.question.prompt,q.prompt));
      if(best>=.86){c.qa.issues.push({code:'duplicate_similarity',severity:'error',category:'pedagogy',message:`Similar to an existing Question Bank item (${Math.round(best*100)}% similarity).`});c.qa.passed=false;c.qa.score=Math.max(0,c.qa.score-35);}
      applySourceOriginalityQa(job,c,existing);
      if(job.sourceContext){
        const sourceUnits=await repo.listKnowledgeUnits(job.sourceContext.sourceDocumentId);
        const ids=job.sourceContext.knowledgeUnitIds||[job.sourceContext.knowledgeUnitId];
        const curriculum=runCurriculumQa(c.question,sourceUnits.filter(u=>ids.includes(u.id)));
        c.curriculumQa=curriculum;
        if(curriculum.hardFail){c.qa.issues.push({code:'semantic_alignment',severity:'error',category:'pedagogy',message:`OUT_OF_CURRICULUM: ${curriculum.outsideKnowledge.join(', ')}`});c.qa.passed=false;c.qa.score=Math.min(c.qa.score,curriculum.score);}
      }
    }
    job.status='review'; job.provider=provider.name; job.updatedAt=new Date().toISOString();
  }catch(e){ job.status='failed'; job.error=e instanceof Error?e.message:String(e); job.updatedAt=new Date().toISOString(); }
  return repo.saveFactoryJob(job);
}

export async function renderFactoryCandidateAudio(jobId:string,candidateId:string){
  const repo=getRepository(); const job=await repo.getFactoryJob(jobId); if(!job) throw new Error('Factory job not found');
  const c=job.candidates.find(x=>x.id===candidateId); if(!c) throw new Error('Factory candidate not found');
  if(c.question.type!=='audio_choice') throw new Error('Audio rendering is only available for listening candidates.');
  if(!c.audioScript?.trim()) throw new Error('Audio script is required before TTS rendering.');
  const tts=getTtsProvider(); c.audio={status:'pending',provider:tts.name,voice:tts.voice}; await repo.saveFactoryJob(job);
  try{
    const rendered=await tts.synthesize(c.audioScript); const stored=await persistGeneratedAudio(rendered,job.id,c.id); const now=new Date().toISOString();
    c.question.audioSrc=stored.src; c.question.updatedAt=now; c.audio={status:'ready',provider:rendered.provider,voice:rendered.voice,storage:stored.storage,renderedAt:now};
    const bare={id:c.id,question:c.question,audioScript:c.audioScript,generation:c.generation,semanticQa:c.semanticQa,audio:c.audio,approvedAt:c.approvedAt}; c.qa=runFactoryQa(bare);
    applySourceOriginalityQa(job,c,await repo.listQuestions());
  }catch(e){c.audio={status:'failed',provider:tts.name,voice:tts.voice,error:e instanceof Error?e.message:String(e)}; throw e;}
  finally{job.updatedAt=new Date().toISOString();await repo.saveFactoryJob(job);}
  return {job,candidate:c};
}

export async function approveFactoryCandidates(jobId:string,candidateIds:string[]){
  const repo=getRepository(); const job=await repo.getFactoryJob(jobId); if(!job) throw new Error('Factory job not found');
  let approved=0; const now=new Date().toISOString(); const existingQuestions=await repo.listQuestions(); const existingIds=new Set(existingQuestions.map(q=>q.id));
  for(const c of job.candidates){
    if(!candidateIds.includes(c.id) || c.approvedAt) continue;
    const bare={id:c.id,question:c.question,audioScript:c.audioScript,generation:c.generation,semanticQa:c.semanticQa,audio:c.audio,approvedAt:c.approvedAt}; c.qa=runFactoryQa(bare);
    applySourceOriginalityQa(job,c,existingQuestions);
    if(job.sourceContext){const ids=job.sourceContext.knowledgeUnitIds||[job.sourceContext.knowledgeUnitId];const units=(await repo.listKnowledgeUnits(job.sourceContext.sourceDocumentId)).filter(u=>ids.includes(u.id));c.curriculumQa=runCurriculumQa(c.question,units);if(c.curriculumQa.hardFail){c.qa.issues.push({code:'semantic_alignment',severity:'error',category:'pedagogy',message:`OUT_OF_CURRICULUM: ${c.curriculumQa.outsideKnowledge.join(', ')}`});c.qa.passed=false;}}
    if(hasQuestionIdCollision(existingQuestions,c.question.id) || existingIds.has(c.question.id)){
      c.qa.issues.push({code:'question_id_collision',severity:'error',category:'schema',message:`Question id ${c.question.id} already exists in Question Bank.`});
      c.qa.passed=false; c.qa.score=Math.max(0,c.qa.score-50); continue;
    }
    if(!c.qa.passed) continue;
    const finalQa=runQuestionQa(c.question); if(!finalQa.passed) continue;
    c.question.status='approved'; c.question.updatedAt=now; c.approvedAt=now; await repo.upsertQuestion(c.question); existingIds.add(c.question.id); approved++;
  }
  if(job.candidates.every(c=>c.approvedAt || !c.qa.passed)) job.status='completed';
  job.updatedAt=now; await repo.saveFactoryJob(job); return {job,approved};
}

import { FactoryCandidate, FactoryQaIssue } from './factory-domain';
import { runQuestionQa } from './qa';

const jp = /[ぁ-んァ-ヶ一-龯]/;

export function runFactoryQa(candidate: Omit<FactoryCandidate,'qa'>): FactoryCandidate['qa'] {
  const base = runQuestionQa(candidate.question);
  const issues: FactoryQaIssue[] = base.issues.map(i=>({...i,category:i.code==='audio_required'?'audio':'schema'}));
  const q = candidate.question;

  if (!jp.test(q.prompt) && !jp.test(q.choices.join(' '))) issues.push({code:'schema',severity:'error',category:'language',message:'Question should contain Japanese content.'});
  if (q.choices.length > 5) issues.push({code:'choice_count',severity:'warning',category:'jft_style',message:'More than 5 choices is unusual for this simulator blueprint.'});
  const lengths=q.choices.map(x=>x.trim().length).filter(Boolean);
  if(lengths.length>1 && Math.max(...lengths) > Math.max(6, Math.min(...lengths)*3.5)) issues.push({code:'schema',severity:'warning',category:'pedagogy',message:'One option is much longer than the others and may reveal the answer.'});
  if (q.type==='audio_choice' && candidate.audioScript?.trim() && !q.audioSrc) issues.push({code:'audio_render',severity:'error',category:'audio',message:'Listening audio script must be rendered to an audio asset before approval.'});
  if (q.type==='audio_choice' && !candidate.audioScript?.trim()) issues.push({code:'audio_required',severity:'error',category:'audio',message:'Listening candidate requires an audio script.'});
  if (q.tags.length===0) issues.push({code:'schema',severity:'warning',category:'pedagogy',message:'At least one topic/can-do tag is recommended.'});
  if(candidate.semanticQa){
    issues.push(...candidate.semanticQa.issues);
    if(!candidate.semanticQa.passed) issues.push({code:'semantic_alignment',severity:'error',category:'pedagogy',message:`Semantic QA did not pass (${candidate.semanticQa.score}/100).`});
  }

  const errors=issues.filter(i=>i.severity==='error').length;
  const warnings=issues.filter(i=>i.severity==='warning').length;
  const semanticPenalty=candidate.semanticQa?Math.max(0,80-candidate.semanticQa.score)/4:0;
  const score=Math.max(0,Math.round(100-errors*35-warnings*8-semanticPenalty));
  return {passed:errors===0,score,issues};
}

import type { FactoryCandidate, FactoryQaIssue, FactoryRequest } from './factory-domain';

export interface SemanticQaResult {
  score: number;
  passed: boolean;
  summary: string;
  issues: FactoryQaIssue[];
  provider: string;
  model?: string;
}

export interface SemanticQaProvider {
  name: string;
  model?: string;
  review(candidate: Omit<FactoryCandidate,'qa'>, request: FactoryRequest): Promise<SemanticQaResult>;
}

function keywordScore(text:string, topic:string, canDo?:string){
  const terms=[topic,...(canDo||'').split(/[\s、。・,/]+/)].map(x=>x.trim()).filter(x=>x.length>=2);
  if(!terms.length) return 1;
  const hits=terms.filter(t=>text.includes(t)).length;
  return Math.min(1,0.45+hits/Math.max(terms.length,1));
}

class MockSemanticQaProvider implements SemanticQaProvider {
  name='mock-semantic'; model='heuristic-v1';
  async review(candidate:Omit<FactoryCandidate,'qa'>, request:FactoryRequest):Promise<SemanticQaResult>{
    const q=candidate.question;
    const text=[q.instruction,q.prompt,q.choices.join(' '),candidate.audioScript||''].join(' ');
    const issues:FactoryQaIssue[]=[];
    const relevance=keywordScore(text,request.topic,request.canDo);
    if(relevance<0.7) issues.push({code:'semantic_alignment',severity:'warning',category:'pedagogy',message:'Topic/Can-do alignment appears weak.'});
    if(q.choices[q.answer]?.trim().length===0) issues.push({code:'semantic_alignment',severity:'error',category:'pedagogy',message:'Correct answer is empty.'});
    if(request.section==='listening' && !candidate.audioScript?.trim()) issues.push({code:'audio_required',severity:'error',category:'audio',message:'Listening candidate has no audio script for semantic review.'});
    const score=Math.max(0,Math.round(92-(1-relevance)*35-issues.filter(i=>i.severity==='error').length*30-issues.filter(i=>i.severity==='warning').length*8));
    return {score,passed:issues.every(i=>i.severity!=='error')&&score>=65,summary:score>=85?'Strong alignment':score>=65?'Usable with review':'Needs revision',issues,provider:this.name,model:this.model};
  }
}

class HttpSemanticQaProvider implements SemanticQaProvider {
  name='http-semantic'; model=process.env.AI_QA_MODEL || process.env.AI_FACTORY_MODEL || 'external';
  async review(candidate:Omit<FactoryCandidate,'qa'>, request:FactoryRequest):Promise<SemanticQaResult>{
    const endpoint=process.env.AI_QA_ENDPOINT || process.env.AI_FACTORY_ENDPOINT;
    if(!endpoint) throw new Error('AI_QA_ENDPOINT or AI_FACTORY_ENDPOINT is required for semantic QA.');
    const res=await fetch(endpoint,{method:'POST',headers:{'content-type':'application/json',...(process.env.AI_QA_API_KEY||process.env.AI_FACTORY_API_KEY?{authorization:`Bearer ${process.env.AI_QA_API_KEY||process.env.AI_FACTORY_API_KEY}`}:{})},body:JSON.stringify({task:'jft_semantic_qa',promptVersion:'v5.1-semantic',request,candidate:{question:candidate.question,audioScript:candidate.audioScript}})});
    if(!res.ok) throw new Error(`Semantic QA provider failed: ${res.status}`);
    const json=await res.json() as Partial<SemanticQaResult>;
    const score=Number(json.score);
    if(!Number.isFinite(score)) throw new Error('Semantic QA response requires numeric score.');
    return {score:Math.max(0,Math.min(100,Math.round(score))),passed:json.passed!==false && score>=65,summary:String(json.summary||''),issues:Array.isArray(json.issues)?json.issues:[],provider:this.name,model:this.model};
  }
}

export function getSemanticQaProvider():SemanticQaProvider {
  return process.env.AI_QA_PROVIDER==='http' ? new HttpSemanticQaProvider() : new MockSemanticQaProvider();
}
export function semanticQaProviderMode(){return process.env.AI_QA_PROVIDER==='http'?'http':'mock';}

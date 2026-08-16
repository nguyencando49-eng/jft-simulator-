import { textSimilarity } from './duplicate-detection';
const normalizeText=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
export interface SimilarityMatch {kind:'source'|'bank'|'batch';id:string;score:number;}
export interface SimilarityReport {passed:boolean;threshold:number;best?:SimilarityMatch;matches:SimilarityMatch[];algorithm:'ngram-jaccard-v1';}
export function checkSourceSimilarity(candidate:string|string[],inputs:{source:Array<{id:string;text:string}>;bank?:Array<{id:string;text:string}>;batch?:Array<{id:string;text:string}>},threshold=Number(process.env.SOURCE_SIMILARITY_THRESHOLD||.72)):SimilarityReport{
  if(!Number.isFinite(threshold)||threshold<=0||threshold>1)threshold=.72;
  const parts=(Array.isArray(candidate)?candidate:[candidate]).map(normalizeText).filter(Boolean);
  const compare=(kind:SimilarityMatch['kind'],xs:Array<{id:string;text:string}>)=>xs.map(x=>({kind,id:x.id,score:Math.max(0,...parts.map(part=>textSimilarity(part,normalizeText(x.text))))}));
  const matches=[...compare('source',inputs.source),...compare('bank',inputs.bank||[]),...compare('batch',inputs.batch||[])].sort((a,b)=>b.score-a.score);
  return {passed:!matches[0]||matches[0].score<threshold,threshold,best:matches[0],matches:matches.filter(x=>x.score>=threshold),algorithm:'ngram-jaccard-v1'};
}

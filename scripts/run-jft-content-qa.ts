import { mkdir,writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { completeProductionQuestionSet } from '../data/production/mass-question-candidates';
import { curriculumCatalog } from '../data/production/curriculum-catalog';
import { textSimilarity } from '../lib/server/duplicate-detection';
import { DeterministicJftContentQaJudge,type QaQuestion,JFT_CONTENT_QA_VERSION } from '../lib/server/jft-content-qa-agent';

const questions=completeProductionQuestionSet as QaQuestion[];
const maximumDuplicate=new Map(questions.map(q=>[q.id,0]));
for(let i=0;i<questions.length;i++)for(let j=i+1;j<questions.length;j++){
  const score=textSimilarity(questions[i].prompt,questions[j].prompt);
  if(score>maximumDuplicate.get(questions[i].id)!)maximumDuplicate.set(questions[i].id,score);
  if(score>maximumDuplicate.get(questions[j].id)!)maximumDuplicate.set(questions[j].id,score);
}
const units=new Map(curriculumCatalog.map(unit=>[unit.id,unit]));
const judge=new DeterministicJftContentQaJudge();
const results=questions.map(question=>judge.judge(question,{
  unit:(question.knowledgeUnitIds||[]).map(id=>units.get(id)).find(Boolean),
  audioAvailable:question.section!=='listening'||!!question.audioSrc&&existsSync(join(process.cwd(),'public',question.audioSrc.replace(/^\//,''))),
  duplicateSimilarityScore:maximumDuplicate.get(question.id),
}));
const verdicts={PASS:0,REVIEW:0,FAIL:0};for(const result of results)verdicts[result.verdict]++;
const hardFails=results.filter(result=>result.hardFail).length;
const issueCounts=Object.entries(results.flatMap(result=>result.issues).reduce<Record<string,number>>((counts,item)=>{counts[item.code]=(counts[item.code]||0)+1;return counts;},{})).sort((a,b)=>b[1]-a[1]);
const byLevel=Object.fromEntries(['A1','A2.1','A2.2'].map(level=>[level,{PASS:results.filter((result,index)=>questions[index].level===level&&result.verdict==='PASS').length,REVIEW:results.filter((result,index)=>questions[index].level===level&&result.verdict==='REVIEW').length,FAIL:results.filter((result,index)=>questions[index].level===level&&result.verdict==='FAIL').length}]));
const report={qaVersion:JFT_CONTENT_QA_VERSION,judge:judge.name,generatedAt:new Date().toISOString(),questionCount:questions.length,summary:{verdicts,hardFails,eligibleForQuestionBank:results.filter(result=>result.release.eligibleForQuestionBank).length,byLevel,topIssues:issueCounts.slice(0,20)},results};
await mkdir(join(process.cwd(),'data','qa'),{recursive:true});
await writeFile(join(process.cwd(),'data','qa','jft-content-qa-v1-report.json'),JSON.stringify(report,null,2),'utf8');
console.log(JSON.stringify(report.summary,null,2));

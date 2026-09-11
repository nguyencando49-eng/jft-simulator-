import { expect, test, type Page } from '@playwright/test';
import { readFileSync } from 'node:fs';

const expectedCommit='dc3fc90699c85f8de0b2c01d8e802d2ff827a36d';
const expectedHash='3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079';
const baseUrl=process.env.PREVIEW_URL || 'https://jft-simulator-7k0s2pl8b-jft-simiulator.vercel.app';
const requiredEnv=[
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_CANDIDATE_EMAIL',
  'E2E_CANDIDATE_PASSWORD',
] as const;

type FrozenQuestion={
  questionId:string;
  snapshot:{id:string;section:string;prompt:string;choices:string[];answer:number;audioSrc?:string};
  canonicalSnapshot?:{choices:string[];answer:number};
  choicePermutation?:{permutation:number[];displayAnswerIndex:number};
};
type ExamVersion={id:string;questions:FrozenQuestion[]};

const manifest=JSON.parse(readFileSync('data/production/releases/a1-machine-bank-v1.manifest.json','utf8')) as {questionCount:number;releaseBankHash:string;questionIds:string[]};
const releaseIds=new Set(manifest.questionIds);
const evidence={
  env:Object.fromEntries(requiredEnv.map(name=>[name,process.env[name]?'PRESENT':'MISSING'])),
  previewCommit: expectedCommit,
  vercelBypass:false,
  adminAuth:false,
  candidateAuth:false,
  adminRole:'',
  candidateRole:'',
  releaseBankLoad:false,
  releaseIdentity:{count:manifest.questionCount,hash:manifest.releaseBankHash,expectedHash,hashPass:manifest.releaseBankHash===expectedHash},
  forms:[] as Array<Record<string,unknown>>,
  perfectScore:{} as Record<string,unknown>,
  wrongScore:{} as Record<string,unknown>,
  abcd:{} as Record<string,unknown>,
  refreshResume:{} as Record<string,unknown>,
  uiListening:{} as Record<string,unknown>,
  consoleErrors:[] as string[],
  apiErrors:[] as string[],
};

class Client {
  private cookies=new Map<string,string>();
  setCookies(setCookie:string|null) {
    if(!setCookie) return;
    for(const part of setCookie.split(/, (?=[^ ;]+=)/)){
      const pair=part.split(';')[0];
      const index=pair.indexOf('=');
      if(index>0) this.cookies.set(pair.slice(0,index),pair.slice(index+1));
    }
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([key,value])=>`${key}=${value}`).join('; ');
  }
  async request(method:string,path:string,data?:unknown,withBypassHeader=false) {
    const headers:Record<string,string>={};
    if(data!==undefined) headers['content-type']='application/json';
    if(this.cookies.size) headers.cookie=this.cookieHeader();
    headers['x-vercel-protection-bypass']=process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '';
    if(withBypassHeader) headers['x-vercel-set-bypass-cookie']='true';
    const response=await fetch(`${baseUrl}${path}`,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
    this.setCookies(response.headers.get('set-cookie'));
    const text=await response.text();
    let json:unknown;
    try { json=JSON.parse(text); } catch { json={raw:text}; }
    if(!response.ok) throw new Error(`${method} ${path} ${response.status} ${text.slice(0,300)}`);
    return json as any;
  }
}

function missingEnv(){return requiredEnv.filter(name=>!process.env[name]);}
async function login(client:Client,email:string,password:string){
  return client.request('POST','/api/v1/auth/login',{email,password});
}
async function saveDraft(client:Client,examId:string){
  const draft={id:examId,title:'A1 Preview Final E2E',durationMinutes:60,status:'draft',rules:[
    {section:'script_vocabulary',levels:['A1'],count:13,allowBack:true},
    {section:'conversation_expression',levels:['A1'],count:12,allowBack:true},
    {section:'listening',levels:['A1'],count:13,allowBack:false},
    {section:'reading',levels:['A1'],count:12,allowBack:true},
  ]};
  await client.request('PUT','/api/v1/exams',draft);
}
async function createVersion(client:Client,examId:string){
  const payload=await client.request('POST','/api/v1/exams',{examId});
  return payload.version as ExamVersion;
}
function validateVersion(version:ExamVersion){
  const counts:Record<string,number>={};
  const answers=[0,0,0,0];
  const seen=new Set<string>();
  let duplicate=0,outside=0,permutationMismatch=0,missingPermutation=0;
  for(const q of version.questions){
    counts[q.snapshot.section]=(counts[q.snapshot.section]||0)+1;
    if(seen.has(q.questionId)) duplicate++;
    seen.add(q.questionId);
    if(!releaseIds.has(q.questionId)) outside++;
    answers[q.snapshot.answer]++;
    if(!q.canonicalSnapshot||!q.choicePermutation) missingPermutation++;
    else if(q.choicePermutation.permutation[q.snapshot.answer]!==q.canonicalSnapshot.answer || q.snapshot.answer!==q.choicePermutation.displayAnswerIndex || q.snapshot.choices[q.snapshot.answer]!==q.canonicalSnapshot.choices[q.canonicalSnapshot.answer]) permutationMismatch++;
  }
  return {questionCount:version.questions.length,counts,ce:counts.conversation_expression||0,duplicate,outside,answers,missingPermutation,permutationMismatch};
}
async function candidateSession(client:Client,versionId:string){
  return client.request('POST','/api/v1/sessions',{examVersionId:versionId});
}
async function answerAll(client:Client,sessionId:string,questions:FrozenQuestion[],answerOf:(q:FrozenQuestion,index:number)=>number,startIndex=0){
  for(let i=0;i<questions.length;i++){
    const q=questions[i];
    await client.request('PUT',`/api/v1/sessions/${sessionId}/answers`,{questionId:q.questionId,choice:answerOf(q,i),currentIndex:startIndex+i});
  }
}
async function submit(client:Client,sessionId:string){
  const payload=await client.request('POST',`/api/v1/sessions/${sessionId}/submit`);
  return payload.result;
}
async function verifyUi(page:Page,client:Client,versionId:string){
  const host=new URL(baseUrl).hostname;
  for(const cookie of client.cookieHeader().split('; ').filter(Boolean)){
    const index=cookie.indexOf('=');
    await page.context().addCookies([{name:cookie.slice(0,index),value:cookie.slice(index+1),domain:host,path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  }
  page.on('console',message=>{ if(message.type()==='error') evidence.consoleErrors.push(message.text().slice(0,300)); });
  page.on('response',response=>{ if(response.status()>=500) evidence.apiErrors.push(`${response.status()} ${response.url()}`); });
  await page.setExtraHTTPHeaders({'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''});
  await page.goto('/candidate');
  await expect(page.locator('body')).not.toContainText('Vercel Authentication');
  await expect(page.locator('body')).not.toContainText('undefined');
  await page.goto('/exam');
  await expect(page.locator('body')).not.toContainText('[object Object]');
  evidence.uiListening={candidatePageReached:true,examPageReached:true,versionId};
}

test('final A1 preview E2E through local Playwright', async ({ page }) => {
  expect(missingEnv(),`Missing env: ${missingEnv().join(', ')}`).toEqual([]);
  const admin=new Client();
  const candidate=new Client();
  await admin.request('GET','/api/v1/system');
  await candidate.request('GET','/api/v1/system');
  evidence.vercelBypass=true;

  await login(admin,process.env.E2E_ADMIN_EMAIL!,process.env.E2E_ADMIN_PASSWORD!);
  const adminMe=await admin.request('GET','/api/v1/auth/me');
  evidence.adminAuth=adminMe.ok;
  evidence.adminRole=adminMe.user?.role;
  expect(adminMe.user.role).toBe('admin');

  const examId=`A1-PREVIEW-FINAL-E2E-${Date.now()}`;
  await saveDraft(admin,examId);
  const versions:ExamVersion[]=[];
  for(let i=0;i<10;i++) versions.push(await createVersion(admin,examId));
  evidence.releaseBankLoad=true;
  for(const version of versions){
    const v=validateVersion(version);
    evidence.forms.push({id:version.id,...v});
    expect(v.questionCount).toBe(50);
    expect(v.ce).toBe(12);
    expect(v.duplicate).toBe(0);
    expect(v.outside).toBe(0);
    expect(v.missingPermutation).toBe(0);
    expect(v.permutationMismatch).toBe(0);
  }

  await login(candidate,process.env.E2E_CANDIDATE_EMAIL!,process.env.E2E_CANDIDATE_PASSWORD!);
  const candidateMe=await candidate.request('GET','/api/v1/auth/me');
  evidence.candidateAuth=candidateMe.ok;
  evidence.candidateRole=candidateMe.user?.role;
  expect(candidateMe.user.role).toBe('candidate');

  const perfect=await candidateSession(candidate,versions[0].id);
  await answerAll(candidate,perfect.session.id,versions[0].questions,q=>q.snapshot.answer);
  const perfectResult=await submit(candidate,perfect.session.id);
  evidence.perfectScore={correct:perfectResult.correct,total:perfectResult.total,scorePercent:perfectResult.scorePercent};
  expect(perfectResult.correct).toBe(50);
  expect(perfectResult.total).toBe(50);
  expect(perfectResult.scorePercent).toBe(100);

  const wrongCount=7;
  const wrong=await candidateSession(candidate,versions[1].id);
  await answerAll(candidate,wrong.session.id,versions[1].questions,(q,i)=>i<wrongCount?(q.snapshot.answer+1)%q.snapshot.choices.length:q.snapshot.answer);
  const wrongResult=await submit(candidate,wrong.session.id);
  evidence.wrongScore={expectedCorrect:50-wrongCount,correct:wrongResult.correct,total:wrongResult.total,scorePercent:wrongResult.scorePercent};
  expect(wrongResult.correct).toBe(50-wrongCount);

  const positions=new Map<number,FrozenQuestion>();
  for(const version of versions) for(const q of version.questions) if(!positions.has(q.snapshot.answer)) positions.set(q.snapshot.answer,q);
  evidence.abcd=Object.fromEntries([...positions.entries()].map(([k,q])=>['ABCD'[k],q.questionId]));
  expect([...positions.keys()].sort()).toEqual([0,1,2,3]);

  const resume=await candidateSession(candidate,versions[2].id);
  const firstFive=versions[2].questions.slice(0,5);
  await answerAll(candidate,resume.session.id,firstFive,q=>q.snapshot.answer);
  await page.goto('/');
  await page.reload();
  const resumed=await candidate.request('GET',`/api/v1/sessions/${resume.session.id}`);
  evidence.refreshResume={
    sameExam:resumed.exam.id===versions[2].id,
    sameQuestionOrder:resumed.exam.questions.map((q:{id:string})=>q.id).join('|')===versions[2].questions.map(q=>q.questionId).join('|'),
    savedAnswers:Object.keys(resumed.session.answers).length,
  };
  expect(evidence.refreshResume.sameExam).toBe(true);
  expect(evidence.refreshResume.sameQuestionOrder).toBe(true);
  expect(evidence.refreshResume.savedAnswers).toBe(5);
  await answerAll(candidate,resume.session.id,versions[2].questions.slice(5),q=>q.snapshot.answer,5);
  const resumeResult=await submit(candidate,resume.session.id);
  expect(resumeResult.correct).toBe(50);

  await verifyUi(page,candidate,versions[0].id);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.apiErrors).toEqual([]);

  console.log(`A1_PREVIEW_E2E_EVIDENCE=${JSON.stringify(evidence)}`);
});

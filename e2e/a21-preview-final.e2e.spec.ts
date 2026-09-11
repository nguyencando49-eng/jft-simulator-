import {expect,test,type Page} from '@playwright/test';
import {readFileSync} from 'node:fs';

const baseUrl=process.env.PREVIEW_URL || '';
const requiredEnv=[
  'PREVIEW_URL',
  'VERCEL_AUTOMATION_BYPASS_SECRET',
  'E2E_ADMIN_EMAIL',
  'E2E_ADMIN_PASSWORD',
  'E2E_CANDIDATE_EMAIL',
  'E2E_CANDIDATE_PASSWORD',
] as const;

type FrozenQuestion={
  questionId:string;
  snapshot:{id:string;level:string;section:string;prompt:string;choices:string[];answer:number;audioSrc?:string};
  canonicalSnapshot?:{choices:string[];answer:number};
  choicePermutation?:{permutation:number[];displayAnswerIndex:number};
};
type ExamVersion={id:string;questions:FrozenQuestion[]};

const releaseBank=JSON.parse(readFileSync('data/production/releases/a21-machine-bank-v1.json','utf8')) as {questionCount:number;questions:Array<{id:string;section:string}>};
const manifest=JSON.parse(readFileSync('data/production/releases/a21-machine-bank-v1.manifest.json','utf8')) as {releaseBankHash:string;questionCount:number;counts:{sections:Record<string,number>}};
const releaseIds=new Set(releaseBank.questions.map(q=>q.id));

class Client {
  private cookies=new Map<string,string>();
  setCookies(setCookie:string|null) {
    if(!setCookie) return;
    for(const part of setCookie.split(/, (?=[^ ;]+=)/)) {
      const pair=part.split(';')[0];
      const index=pair.indexOf('=');
      if(index>0) this.cookies.set(pair.slice(0,index),pair.slice(index+1));
    }
  }
  cookieHeader() {
    return [...this.cookies.entries()].map(([key,value])=>`${key}=${value}`).join('; ');
  }
  async request(method:string,path:string,data?:unknown,withBypassCookie=false) {
    const headers:Record<string,string>={
      'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET || '',
    };
    if(withBypassCookie) headers['x-vercel-set-bypass-cookie']='true';
    if(data!==undefined) headers['content-type']='application/json';
    if(this.cookies.size) headers.cookie=this.cookieHeader();
    const response=await fetch(`${baseUrl}${path}`,{method,headers,body:data===undefined?undefined:JSON.stringify(data)});
    this.setCookies(response.headers.get('set-cookie'));
    const text=await response.text();
    let json:unknown;
    try { json=JSON.parse(text); } catch { json={raw:text}; }
    if(!response.ok) throw new Error(`${method} ${path} ${response.status} ${text.slice(0,300)}`);
    return json as any;
  }
}

function missingEnv() {
  return requiredEnv.filter(name=>!process.env[name]);
}

async function login(client:Client,email:string,password:string) {
  await client.request('POST','/api/v1/auth/login',{email,password});
  return client.request('GET','/api/v1/auth/me');
}

async function saveA21Draft(client:Client,examId:string) {
  await client.request('PUT','/api/v1/exams',{
    id:examId,
    title:'A2.1 Preview Final E2E',
    durationMinutes:60,
    status:'draft',
    rules:[
      {section:'script_vocabulary',levels:['A2.1'],count:13,allowBack:true},
      {section:'conversation_expression',levels:['A2.1'],count:12,allowBack:true},
      {section:'listening',levels:['A2.1'],count:13,allowBack:false},
      {section:'reading',levels:['A2.1'],count:12,allowBack:true},
    ],
  });
}

function validateVersion(version:ExamVersion) {
  const counts:Record<string,number>={};
  const answers=[0,0,0,0];
  const seen=new Set<string>();
  let duplicate=0,outside=0,a1Leakage=0,missingPermutation=0,permutationMismatch=0,missingListeningScript=0,missingListeningAudio=0;
  for(const q of version.questions) {
    counts[q.snapshot.section]=(counts[q.snapshot.section]||0)+1;
    answers[q.snapshot.answer]+=1;
    if(seen.has(q.questionId)) duplicate+=1;
    seen.add(q.questionId);
    if(!releaseIds.has(q.questionId)) outside+=1;
    if(q.snapshot.level!=='A2.1') a1Leakage+=1;
    if(!q.canonicalSnapshot || !q.choicePermutation) missingPermutation+=1;
    else if(q.choicePermutation.permutation[q.snapshot.answer]!==q.canonicalSnapshot.answer || q.snapshot.answer!==q.choicePermutation.displayAnswerIndex || q.snapshot.choices[q.snapshot.answer]!==q.canonicalSnapshot.choices[q.canonicalSnapshot.answer]) permutationMismatch+=1;
    if(q.snapshot.section==='listening') {
      if(!q.snapshot.prompt.includes('音声スクリプト')) missingListeningScript+=1;
      if(!q.snapshot.audioSrc) missingListeningAudio+=1;
    }
  }
  return {questionCount:version.questions.length,counts,answers,duplicate,outside,a1Leakage,missingPermutation,permutationMismatch,missingListeningScript,missingListeningAudio};
}

async function answerAll(client:Client,sessionId:string,questions:FrozenQuestion[],answerOf:(q:FrozenQuestion,index:number)=>number,startIndex=0) {
  for(let index=0;index<questions.length;index+=1) {
    const q=questions[index];
    await client.request('PUT',`/api/v1/sessions/${sessionId}/answers`,{questionId:q.questionId,choice:answerOf(q,index),currentIndex:startIndex+index});
  }
}

async function submit(client:Client,sessionId:string) {
  return (await client.request('POST',`/api/v1/sessions/${sessionId}/submit`)).result;
}

async function uiSmoke(page:Page,client:Client,evidence:{consoleErrors:string[];apiErrors:string[]}) {
  const host=new URL(baseUrl).hostname;
  for(const cookie of client.cookieHeader().split('; ').filter(Boolean)) {
    const index=cookie.indexOf('=');
    await page.context().addCookies([{name:cookie.slice(0,index),value:cookie.slice(index+1),domain:host,path:'/',httpOnly:true,secure:true,sameSite:'Lax'}]);
  }
  page.on('console',message=>{if(message.type()==='error') evidence.consoleErrors.push(message.text().slice(0,300));});
  page.on('response',response=>{if(response.status()>=500) evidence.apiErrors.push(`${response.status()} ${response.url()}`);});
  await page.setExtraHTTPHeaders({'x-vercel-protection-bypass':process.env.VERCEL_AUTOMATION_BYPASS_SECRET || ''});
  await page.goto('/candidate');
  await expect(page.locator('body')).not.toContainText('Vercel Authentication');
  await expect(page.locator('body')).not.toContainText('undefined');
  await page.goto('/exam');
  await expect(page.locator('body')).not.toContainText('[object Object]');
}

test('A2.1 preview release E2E',async({page})=>{
  expect(missingEnv(),`Missing env: ${missingEnv().join(', ')}`).toEqual([]);
  expect(releaseBank.questionCount).toBe(334);
  expect(manifest.questionCount).toBe(334);
  expect(manifest.releaseBankHash).toBe('698860254d6a7a50e33aa214b4e908fce4de7cc8a789a9c185dba056ead069d7');

  const evidence={forms:[] as unknown[],consoleErrors:[] as string[],apiErrors:[] as string[]};
  const admin=new Client();
  const candidate=new Client();
  await admin.request('GET','/api/v1/system',undefined,true);

  const adminMe=await login(admin,process.env.E2E_ADMIN_EMAIL!,process.env.E2E_ADMIN_PASSWORD!);
  expect(adminMe.user.role).toBe('admin');
  const candidateMe=await login(candidate,process.env.E2E_CANDIDATE_EMAIL!,process.env.E2E_CANDIDATE_PASSWORD!);
  expect(candidateMe.user.role).toBe('candidate');

  const examId=`A21-PREVIEW-E2E-${Date.now()}`;
  await saveA21Draft(admin,examId);
  const versions:ExamVersion[]=[];
  for(let index=0;index<10;index+=1) {
    const payload=await admin.request('POST','/api/v1/exams',{examId});
    expect(payload.release).toMatchObject({source:'release',level:'A2.1',version:'a21-machine-bank-v1',hash:manifest.releaseBankHash});
    versions.push(payload.version);
  }

  for(const version of versions) {
    const result=validateVersion(version);
    evidence.forms.push({id:version.id,...result});
    expect(result.questionCount).toBe(50);
    expect(result.counts).toEqual({script_vocabulary:13,conversation_expression:12,listening:13,reading:12});
    expect(result.duplicate).toBe(0);
    expect(result.outside).toBe(0);
    expect(result.a1Leakage).toBe(0);
    expect(result.missingPermutation).toBe(0);
    expect(result.permutationMismatch).toBe(0);
    expect(result.missingListeningScript).toBe(0);
    expect(result.missingListeningAudio).toBe(0);
  }

  const perfectSession=await candidate.request('POST','/api/v1/sessions',{examVersionId:versions[0].id});
  await answerAll(candidate,perfectSession.session.id,versions[0].questions,q=>q.snapshot.answer);
  const perfect=await submit(candidate,perfectSession.session.id);
  expect(perfect.correct).toBe(50);
  expect(perfect.scorePercent).toBe(100);

  const wrongCount=7;
  const wrongSession=await candidate.request('POST','/api/v1/sessions',{examVersionId:versions[1].id});
  await answerAll(candidate,wrongSession.session.id,versions[1].questions,(q,index)=>index<wrongCount?(q.snapshot.answer+1)%4:q.snapshot.answer);
  const wrong=await submit(candidate,wrongSession.session.id);
  expect(wrong.correct).toBe(50-wrongCount);

  const positions=new Set(versions.flatMap(version=>version.questions.map(q=>q.snapshot.answer)));
  expect([...positions].sort()).toEqual([0,1,2,3]);

  const resumeSession=await candidate.request('POST','/api/v1/sessions',{examVersionId:versions[2].id});
  await answerAll(candidate,resumeSession.session.id,versions[2].questions.slice(0,5),q=>q.snapshot.answer);
  await page.goto('/');
  await page.reload();
  const resumed=await candidate.request('GET',`/api/v1/sessions/${resumeSession.session.id}`);
  expect(resumed.exam.id).toBe(versions[2].id);
  expect(resumed.exam.questions.map((q:{id:string})=>q.id)).toEqual(versions[2].questions.map(q=>q.questionId));
  expect(Object.keys(resumed.session.answers)).toHaveLength(5);

  await uiSmoke(page,candidate,evidence);
  expect(evidence.consoleErrors).toEqual([]);
  expect(evidence.apiErrors).toEqual([]);
  console.log(`A21_PREVIEW_E2E_EVIDENCE=${JSON.stringify(evidence)}`);
});

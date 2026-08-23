import { chromium, expect } from '@playwright/test';

const base=(process.env.PRODUCTION_URL||'https://jft-simulator.vercel.app').replace(/\/$/,'');
const token=process.env.PRODUCTION_SMOKE_TOKEN;
if(!token)throw new Error('PRODUCTION_SMOKE_TOKEN is required.');
const headers={'x-jft-production-smoke-token':token};
const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:390,height:844}});
  const page=await context.newPage();
  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('link',{name:'Bắt đầu luyện tập'}).first()).toBeVisible();
  await page.goto(`${base}/candidate`);
  await expect(page.getByText(/Chào Production Smoke/)).toBeVisible({timeout:20_000});
  const cards=page.getByTestId('candidate-exam-card');
  await expect.poll(()=>cards.count(),{timeout:20_000}).toBeGreaterThanOrEqual(5);
  for(let index=1;index<=5;index++)await expect(page.getByRole('heading',{name:`JFT Practice A1 — Đề ${String(index).padStart(2,'0')}`})).toBeVisible();

  for(const path of ['/audio/sample-01.wav','/audio/li-003.wav','/audio/li-004.wav','/audio/li-005.wav']){
    const response=await context.request.get(`${base}${path}`);
    if(!response.ok())throw new Error(`${path} returned ${response.status()}.`);
    if((await response.body()).byteLength<1_000)throw new Error(`${path} is unexpectedly small.`);
    if(!response.headers()['content-type']?.startsWith('audio/'))throw new Error(`${path} has invalid content type.`);
  }

  await cards.filter({hasText:'JFT Practice A1 — Đề 01'}).getByRole('link',{name:/^(Bắt đầu|Làm lại)$/}).click();
  await expect(page.getByRole('heading',{name:'Hướng dẫn làm bài'})).toBeVisible();
  await page.getByRole('button',{name:'Kiểm tra âm thanh'}).click();
  await expect(page.locator('audio')).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu làm bài'}).click();
  await page.getByRole('button',{name:'Bắt đầu phần này'}).click();
  await expect(page.getByText(/Câu 1 \/ 2/)).toBeVisible();

  const answer=async()=>{await page.getByRole('radio').first().check();await expect(page.getByText('Đã lưu tự động')).toBeVisible({timeout:10_000});};
  const next=async()=>{await page.getByRole('button',{name:/^(Tiếp theo|Kiểm tra & nộp)$/}).click();const confirm=page.getByRole('button',{name:'Tiếp tục'});if(await confirm.isVisible().catch(()=>false))await confirm.click();const begin=page.getByRole('button',{name:'Bắt đầu phần này'});if(await begin.isVisible().catch(()=>false))await begin.click();};
  await answer();
  await page.reload();
  await expect(page.getByRole('radio').first()).toBeChecked({timeout:20_000});
  const attemptsResponse=await context.request.get(`${base}/api/v1/sessions`);
  const attemptsPayload=await attemptsResponse.json() as {attempts:Array<{id:string;status:string}>};
  const active=attemptsPayload.attempts.find(item=>item.status==='active');
  if(!active)throw new Error('No active production session found after autosave.');
  const activeResponse=await context.request.get(`${base}/api/v1/sessions/${active.id}`);
  const activePayload=await activeResponse.json() as {exam:{questions:Array<Record<string,unknown>>};session:Record<string,unknown>};
  for(const question of activePayload.exam.questions)for(const forbidden of ['answer','explanationVi','contentQa','answerOracleQa','provider'])if(forbidden in question)throw new Error(`Active API leaked ${forbidden}.`);
  if('candidateId' in activePayload.session)throw new Error('Active API leaked candidateId.');

  let audioPlayed=false;
  for(let index=1;index<8;index++){
    await next();
    const play=page.getByRole('button',{name:'Phát âm thanh'});
    if(await play.isVisible().catch(()=>false)&&!audioPlayed){await play.click();await expect(page.getByText('Còn 1 / 2 lượt')).toBeVisible();audioPlayed=true;}
    await answer();
  }
  if(!audioPlayed)throw new Error('No Listening audio was exercised.');
  await next();
  await expect(page.getByRole('heading',{name:'Nộp bài luyện tập?'})).toBeVisible();
  await page.getByRole('button',{name:'Nộp bài'}).click();
  await expect(page).toHaveURL(/\/result\?sessionId=/,{timeout:20_000});
  await expect(page.getByTestId('answer-review')).toBeVisible();
  const submittedId=new URL(page.url()).searchParams.get('sessionId');
  if(!submittedId)throw new Error('Submitted session ID is missing.');
  const repeated=await context.request.post(`${base}/api/v1/sessions/${submittedId}/submit`);
  const repeatedPayload=await repeated.json() as {alreadySubmitted?:boolean};
  if(!repeated.ok()||!repeatedPayload.alreadySubmitted)throw new Error('Repeated submit was not idempotent.');
  await page.goto(`${base}/candidate`);
  await expect(page.getByText('Lịch sử gần đây')).toBeVisible();
  await expect(page.getByText('Hoàn thành').first()).toBeVisible();
  console.log(JSON.stringify({status:'PASS',base,examCards:await cards.count(),audioAssets:4,autosaveResume:true,listening:true,answerReview:true,idempotentSubmit:true,history:true},null,2));
}finally{
  await browser.close();
}

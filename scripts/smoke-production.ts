import { chromium, expect } from '@playwright/test';

const base=(process.env.PRODUCTION_URL||'https://jft-simulator.vercel.app').replace(/\/$/,'');
const token=process.env.PRODUCTION_SMOKE_TOKEN;
if(!token)throw new Error('PRODUCTION_SMOKE_TOKEN is required.');
const headers={'x-jft-production-smoke-token':token};
const expected=[
  {examId:'JFT-PRACTICE-A1-001',title:'JFT Practice A1 — Đề 01',level:'A1'},
  {examId:'JFT-PRACTICE-A2-1-001',title:'JFT Practice A2.1 — Đề 01',level:'A2.1'},
  {examId:'JFT-PRACTICE-A2-2-001',title:'JFT Practice A2.2 — Đề 01',level:'A2.2'},
] as const;

const browser=await chromium.launch({headless:true});
try{
  const context=await browser.newContext({extraHTTPHeaders:headers,viewport:{width:390,height:844}});
  const page=await context.newPage();

  await page.goto(base,{waitUntil:'domcontentloaded'});
  await expect(page.getByRole('link',{name:'Vào khu luyện tập'})).toBeVisible();

  await page.goto(`${base}/candidate`);
  await expect(page.getByText(/Chào Production Smoke/)).toBeVisible({timeout:20_000});

  // Keep the synthetic smoke account reusable across runs.
  const oldAttempts=await context.request.get(`${base}/api/v1/sessions`);
  if(!oldAttempts.ok())throw new Error(`Session catalog returned ${oldAttempts.status()}.`);
  const oldPayload=await oldAttempts.json() as {attempts:Array<{id:string;status:string}>};
  for(const attempt of oldPayload.attempts.filter(item=>item.status==='active')){
    const finalized=await context.request.post(`${base}/api/v1/sessions/${encodeURIComponent(attempt.id)}/submit`);
    if(!finalized.ok())throw new Error(`Could not finalize previous smoke session ${attempt.id}.`);
  }
  await page.reload();

  const catalogResponse=await context.request.get(`${base}/api/v1/exams/published`);
  if(!catalogResponse.ok())throw new Error(`Published exam catalog returned ${catalogResponse.status()}.`);
  const catalog=await catalogResponse.json() as {versions:Array<{id:string;examId:string;title:string;level:string;durationMinutes:number;questionCount:number;sections:string[]}>};
  for(const item of expected){
    const exam=catalog.versions.find(version=>version.examId===item.examId);
    if(!exam)throw new Error(`Missing production exam ${item.examId}.`);
    if(exam.title!==item.title||exam.level!==item.level||exam.durationMinutes!==60||exam.questionCount!==48||exam.sections.length!==4)throw new Error(`Invalid production metadata for ${item.examId}.`);
    await expect(page.getByTestId('candidate-exam-card').filter({hasText:item.title})).toBeVisible();
  }

  const a1=catalog.versions.find(version=>version.examId===expected[0].examId)!;
  await page.goto(`${base}/exam?examVersionId=${encodeURIComponent(a1.id)}`);
  await expect(page.getByRole('heading',{name:'Hướng dẫn làm bài'})).toBeVisible();
  await page.getByRole('button',{name:'Kiểm tra âm thanh'}).click();
  await expect(page.locator('audio')).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu làm bài'}).click();
  await page.getByRole('button',{name:'Bắt đầu phần này'}).click();
  await expect(page.getByText(/Câu 1 \/ 12/)).toBeVisible();

  await page.getByRole('radio').first().check();
  await expect(page.getByText('Đã lưu tự động')).toBeVisible({timeout:10_000});
  await page.reload();
  await expect(page.getByText(/Câu 1 \/ 12/)).toBeVisible({timeout:20_000});
  await expect(page.getByRole('radio').first()).toBeChecked();

  const attemptsResponse=await context.request.get(`${base}/api/v1/sessions`);
  const attemptsPayload=await attemptsResponse.json() as {attempts:Array<{id:string;status:string;examVersionId:string}>};
  const active=attemptsPayload.attempts.find(item=>item.status==='active'&&item.examVersionId===a1.id);
  if(!active)throw new Error('No active Production 3000 session found after autosave.');

  const activeResponse=await context.request.get(`${base}/api/v1/sessions/${encodeURIComponent(active.id)}`);
  if(!activeResponse.ok())throw new Error(`Active session returned ${activeResponse.status()}.`);
  const activePayload=await activeResponse.json() as {exam:{questions:Array<Record<string,unknown>&{section:string;audioSrc?:string}>};session:Record<string,unknown>};
  if(activePayload.exam.questions.length!==48)throw new Error('Active production exam does not contain 48 questions.');
  for(const question of activePayload.exam.questions){
    for(const forbidden of ['answer','explanationVi','contentQa','answerOracleQa','provider'])if(forbidden in question)throw new Error(`Active API leaked ${forbidden}.`);
  }
  if('candidateId' in activePayload.session)throw new Error('Active API leaked candidateId.');

  const listeningIndex=activePayload.exam.questions.findIndex(question=>question.section==='listening');
  if(listeningIndex<0)throw new Error('Production exam has no Listening section.');
  const listening=activePayload.exam.questions[listeningIndex];
  if(!listening.audioSrc)throw new Error('Production Listening question has no audioSrc.');
  const audio=await context.request.get(`${base}${listening.audioSrc}`);
  if(!audio.ok()||(await audio.body()).byteLength<1_000||!audio.headers()['content-type']?.startsWith('audio/'))throw new Error('Production Listening audio is not playable.');

  const jump=await context.request.put(`${base}/api/v1/sessions/${encodeURIComponent(active.id)}/answers`,{data:{currentIndex:listeningIndex}});
  if(!jump.ok())throw new Error(`Could not move smoke session to Listening: ${jump.status()}.`);
  await page.reload();
  await expect(page.getByRole('button',{name:'Phát âm thanh'})).toBeVisible({timeout:20_000});
  await page.getByRole('button',{name:'Phát âm thanh'}).click();
  await expect(page.getByText('Còn 1 / 2 lượt')).toBeVisible();
  await page.getByRole('radio').first().check();
  await expect(page.getByText('Đã lưu tự động')).toBeVisible({timeout:10_000});

  const submitted=await context.request.post(`${base}/api/v1/sessions/${encodeURIComponent(active.id)}/submit`);
  if(!submitted.ok())throw new Error(`Production submit returned ${submitted.status()}.`);
  await page.goto(`${base}/result?sessionId=${encodeURIComponent(active.id)}`);
  await expect(page.getByTestId('answer-review')).toBeVisible({timeout:20_000});
  await expect(page.getByRole('heading',{name:'Xem lại đáp án'})).toBeVisible();

  const repeated=await context.request.post(`${base}/api/v1/sessions/${encodeURIComponent(active.id)}/submit`);
  const repeatedPayload=await repeated.json() as {alreadySubmitted?:boolean};
  if(!repeated.ok()||!repeatedPayload.alreadySubmitted)throw new Error('Repeated submit was not idempotent.');

  await page.goto(`${base}/candidate`);
  await expect(page.getByText('Lịch sử gần đây')).toBeVisible();
  await expect(page.getByText('Hoàn thành').first()).toBeVisible();

  console.log(JSON.stringify({
    status:'PASS',base,
    productionExams:expected.map(item=>item.examId),
    questionCount:48,questionsPerSection:12,durationMinutes:60,
    autosaveResume:true,answerLeak:false,listeningAudio:true,answerReview:true,idempotentSubmit:true,history:true,
  },null,2));
}finally{
  await browser.close();
}

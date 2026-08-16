import { expect, test, type Page } from '@playwright/test';

async function devLogin(page: Page, role: 'candidate'|'admin') {
  await page.goto('/login');
  await expect(page.getByLabel('Development role')).toBeVisible();
  await page.getByLabel('Email').fill(`e2e-${role}@local.test`);
  await page.getByLabel('Development role').selectOption(role);
  await page.getByRole('button', { name: 'Enter development session' }).click();
  await expect(page).toHaveURL(role === 'admin' ? /\/admin(?:\/|$)/ : /\/candidate(?:\/|$)/);
}

async function startCandidateExam(page: Page, durationSeconds = 120) {
  await page.context().addCookies([{name:'jft-e2e-duration-seconds',value:String(durationSeconds),url:'http://127.0.0.1:3100'}]);
  await page.goto('/exam');
  await expect(page.getByRole('heading',{name:'Test Instructions'})).toBeVisible();
  await page.getByRole('button',{name:'Continue'}).click();
  await expect(page.getByRole('heading',{name:'Audio Check'})).toBeVisible();
  await page.getByRole('button',{name:'Start Test'}).click();
  await expect(page.getByRole('button',{name:'Begin Section'})).toBeVisible();
  await page.getByRole('button',{name:'Begin Section'}).click();
  await expect(page.getByText(/Question 1 \/ 2/)).toBeVisible();
}

async function answerCurrent(page: Page, choice = 0) {
  const radios=page.getByRole('radio');
  await expect(radios.first()).toBeVisible();
  const count=await radios.count();
  await radios.nth(Math.min(choice,count-1)).check();
  await expect(page.getByText('Server synced')).toBeVisible();
}

async function moveNext(page: Page) {
  await page.getByRole('button',{name:/^(Next|Review & End)$/}).click();
  const begin=page.getByRole('button',{name:'Begin Section'});
  const sectionChanged=await begin.waitFor({state:'visible',timeout:800}).then(()=>true).catch(()=>false);
  if(sectionChanged) await begin.click();
}

test.describe.serial('JFT E2E release journeys',()=>{
  test('candidate can autosave, refresh/resume, obey Listening no-back, and submit',async({page})=>{
    await devLogin(page,'candidate');
    await startCandidateExam(page,120);

    await answerCurrent(page,0);
    // Prove account-backed resume works even without the localStorage session hint.
    await page.evaluate(()=>localStorage.clear());
    await page.reload();
    await expect(page.getByText(/Question 1 \/ 2/)).toBeVisible();
    await expect(page.getByRole('radio').first()).toBeChecked();

    // Move through Script/Vocabulary + Conversation and into Listening.
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByText('Listening Comprehension').first()).toBeVisible();
    await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByRole('button',{name:'Back'})).toBeDisabled();
    await answerCurrent(page,0);

    // Finish Reading and submit normally.
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByRole('heading',{name:'End Test?'})).toBeVisible();
    await page.getByRole('button',{name:'Submit Test'}).click();
    await expect(page).toHaveURL(/\/result\?sessionId=/);
    await expect(page.getByText(/Overall|Score|Result/i).first()).toBeVisible();
  });

  test('candidate timeout auto-finalizes saved answers and produces a result',async({page})=>{
    await devLogin(page,'candidate');
    await startCandidateExam(page,3);
    await answerCurrent(page,0);
    await expect(page).toHaveURL(/\/result\?sessionId=/,{timeout:12_000});
    await expect(page.getByText(/Overall|Score|Result/i).first()).toBeVisible();
  });

  test('admin can generate Listening, render TTS, approve, and publish an exam version',async({page})=>{
    await devLogin(page,'admin');
    await page.goto('/admin/factory');
    await expect(page.getByRole('heading',{name:/Generate → Semantic QA/})).toBeVisible();
    await page.getByLabel('Section').selectOption('listening');
    await page.getByLabel('Topic').fill(`E2E仕事-${Date.now()}`);
    await page.getByLabel('Count').fill('1');
    await page.getByRole('button',{name:'Generate candidates'}).click();
    await expect(page.getByText(/Generated 1 candidates/)).toBeVisible({timeout:15_000});
    await expect(page.getByRole('button',{name:'Render TTS audio'})).toBeVisible();
    await page.getByRole('button',{name:'Render TTS audio'}).click();
    await expect(page.getByText('Audio rendered and QA refreshed.')).toBeVisible({timeout:15_000});
    await expect(page.locator('audio')).toBeVisible();
    await page.getByRole('button',{name:/Approve selected/}).click();
    await expect(page.getByText(/Approved 1 question/)).toBeVisible({timeout:15_000});

    await page.goto('/admin/exams');
    await expect(page.getByRole('heading',{name:'Exam Builder'})).toBeVisible();
    await page.getByRole('button',{name:'Publish version'}).click();
    await expect(page.getByText(/Published JFT-MOCK-001-v\d+/)).toBeVisible({timeout:15_000});
  });

  test('admin can run source pilot into Factory Review',async({page})=>{
    await devLogin(page,'admin');
    await page.goto('/admin/sources');
    await expect(page.getByRole('heading',{name:/Source → Knowledge/})).toBeVisible();
    await page.getByRole('button',{name:'Confirm import'}).click();
    await expect(page.getByRole('heading',{name:'Hospital reception pilot'})).toBeVisible();
    await page.getByRole('button',{name:'1. Chunk'}).click();
    await expect(page.getByText(/Chunks: [1-9]/)).toBeVisible();
    await page.getByRole('button',{name:'2. Extract'}).click();
    await page.getByRole('button',{name:'Approve knowledge'}).first().click();
    await page.getByRole('button',{name:'3. Generate plan'}).click();
    await expect(page.getByText(/Plan: 4 items/)).toBeVisible();
    await page.getByRole('button',{name:'4. Generate via Existing Factory'}).click();
    await expect(page.getByText(/Candidates: 4/)).toBeVisible({timeout:20_000});
  });
});

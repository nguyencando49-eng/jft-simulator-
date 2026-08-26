import { expect, test, type Page } from '@playwright/test';

async function devLogin(page: Page, role: 'candidate'|'admin', email = `e2e-${role}@local.test`) {
  await page.goto('/login');
  await expect(page.getByLabel('Vai trò phát triển')).toBeVisible();
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Vai trò phát triển').selectOption(role);
  await page.getByRole('button', { name: 'Đăng nhập' }).click();
  await expect(page).toHaveURL(role === 'admin' ? /\/admin(?:\/|$)/ : /\/candidate(?:\/|$)/);
}

async function startCandidateExam(page: Page, durationSeconds = 120, fromCatalog = false) {
  await page.context().addCookies([{name:'jft-e2e-duration-seconds',value:String(durationSeconds),url:'http://127.0.0.1:3100'}]);
  if(fromCatalog){
    await page.getByTestId('candidate-exam-card').first().getByRole('link',{name:/^(Bắt đầu|Làm lại)$/}).click();
    await expect(page).toHaveURL(/\/exam\?examVersionId=/);
  }else await page.goto('/exam');
  await expect(page.getByRole('heading',{name:'Hướng dẫn làm bài'})).toBeVisible();
  await page.getByRole('button',{name:'Kiểm tra âm thanh'}).click();
  await expect(page.getByRole('heading',{name:'Kiểm tra âm thanh'})).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu làm bài'}).click();
  await expect(page.getByRole('button',{name:'Bắt đầu phần này'})).toBeVisible();
  await page.getByRole('button',{name:'Bắt đầu phần này'}).click();
  await expect(page.getByText(/Câu 1 \/ 2/)).toBeVisible();
}

async function answerCurrent(page: Page, choice = 0) {
  const radios=page.getByRole('radio');
  await expect(radios.first()).toBeVisible();
  const count=await radios.count();
  await radios.nth(Math.min(choice,count-1)).check();
  await expect(page.getByText('Đã lưu tự động')).toBeVisible();
}

async function moveNext(page: Page) {
  await page.getByRole('button',{name:/^(Tiếp theo|Kiểm tra & nộp)$/}).click();
  const confirm=page.getByRole('button',{name:'Tiếp tục'});if(await confirm.isVisible().catch(()=>false))await confirm.click();
  const begin=page.getByRole('button',{name:'Bắt đầu phần này'});if(await begin.isVisible().catch(()=>false))await begin.click();
}

async function expectNoHorizontalOverflow(page:Page){
  await expect.poll(async()=>page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1)).toBe(true);
}

test.describe.serial('JFT E2E release journeys',()=>{
  test('new learner can register and reach the candidate portal',async({page})=>{
    for(const width of [375,390,430,768,1024,1440]){
      await page.setViewportSize({width,height:width<700?800:900});
      await page.goto('/');
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole('heading',{name:'Thi thử JFT theo trải nghiệm CBT'})).toBeVisible();
      await page.goto('/login');
      await expectNoHorizontalOverflow(page);
      await expect(page.getByRole('heading',{name:'Đăng nhập'})).toBeVisible();
    }
    await page.setViewportSize({width:390,height:844});
    await page.goto('/register');
    await page.getByLabel('Tên hiển thị').fill('Học viên MVP');
    await page.getByLabel('Email').fill('e2e-signup@example.com');
    await page.getByLabel('Mật khẩu',{exact:true}).fill('practice123');
    await page.getByRole('button',{name:'Tạo tài khoản'}).click();
    await expect(page).toHaveURL(/\/candidate(?:\/|$)/);
    await expect(page.getByText(/Chào Học viên MVP/)).toBeVisible({timeout:15_000});
  });

  test('candidate can autosave, refresh/resume, obey Listening no-back, and submit',async({page})=>{
    await devLogin(page,'candidate','e2e-journey@local.test');
    await expect(page.getByTestId('candidate-exam-card').first()).toBeVisible();
    for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await expectNoHorizontalOverflow(page);}
    await page.setViewportSize({width:390,height:844});
    await startCandidateExam(page,120,true);

    await answerCurrent(page,0);
    // Prove account-backed resume works even without the localStorage session hint.
    await page.evaluate(()=>localStorage.clear());
    await page.reload();
    await expect(page.getByText(/Câu 1 \/ 2/)).toBeVisible({timeout:15_000});
    await expect(page.getByRole('radio').first()).toBeChecked();

    // Move through Script/Vocabulary + Conversation and into Listening.
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByRole('button',{name:'Phát âm thanh'})).toBeVisible();
    await page.getByRole('button',{name:'Phát âm thanh'}).click();
    await expect(page.getByText('Còn 1 / 2 lượt')).toBeVisible();
    await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByRole('button',{name:'Quay lại'})).toBeDisabled();
    await answerCurrent(page,0);

    // Finish Reading and submit normally.
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page); await answerCurrent(page,0);
    await moveNext(page);
    await expect(page.getByRole('heading',{name:'Nộp bài luyện tập?'})).toBeVisible();
    await page.getByRole('button',{name:'Nộp bài'}).click();
    await expect(page).toHaveURL(/\/result\?sessionId=/);
    await expect(page.getByText(/Overall|Score|Result/i).first()).toBeVisible();
    await expect(page.getByTestId('answer-review')).toBeVisible();
    await expect(page.getByRole('heading',{name:'Xem lại đáp án'})).toBeVisible();
    for(const width of [375,390,430]){await page.setViewportSize({width,height:844});await expectNoHorizontalOverflow(page);}

    const sessionId=new URL(page.url()).searchParams.get('sessionId')!;
    const repeated=await page.request.post(`/api/v1/sessions/${encodeURIComponent(sessionId)}/submit`);
    expect(repeated.status()).toBe(200);
    expect((await repeated.json()).alreadySubmitted).toBe(true);

    await page.getByRole('button',{name:'Đăng xuất'}).click();
    await devLogin(page,'candidate','e2e-journey@local.test');
    await expect(page.getByText('Lịch sử gần đây')).toBeVisible();
    await expect(page.getByText('Hoàn thành').first()).toBeVisible();
  });

  test('candidate timeout auto-finalizes saved answers and produces a result',async({page})=>{
    await devLogin(page,'candidate','e2e-timeout@local.test');
    await startCandidateExam(page,3);
    await answerCurrent(page,0);
    await expect(page).toHaveURL(/\/result\?sessionId=/,{timeout:12_000});
    await expect(page.getByText(/Overall|Score|Result/i).first()).toBeVisible();
  });

  test('candidate cannot open another learner session and active API leaks no answer key',async({page})=>{
    await devLogin(page,'candidate','e2e-owner-a@local.test');
    await startCandidateExam(page,120);
    await answerCurrent(page,0);
    const own=await page.evaluate(async()=>await (await fetch('/api/v1/sessions',{cache:'no-store'})).json());
    const sessionId=own.attempts.find((item:{status:string})=>item.status==='active').id as string;
    const activePayload=await page.evaluate(async id=>await (await fetch(`/api/v1/sessions/${encodeURIComponent(id)}`,{cache:'no-store'})).json(),sessionId);
    for(const question of activePayload.exam.questions){
      expect(question).not.toHaveProperty('answer');
      expect(question).not.toHaveProperty('explanationVi');
      expect(question).not.toHaveProperty('status');
      expect(question).not.toHaveProperty('source');
      expect(question).not.toHaveProperty('provider');
    }
    expect(activePayload.session).not.toHaveProperty('candidateId');
    const releaseDenied=await page.request.post('/api/v1/admin/a1-mvp-release');
    expect(releaseDenied.status()).toBe(403);

    await page.evaluate(async()=>{await fetch('/api/v1/auth/logout',{method:'POST'});});
    await devLogin(page,'candidate','e2e-owner-b@local.test');
    const denied=await page.evaluate(async id=>{const response=await fetch(`/api/v1/sessions/${encodeURIComponent(id)}`,{cache:'no-store'});return {status:response.status,body:await response.json()};},sessionId);
    expect(denied.status).toBe(403);
    expect(denied.body.error).toBe('FORBIDDEN');
  });

  test('admin can generate Listening, render TTS, approve, and publish an exam version',async({page})=>{
    await devLogin(page,'admin');
    await page.goto('/admin/factory');
    await expect(page.getByRole('heading',{name:'Xưởng tạo câu hỏi AI'})).toBeVisible();
    await page.getByLabel('Phần thi').selectOption('listening');
    await page.getByLabel('Chủ đề').fill(`E2E仕事-${Date.now()}`);
    // The third deterministic fixture has one answer stated verbatim in audio,
    // so the independent QA2 oracle can validate it without special-casing QA.
    await page.getByLabel('Số lượng').fill('3');
    await page.getByRole('button',{name:'Sinh câu ứng viên'}).click();
    await expect(page.getByText(/Đã tạo 3 câu ứng viên/)).toBeVisible({timeout:15_000});
    await expect(page.getByRole('button',{name:'Tạo âm thanh TTS'})).toHaveCount(3);
    await page.getByRole('button',{name:'Tạo âm thanh TTS'}).nth(2).click();
    await expect(page.getByText('Đã tạo lại âm thanh và cập nhật QA.')).toBeVisible({timeout:15_000});
    await expect(page.locator('audio')).toBeVisible();
    await expect(page.getByTestId('difficulty-calibration-result').nth(2)).toBeVisible();
    await expect(page.getByTestId('originality-duplicate-result').nth(2)).toBeVisible();
    await page.locator('.factory-candidate input[type="checkbox"]').nth(2).check();
    await page.getByRole('button',{name:/Duyệt mục đã chọn/}).click();
    await expect(page.getByText(/Đã đưa 1 câu vào Ngân hàng câu hỏi/)).toBeVisible({timeout:15_000});

    await page.goto('/admin/exams');
    await expect(page.getByRole('heading',{name:'Trình tạo đề'})).toBeVisible();
    await page.getByRole('button',{name:'Phát hành phiên bản'}).click();
    await expect(page.getByText(/Đã phát hành JFT-MOCK-001-v\d+/)).toBeVisible({timeout:15_000});
    await expect(page.getByTestId('a1-mvp-release-pack')).toBeVisible();
    await page.getByRole('button',{name:'Phát hành 5 đề A1'}).click();
    await expect(page.getByText(/Đã phát hành 5 đề A1/)).toBeVisible({timeout:15_000});
    await expect(page.getByRole('button',{name:'Đã phát hành đủ 5 đề'})).toBeDisabled();
  });

  test('admin can run source pilot into Factory Review',async({page})=>{
    await devLogin(page,'admin');
    await page.goto('/admin/sources');
    await expect(page.getByRole('heading',{name:/Nguồn → Kiến thức/})).toBeVisible();
    await page.getByRole('button',{name:'Xác nhận nhập'}).click();
    await expect(page.getByRole('heading',{name:'Thử nghiệm tiếp nhận tại bệnh viện'})).toBeVisible();
    await page.getByRole('button',{name:'1. Chia đoạn'}).click();
    await expect(page.getByText(/Đoạn: [1-9]/)).toBeVisible();
    await page.getByRole('button',{name:'2. Trích xuất'}).click();
    await page.getByRole('button',{name:'Duyệt kiến thức'}).first().click();
    await page.getByRole('button',{name:'3. Tạo kế hoạch'}).click();
    await expect(page.getByText(/Kế hoạch: 4 mục/)).toBeVisible();
    await page.getByRole('button',{name:'4. Sinh qua Xưởng câu hỏi'}).click();
    await expect(page.getByText(/Câu đã tạo: 4/)).toBeVisible({timeout:20_000});
  });
});

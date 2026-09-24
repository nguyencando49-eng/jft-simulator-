import { afterEach,describe,expect,it,vi } from 'vitest';
import type { ExamVersion } from '@/lib/admin-types';
import { latestPublishedVersions } from '@/lib/server/candidate-exam';

function version(examId:string,publishedAt:string):ExamVersion{
  return {
    id:`${examId}-v1`,examId,version:1,title:examId,durationMinutes:60,
    rules:[],createdAt:publishedAt,publishedAt,questions:[],
  };
}

describe('candidate production catalog',()=>{
  afterEach(()=>vi.unstubAllEnvs());

  it('shows only Production 3000 forms in the real production environment',()=>{
    vi.stubEnv('NODE_ENV','production');
    vi.stubEnv('E2E_TEST_MODE','false');
    const visible=latestPublishedVersions([
      version('A1-PREVIEW-FINAL-E2E-123','2026-09-24T10:00:00Z'),
      version('A1-PROD-SMOKE-123','2026-09-24T11:00:00Z'),
      version('JFT-A1-01','2026-09-24T12:00:00Z'),
      version('JFT-PRACTICE-A1-001','2026-09-24T13:00:00Z'),
      version('JFT-PRACTICE-A2-1-001','2026-09-24T14:00:00Z'),
      version('JFT-PRACTICE-A2-2-001','2026-09-24T15:00:00Z'),
    ]);
    expect(visible.map(item=>item.examId).sort()).toEqual([
      'JFT-PRACTICE-A1-001','JFT-PRACTICE-A2-1-001','JFT-PRACTICE-A2-2-001',
    ]);
  });

  it('keeps the isolated E2E catalog available when E2E mode is enabled',()=>{
    vi.stubEnv('NODE_ENV','production');
    vi.stubEnv('E2E_TEST_MODE','true');
    expect(latestPublishedVersions([version('JFT-E2E-001','2026-09-24T10:00:00Z')])).toHaveLength(1);
  });
});

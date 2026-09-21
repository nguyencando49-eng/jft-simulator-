import { describe,expect,it } from 'vitest';
import { existsSync,statSync } from 'node:fs';
import { join } from 'node:path';
import { completeProductionQuestionSet } from '@/data/production/mass-question-candidates';
import { auditControlledProductionBank,PRODUCTION_BANK_RELEASE_VERSION } from '@/lib/server/production-bank-release';

describe('controlled production release',()=>{
  it('passes the strict 3,000-question release audit',()=>{
    const audit=auditControlledProductionBank();
    expect(audit.version).toBe(PRODUCTION_BANK_RELEASE_VERSION);
    expect(audit.issues.slice(0,20)).toEqual([]);
    expect(audit.passed).toBe(true);
    expect(audit.total).toBe(3000);
    expect(audit.byLevel).toEqual({A1:1000,'A2.1':1000,'A2.2':1000});
  });
  it('ships a real local audio asset for every released Listening item',()=>{
    const listening=completeProductionQuestionSet.filter(question=>question.section==='listening');
    expect(listening).toHaveLength(525);
    for(const question of listening){
      const path=join(process.cwd(),'public',question.audioSrc!.replace(/^\//,''));
      expect(existsSync(path),question.id).toBe(true);
      expect(statSync(path).size,question.id).toBeGreaterThan(1000);
    }
  });
});

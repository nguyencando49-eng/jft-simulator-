import { describe,expect,it } from 'vitest';
import { existsSync,statSync } from 'node:fs';
import { join } from 'node:path';
import { completeProductionQuestionSet } from '@/data/production/mass-question-candidates';
import { auditControlledProductionBank,PRODUCTION_BANK_RELEASE_VERSION } from '@/lib/server/production-bank-release';

const tag=(tags:string[],prefix:string)=>tags.find(value=>value.startsWith(prefix))?.slice(prefix.length);

describe('controlled production release',()=>{
  it('passes the strict 3,000-question release audit',()=>{
    const audit=auditControlledProductionBank();
    expect(audit.version).toBe(PRODUCTION_BANK_RELEASE_VERSION);
    expect(audit.issues.slice(0,20)).toEqual([]);
    expect(audit.passed).toBe(true);
    expect(audit.total).toBe(3000);
    expect(audit.byLevel).toEqual({A1:1000,'A2.1':1000,'A2.2':1000});
  });

  it('ships diversified assessment blueprints instead of one repeated template',()=>{
    const generated=completeProductionQuestionSet.filter(question=>question.id.startsWith('PROD-'));
    const tasks=Object.fromEntries(['script_vocabulary','conversation_expression','listening','reading'].map(section=>[
      section,
      new Set(generated.filter(question=>question.section===section).map(question=>tag(question.tags,'task:')).filter(Boolean)),
    ]));
    expect(tasks.script_vocabulary.size).toBeGreaterThanOrEqual(2);
    expect(tasks.conversation_expression.size).toBeGreaterThanOrEqual(8);
    expect(tasks.listening.size).toBeGreaterThanOrEqual(3);
    expect(tasks.reading.size).toBeGreaterThanOrEqual(4);
    expect(generated.every(question=>question.tags.includes('generator:controlled-v3'))).toBe(true);
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

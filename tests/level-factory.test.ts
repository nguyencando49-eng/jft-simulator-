import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {calculateSectionTargets,getCurriculumForLevel,getLevelDefinition} from '@/lib/server/level-factory';
import {hashA1ReleaseBank} from '@/lib/server/a1-release-bank';
import type {A1ReleaseBankArtifact,A1ReleaseManifest} from '@/lib/server/a1-release-bank';

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('generic level factory foundation',()=>{
  it('preserves the closed A1 V1 release identity while adding A2.1 factory scaffolding',()=>{
    const bank=readJson<A1ReleaseBankArtifact>('data/production/releases/a1-machine-bank-v1.json');
    const manifest=readJson<A1ReleaseManifest>('data/production/releases/a1-machine-bank-v1.manifest.json');
    const a1=getLevelDefinition('A1');
    expect(bank.questionCount).toBe(486);
    expect(bank.questions).toHaveLength(486);
    expect(hashA1ReleaseBank(bank)).toBe('3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079');
    expect(manifest.releaseBankHash).toBe(hashA1ReleaseBank(bank));
    expect(a1.releasePaths.bank).toBe('data/production/releases/a1-machine-bank-v1.json');
    expect(a1.releasePaths.manifest).toBe('data/production/releases/a1-machine-bank-v1.manifest.json');
  });

  it('defines safe reusable exposure targets for a 50-question level bank',()=>{
    const targets=calculateSectionTargets();
    expect(targets.map(t=>[t.section,t.examCount])).toEqual([
      ['script_vocabulary',13],
      ['conversation_expression',12],
      ['listening',13],
      ['reading',12],
    ]);
    expect(targets.reduce((sum,t)=>sum+t.minimumBankSize,0)).toBe(250);
    expect(targets.reduce((sum,t)=>sum+t.preferredBankSize,0)).toBe(500);
  });

  it('defines A2.1 without publishing or reusing A1 release paths',()=>{
    const a21=getLevelDefinition('A2.1');
    expect(a21.releaseId).toBe('a21-machine-bank');
    expect(a21.releaseVersion).toBe('rc0');
    expect(a21.releasePaths.bank).not.toContain('a1-machine-bank');
    expect(a21.acceptanceRules.generationStates).toEqual(['PENDING','GENERATED']);
    expect(a21.acceptanceRules.terminalStates).toEqual(['MACHINE_ACCEPTED','AUTO_REJECTED']);
  });

  it('loads an A2.1 curriculum planning catalog grounded in checked-in evidence',()=>{
    const units=getCurriculumForLevel('A2.1');
    const catalog=readJson<{level:string;units:Array<{unitId:string;evidenceStatus:string;grammarScope:string[]}>}>('data/production/a21-curriculum-catalog.json');
    expect(units).toHaveLength(18);
    expect(units.every(unit=>unit.id.startsWith('A21-'))).toBe(true);
    expect(catalog.level).toBe('A2.1');
    expect(catalog.units).toHaveLength(18);
    expect(catalog.units.every(unit=>unit.evidenceStatus==='repo_internal_catalog_only')).toBe(true);
    expect(catalog.units.every(unit=>unit.grammarScope.includes('HUMAN_CONFIRMATION_REQUIRED'))).toBe(true);
  });

  it('records quantitative A2.1 bank targets without claiming release readiness',()=>{
    const targets=readJson<{status:string;wholeBankTargets:{minimum:number;preferred:number}}>('data/production/a21-bank-targets.json');
    expect(targets.status).toBe('FACTORY_TARGETS_DEFINED');
    expect(targets.wholeBankTargets.minimum).toBe(250);
    expect(targets.wholeBankTargets.preferred).toBeGreaterThanOrEqual(334);
  });
});

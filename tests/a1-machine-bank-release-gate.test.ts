import {existsSync,readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const releaseGatePath='data/qa/a1-bank-final-release-gate.json';
const simulationPath='data/qa/a1-bank-exam-simulation-report.json';
const releaseCandidatePath='data/production/a1-machine-bank-release-candidate-v1.json';
const quarantinePath='data/reviews/a1-bank-quarantine-v1.json';

function readJson<T>(path:string):T{
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('A1 machine bank release gate artifacts',()=>{
  it('writes the required release gate outputs',()=>{
    for(const path of [releaseGatePath,simulationPath,releaseCandidatePath,quarantinePath]){
      expect(existsSync(path), `${path} should exist; run scripts/run-a1-machine-bank-release-gate.ts`).toBe(true);
    }
  });

  it('uses only terminal item release states',()=>{
    const gate=readJson<{records:Array<{releaseState:string}>}>(releaseGatePath);
    expect(new Set(gate.records.map(record=>record.releaseState))).toEqual(new Set(['RELEASE_ELIGIBLE']));
  });

  it('excludes quarantined items from the release candidate',()=>{
    const candidate=readJson<{items:Array<{id:string;releaseState:string}>}>(releaseCandidatePath);
    const quarantine=readJson<{items:Array<{candidate:{id:string}}>}>(quarantinePath);
    const quarantinedIds=new Set(quarantine.items.map(row=>row.candidate.id));
    expect(candidate.items.every(item=>item.releaseState==='RELEASE_ELIGIBLE')).toBe(true);
    expect(candidate.items.some(item=>quarantinedIds.has(item.id))).toBe(false);
  });

  it('records exactly 100 synthetic exam simulations',()=>{
    const report=readJson<{exams:unknown[];summary:{simulatedExams:{total:number;pass:number;fail:number}}}>(simulationPath);
    expect(report.exams).toHaveLength(100);
    expect(report.summary.simulatedExams.total).toBe(100);
    expect(report.summary.simulatedExams.pass+report.summary.simulatedExams.fail).toBe(100);
  });
});

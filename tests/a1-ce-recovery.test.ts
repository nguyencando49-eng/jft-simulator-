import {existsSync,readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';

const recoveredPath='data/production/a1-ce-recovery-machine-accepted-v1.json';
const releaseV1Path='data/production/a1-machine-bank-release-candidate-v1.json';
const releaseV2Path='data/production/a1-machine-bank-release-candidate-v2.json';
const simulationV3Path='data/qa/a1-bank-exam-simulation-report-v3.json';

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('A1 CE recovery artifacts',()=>{
  it('writes the CE-only recovery outputs',()=>{
    for (const path of [
      recoveredPath,
      'data/reviews/a1-ce-permanent-slot-failures-v1.json',
      'data/qa/a1-ce-recovery-machine-evidence-v1.json',
      'data/qa/a1-ce-recovery-report-v1.json',
      simulationV3Path,
      releaseV2Path,
      'docs/reviews/A1_CE_RECOVERY_AND_RELEASE_REPORT.md',
    ]) expect(existsSync(path), `${path} should exist; run scripts/run-a1-ce-recovery.ts`).toBe(true);
  });

  it('recovers only conversation_expression questions without Gold or human status',()=>{
    const recovered=readJson<{itemCount:number;items:Array<{section:string;status:string;approvalMode:string;humanReviewStatus?:string;semanticRepresentation?:unknown;difficultyTarget?:string}>}>(recoveredPath);
    expect(recovered.itemCount).toBe(39);
    expect(recovered.items.every(item=>item.section==='conversation_expression')).toBe(true);
    expect(recovered.items.every(item=>item.status==='RECOVERED_MACHINE_ACCEPTED')).toBe(true);
    expect(recovered.items.every(item=>item.approvalMode==='MACHINE')).toBe(true);
    expect(recovered.items.every(item=>item.humanReviewStatus===undefined)).toBe(true);
    expect(recovered.items.every(item=>item.semanticRepresentation&&item.difficultyTarget==='A1')).toBe(true);
  });

  it('does not mutate the existing 447 release-candidate records',()=>{
    const v1=readJson<{items:unknown[]}>(releaseV1Path);
    const v2=readJson<{items:unknown[]}>(releaseV2Path);
    expect(v2.items.slice(0,v1.items.length)).toEqual(v1.items);
    expect(v2.items).toHaveLength(v1.items.length+39);
  });

  it('passes the V3 simulation with no CE item over 20 percent exposure',()=>{
    const report=readJson<{summary:{finalDecision:string;simulation:{pass:number;fail:number;ceItemsOver20Percent:number;scoringMismatch:number;duplicateWithinForm:number};finalCeAccepted:number}}>(simulationV3Path);
    expect(report.summary.finalDecision).toBe('A1_BANK_RELEASE_READY');
    expect(report.summary.finalCeAccepted).toBe(80);
    expect(report.summary.simulation).toMatchObject({pass:100,fail:0,ceItemsOver20Percent:0,scoringMismatch:0,duplicateWithinForm:0});
  });
});

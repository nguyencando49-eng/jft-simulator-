import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {hashA1ReleaseBank} from '@/lib/server/a1-release-bank';
import type {A1ReleaseBankArtifact} from '@/lib/server/a1-release-bank';

type Section='script_vocabulary'|'conversation_expression'|'listening'|'reading';
type Blueprint={blueprintId:string;level:string;section:Section;knowledgeUnitIds:string[];sourceChunkIds:string[];validation:{status:string;reasonCodes:string[]}};
type Candidate={id:string;section:Section;choices:string[];answer:number;level:string;blueprintId:string;knowledgeUnitIds:string[];sourceChunkIds:string[];status:string;approvalMode:string;machineState:string;audioSrc?:string};
type QaRecord={id:string;section:Section;gates:Record<string,{status:string;reasonCodes:string[]}>};

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('A2.1 source-grounded generation pilot artifacts',()=>{
  const blueprints=readJson<{blueprints:Blueprint[]}>('data/production/a21/a21-source-grounded-pilot-blueprints-v1.json').blueprints;
  const candidates=readJson<{candidates:Candidate[]}>('data/production/a21/a21-source-grounded-pilot-candidates-v1.json').candidates;
  const qa=readJson<{qaRecords:QaRecord[]}>('data/qa/a21/a21-source-grounded-pilot-qa-v1.json').qaRecords;
  const duplicateReport=readJson<{withinPilot:{EXACT_DUPLICATE:number;NEAR_DUPLICATE:number;SEMANTIC_DUPLICATE:number}}>('data/qa/a21/a21-source-grounded-pilot-duplicate-report-v1.json');
  const acceptance=readJson<{acceptance:Array<{id:string;finalDecision:string;machineConfidence:number;evidence:{sourceChunkIds:string[];knowledgeUnitIds:string[]}}>}>('data/qa/a21/a21-source-grounded-pilot-machine-acceptance-v1.json').acceptance;

  it('creates exactly 80 valid blueprints before candidate records',()=>{
    expect(blueprints).toHaveLength(80);
    expect(new Set(blueprints.map(blueprint=>blueprint.blueprintId)).size).toBe(80);
    expect(blueprints.every(blueprint=>blueprint.level==='A2.1')).toBe(true);
    expect(blueprints.every(blueprint=>blueprint.validation.status==='PASS')).toBe(true);
    expect(blueprints.every(blueprint=>blueprint.knowledgeUnitIds.length>0 && blueprint.sourceChunkIds.length>0)).toBe(true);
  });

  it('generates a balanced 20 item pilot per JFT section',()=>{
    expect(candidates).toHaveLength(80);
    for(const section of ['script_vocabulary','conversation_expression','listening','reading'] as Section[]) {
      expect(candidates.filter(candidate=>candidate.section===section)).toHaveLength(20);
    }
    expect(new Set(candidates.map(candidate=>candidate.id)).size).toBe(80);
  });

  it('keeps pilot candidates machine accepted but not gold, released, or published',()=>{
    expect(candidates.every(candidate=>candidate.status==='GENERATED')).toBe(true);
    expect(candidates.every(candidate=>candidate.approvalMode==='MACHINE')).toBe(true);
    expect(candidates.every(candidate=>candidate.machineState==='MACHINE_ACCEPTED')).toBe(true);
    expect(JSON.stringify(candidates)).not.toMatch(/HUMAN_GOLD|GOLD|RELEASED|PUBLISHED/);
  });

  it('preserves structural and grounding requirements',()=>{
    for(const candidate of candidates) {
      expect(candidate.choices).toHaveLength(4);
      expect(candidate.answer).toBeGreaterThanOrEqual(0);
      expect(candidate.answer).toBeLessThan(4);
      expect(new Set(candidate.choices.map(choice=>choice.normalize('NFKC').trim())).size).toBe(4);
      expect(candidate.knowledgeUnitIds.length).toBeGreaterThan(0);
      expect(candidate.sourceChunkIds.length).toBeGreaterThan(0);
      if(candidate.section==='listening') expect(candidate.audioSrc).toMatch(/^tts:\/\/A21_SOURCE_GROUNDED_PILOT_001\//);
    }
  });

  it('records QA1-QA7 PASS and duplicate-free acceptance evidence',()=>{
    expect(qa).toHaveLength(80);
    expect(acceptance).toHaveLength(80);
    for(const record of qa) {
      expect(Object.keys(record.gates).sort()).toEqual(['QA1','QA2','QA3','QA4','QA5','QA6','QA7']);
      expect(Object.values(record.gates).every(gate=>gate.status==='PASS')).toBe(true);
    }
    expect(duplicateReport.withinPilot.EXACT_DUPLICATE).toBe(0);
    expect(duplicateReport.withinPilot.NEAR_DUPLICATE).toBe(0);
    expect(duplicateReport.withinPilot.SEMANTIC_DUPLICATE).toBe(0);
    expect(acceptance.every(item=>item.finalDecision==='MACHINE_ACCEPTED' && item.machineConfidence>=0.98)).toBe(true);
    expect(acceptance.every(item=>item.evidence.knowledgeUnitIds.length>0 && item.evidence.sourceChunkIds.length>0)).toBe(true);
  });

  it('does not mutate the closed A1 V1 release bank',()=>{
    const bank=readJson<A1ReleaseBankArtifact>('data/production/releases/a1-machine-bank-v1.json');
    expect(bank.questions).toHaveLength(486);
    expect(hashA1ReleaseBank(bank)).toBe('3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079');
  });
});

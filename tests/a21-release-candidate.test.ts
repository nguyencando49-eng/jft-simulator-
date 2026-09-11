import {readFileSync} from 'node:fs';
import {describe,expect,it} from 'vitest';
import {hashA1ReleaseBank} from '@/lib/server/a1-release-bank';
import type {A1ReleaseBankArtifact} from '@/lib/server/a1-release-bank';

type Section='script_vocabulary'|'conversation_expression'|'listening'|'reading';
type Candidate={id:string;section:Section;level:string;choices:string[];answer:number;approvalMode:string;status:string;machineState:string;finalDecision:string;knowledgeUnitIds:string[];sourceChunkIds:string[];contentHash:string;semanticTarget:string;templateId:string};

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

describe('A2.1 machine release candidate V1',()=>{
  const bank=readJson<{releaseId:string;releaseVersion:string;questionCount:number;questions:Candidate[]}>('data/production/releases/a21-machine-bank-v1.json');
  const manifest=readJson<{questionCount:number;releaseBankHash:string;releaseDecision:string;approvalMode:string;counts:{sections:Record<Section,number>}}> ('data/production/releases/a21-machine-bank-v1.manifest.json');
  const report=readJson<{finalClassification:string;counts:{total:number;sections:Record<Section,number>;pilotAnchors:number};duplicates:{exact:number;near:number;semantic:number};adversarialAudit:{status:string;defensibleSecondAnswers:number};qa:Record<string,{PASS:number;REVIEW:number;FAIL:number}>;simulation100:{pass:number;fail:number;answerPositions:Record<string,number>;scoringMismatches:number;duplicateWithinForm:number};simulation1000:{pass:number;fail:number;totalQuestionInstances:number;answerPositions:Record<string,number>;scoringMismatches:number;duplicateWithinForm:number;canonicalMutations:number;replayFailures:number;maxExposureRate:number}}> ('data/qa/a21-scale-release-candidate-report-v1.json');

  it('freezes the preferred-size A2.1 source-grounded bank with section coverage',()=>{
    expect(bank.questionCount).toBe(334);
    expect(bank.questions).toHaveLength(334);
    expect(new Set(bank.questions.map(q=>q.id)).size).toBe(334);
    expect(manifest.questionCount).toBe(334);
    expect(manifest.releaseDecision).toBe('A21_RELEASE_CANDIDATE_READY');
    expect(manifest.approvalMode).toBe('MACHINE');
    expect(manifest.counts.sections).toEqual({script_vocabulary:87,conversation_expression:80,listening:87,reading:80});
  });

  it('contains only machine accepted candidates with complete source lineage',()=>{
    for(const question of bank.questions) {
      expect(question.level).toBe('A2.1');
      expect(question.approvalMode).toBe('MACHINE');
      expect(question.status).toBe('MACHINE_ACCEPTED');
      expect(question.machineState).toBe('MACHINE_ACCEPTED');
      expect(question.finalDecision).toBe('MACHINE_ACCEPTED');
      expect(question.choices).toHaveLength(4);
      expect(question.answer).toBeGreaterThanOrEqual(0);
      expect(question.answer).toBeLessThan(4);
      expect(question.knowledgeUnitIds.length).toBeGreaterThan(0);
      expect(question.sourceChunkIds.length).toBeGreaterThan(0);
      expect(question.contentHash).toMatch(/^[a-f0-9]{64}$/);
    }
    expect(JSON.stringify(bank.questions)).not.toMatch(/HUMAN_GOLD|PUBLISHED|AUTO_REPAIR_REQUIRED|PENDING|REVIEW/);
  });

  it('passes duplicate, adversarial, and QA gates',()=>{
    expect(report.finalClassification).toBe('A21_RELEASE_CANDIDATE_READY');
    expect(report.counts.total).toBe(334);
    expect(report.counts.pilotAnchors).toBe(80);
    expect(report.duplicates).toEqual({exact:0,near:0,semantic:0});
    expect(report.adversarialAudit).toEqual({status:'PASS',defensibleSecondAnswers:0});
    for(const gate of ['QA1','QA2','QA3','QA4','QA5','QA6','QA7']) {
      expect(report.qa[gate]).toEqual({PASS:334,REVIEW:0,FAIL:0});
    }
    expect(new Set(bank.questions.map(q=>q.semanticTarget)).size).toBe(334);
  });

  it('passes 100-form and 1000-form assembly simulations',()=>{
    expect(report.simulation100).toMatchObject({pass:100,fail:0,scoringMismatches:0,duplicateWithinForm:0});
    expect(report.simulation100.answerPositions).toEqual({A:1300,B:1300,C:1200,D:1200});
    expect(report.simulation1000).toMatchObject({pass:1000,fail:0,totalQuestionInstances:50000,scoringMismatches:0,duplicateWithinForm:0,canonicalMutations:0,replayFailures:0});
    expect(report.simulation1000.answerPositions).toEqual({A:13000,B:13000,C:12000,D:12000});
    expect(report.simulation1000.maxExposureRate).toBeLessThanOrEqual(0.2);
  });

  it('keeps the closed A1 V1 release untouched',()=>{
    const a1=readJson<A1ReleaseBankArtifact>('data/production/releases/a1-machine-bank-v1.json');
    expect(a1.questions).toHaveLength(486);
    expect(hashA1ReleaseBank(a1)).toBe('3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079');
  });
});

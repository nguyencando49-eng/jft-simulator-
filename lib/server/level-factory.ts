import type {ExamDraft} from '@/lib/admin-types';
import type {Question, SectionId} from '@/lib/types';
import {curriculumCatalog, type CurriculumCatalogUnit} from '@/data/production/curriculum-catalog';
import {A1_RELEASE_BANK_PATH, A1_RELEASE_ID, A1_RELEASE_MANIFEST_PATH, A1_RELEASE_VERSION} from './a1-release-bank';

export type LevelId=Question['level'];
export type ReleaseDecision='A1_BANK_RELEASE_READY'|'A21_BANK_RELEASE_CANDIDATE_READY'|'A22_BANK_RELEASE_CANDIDATE_READY';
export type CandidateMachineState='PENDING'|'GENERATED'|'AUTO_REPAIR_REQUIRED'|'MACHINE_ACCEPTED'|'AUTO_REJECTED';

export interface SectionTarget {
  section: SectionId;
  examCount: number;
  minimumBankSize: number;
  preferredBankSize: number;
  maximumFormExposure: number;
}

export interface LevelDefinition {
  level: LevelId;
  releaseId: string;
  releaseVersion: string;
  pipelineVersion: string;
  curriculumSource: string;
  releaseDecision: ReleaseDecision;
  examComposition: ExamDraft;
  sectionTargets: SectionTarget[];
  releasePaths: {
    bank: string;
    manifest: string;
  };
  acceptanceRules: {
    approvalMode: 'MACHINE';
    readonly terminalStates: readonly ['MACHINE_ACCEPTED','AUTO_REJECTED'];
    readonly intermediateStates: readonly ['AUTO_REPAIR_REQUIRED'];
    readonly generationStates: readonly ['PENDING','GENERATED'];
    machineAcceptanceThreshold: number;
  };
}

const commonAcceptanceRules={
  approvalMode:'MACHINE',
  terminalStates:['MACHINE_ACCEPTED','AUTO_REJECTED'],
  intermediateStates:['AUTO_REPAIR_REQUIRED'],
  generationStates:['PENDING','GENERATED'],
  machineAcceptanceThreshold:0.98,
} as const;

export const defaultJftExamRules=[
  {section:'script_vocabulary',count:13,allowBack:true},
  {section:'conversation_expression',count:12,allowBack:true},
  {section:'listening',count:13,allowBack:false},
  {section:'reading',count:12,allowBack:true},
] as const satisfies ReadonlyArray<{section:SectionId;count:number;allowBack:boolean}>;

export function buildExamDraftForLevel(input:{level:LevelId;id:string;title:string;durationMinutes?:number}):ExamDraft {
  return {
    id: input.id,
    title: input.title,
    durationMinutes: input.durationMinutes ?? 60,
    status: 'draft',
    rules: defaultJftExamRules.map(rule=>({...rule,levels:[input.level]})),
  };
}

export function calculateSectionTargets(rules=defaultJftExamRules):SectionTarget[] {
  return rules.map(rule=>({
    section: rule.section,
    examCount: rule.count,
    minimumBankSize: rule.count * 5,
    preferredBankSize: rule.count * 10,
    maximumFormExposure: Number((rule.count / (rule.count * 10)).toFixed(2)),
  }));
}

export const levelDefinitions: Record<LevelId,LevelDefinition>={
  A1: {
    level:'A1',
    releaseId:A1_RELEASE_ID,
    releaseVersion:A1_RELEASE_VERSION,
    pipelineVersion:'A1_PRODUCTION_RELEASE_FREEZE_V1',
    curriculumSource:'data/production/curriculum-catalog.ts',
    releaseDecision:'A1_BANK_RELEASE_READY',
    examComposition:buildExamDraftForLevel({level:'A1',id:'JFT-A1-MACHINE-V1',title:'JFT A1 Machine Bank V1'}),
    sectionTargets:calculateSectionTargets(),
    releasePaths:{bank:A1_RELEASE_BANK_PATH,manifest:A1_RELEASE_MANIFEST_PATH},
    acceptanceRules:commonAcceptanceRules,
  },
  'A2.1': {
    level:'A2.1',
    releaseId:'a21-machine-bank',
    releaseVersion:'rc0',
    pipelineVersion:'A21_LEVEL_FACTORY_RC0',
    curriculumSource:'data/production/a21-curriculum-catalog.json',
    releaseDecision:'A21_BANK_RELEASE_CANDIDATE_READY',
    examComposition:buildExamDraftForLevel({level:'A2.1',id:'JFT-A21-MACHINE-RC0',title:'JFT A2.1 Machine Bank RC0'}),
    sectionTargets:calculateSectionTargets(),
    releasePaths:{
      bank:'data/production/releases/a21-machine-bank-rc0.json',
      manifest:'data/production/releases/a21-machine-bank-rc0.manifest.json',
    },
    acceptanceRules:commonAcceptanceRules,
  },
  'A2.2': {
    level:'A2.2',
    releaseId:'a22-machine-bank',
    releaseVersion:'rc0',
    pipelineVersion:'A22_LEVEL_FACTORY_RC0',
    curriculumSource:'data/production/curriculum-catalog.ts',
    releaseDecision:'A22_BANK_RELEASE_CANDIDATE_READY',
    examComposition:buildExamDraftForLevel({level:'A2.2',id:'JFT-A22-MACHINE-RC0',title:'JFT A2.2 Machine Bank RC0'}),
    sectionTargets:calculateSectionTargets(),
    releasePaths:{
      bank:'data/production/releases/a22-machine-bank-rc0.json',
      manifest:'data/production/releases/a22-machine-bank-rc0.manifest.json',
    },
    acceptanceRules:commonAcceptanceRules,
  },
};

export function getLevelDefinition(level:LevelId):LevelDefinition {
  return levelDefinitions[level];
}

export function getCurriculumForLevel(level:LevelId):CurriculumCatalogUnit[] {
  return curriculumCatalog.filter(unit=>unit.level===level);
}

import {describe,expect,it} from 'vitest';
import {calculateMachineConfidence,evaluateMachineAcceptance,splitQa1Findings,type MachineAcceptanceInput} from '../lib/server/machine-acceptance-contract';

const pass={status:'PASS' as const,reasonCodes:[]};
function validInput():MachineAcceptanceInput{return {deterministicChecks:pass,qa1:pass,qa2:pass,qa3:pass,qa4:pass,qa5:pass,qa6:pass,qa7:pass,semanticJudgeA:{status:'PASS',selectedAnswerIndex:1,reasonCodes:[]},adversarialJudgeB:{status:'PASS',defensibleAlternativeIndexes:[],reasonCodes:[]},repairableReasonCodes:['METADATA_INVALID','PROMPT_TARGET_IMPLICIT'],repairAttempts:0,maxRepairAttempts:2}}

describe('strict machine acceptance contract',()=>{
  it('accepts only unanimous semantic evidence with every hard gate passing',()=>{const input=validInput();expect(calculateMachineConfidence(input)).toBe(1);expect(evaluateMachineAcceptance(input)).toEqual({decision:'MACHINE_ACCEPTED',machineConfidence:1,reasonCodes:[]})});
  it('routes a repairable disagreement to the bounded repair loop',()=>{const input=validInput();input.adversarialJudgeB={status:'FAIL',defensibleAlternativeIndexes:[2],reasonCodes:['PROMPT_TARGET_IMPLICIT']};expect(evaluateMachineAcceptance(input).decision).toBe('AUTO_REPAIR_REQUIRED');input.repairAttempts=2;expect(evaluateMachineAcceptance(input).decision).toBe('AUTO_REJECTED')});
  it('never lets confidence override a hard failure',()=>{const input=validInput();input.qa4={status:'FAIL',reasonCodes:['PERSISTED_GROUNDING_INTEGRITY_FAIL']};const result=evaluateMachineAcceptance(input);expect(result.decision).toBe('AUTO_REJECTED');expect(result.machineConfidence).toBeLessThan(.98)});
  it('keeps policy-only QA1 findings non-blocking while structural findings block',()=>{const policy=splitQa1Findings([],['OUT_OF_CURRICULUM_HEURISTIC']);expect(policy.qa1.status).toBe('PASS');expect(policy.policyCheck.status).toBe('NON_BLOCKING');const structural=splitQa1Findings(['ANSWER_INDEX_INVALID'],['OUT_OF_CURRICULUM_HEURISTIC']);expect(structural.qa1.status).toBe('FAIL')});
});

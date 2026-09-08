export const A1_MACHINE_PIPELINE_VERSION='A1_MACHINE_ACCEPTANCE_V1' as const;
export const MACHINE_ACCEPTANCE_THRESHOLD=0.98;

export type MachineFinalDecision='MACHINE_ACCEPTED'|'AUTO_REJECTED';
export type MachineIntermediateDecision='MACHINE_ACCEPTED'|'AUTO_REPAIR_REQUIRED'|'AUTO_REJECTED';
export type BinaryGate={status:'PASS'|'FAIL';reasonCodes:string[];evidence?:unknown};
export type SemanticJudgment={status:'PASS'|'FAIL';selectedAnswerIndex:number|null;reasonCodes:string[];evidence?:unknown};
export type AdversarialJudgment={status:'PASS'|'FAIL';defensibleAlternativeIndexes:number[];reasonCodes:string[];evidence?:unknown};

export interface MachineAcceptanceInput {
  deterministicChecks:BinaryGate;
  qa1:BinaryGate;
  qa2:BinaryGate;
  qa3:BinaryGate;
  qa4:BinaryGate;
  qa5:BinaryGate;
  qa6:BinaryGate;
  qa7:BinaryGate;
  semanticJudgeA:SemanticJudgment;
  adversarialJudgeB:AdversarialJudgment;
  repairableReasonCodes:string[];
  repairAttempts:number;
  maxRepairAttempts:number;
}

const weights={deterministicChecks:.15,semanticJudgeA:.25,adversarialJudgeB:.20,qa1:.07,qa2:.05,qa3:.08,qa4:.07,qa5:.05,qa6:.05,qa7:.03} as const;

export function calculateMachineConfidence(input:MachineAcceptanceInput):number {
  const values:Record<keyof typeof weights,boolean>={
    deterministicChecks:input.deterministicChecks.status==='PASS',
    semanticJudgeA:input.semanticJudgeA.status==='PASS',
    adversarialJudgeB:input.adversarialJudgeB.status==='PASS',
    qa1:input.qa1.status==='PASS',qa2:input.qa2.status==='PASS',qa3:input.qa3.status==='PASS',qa4:input.qa4.status==='PASS',qa5:input.qa5.status==='PASS',qa6:input.qa6.status==='PASS',qa7:input.qa7.status==='PASS',
  };
  return Number(Object.entries(weights).reduce((sum,[key,weight])=>sum+(values[key as keyof typeof weights]?weight:0),0).toFixed(4));
}

export function evaluateMachineAcceptance(input:MachineAcceptanceInput):{decision:MachineIntermediateDecision;machineConfidence:number;reasonCodes:string[]} {
  const hardGates=[input.deterministicChecks,input.qa1,input.qa2,input.qa3,input.qa4,input.qa5,input.qa6,input.qa7];
  const reasonCodes=Array.from(new Set([
    ...hardGates.flatMap(gate=>gate.status==='FAIL'?gate.reasonCodes:[]),
    ...(input.semanticJudgeA.status==='FAIL'?input.semanticJudgeA.reasonCodes:[]),
    ...(input.adversarialJudgeB.status==='FAIL'?input.adversarialJudgeB.reasonCodes:[]),
  ])).sort();
  const confidence=calculateMachineConfidence(input);
  const allHardPass=hardGates.every(gate=>gate.status==='PASS');
  const consensus=input.semanticJudgeA.status==='PASS'&&input.adversarialJudgeB.status==='PASS'&&input.semanticJudgeA.selectedAnswerIndex!==null&&input.adversarialJudgeB.defensibleAlternativeIndexes.length===0;
  if(allHardPass&&consensus&&confidence>=MACHINE_ACCEPTANCE_THRESHOLD)return {decision:'MACHINE_ACCEPTED',machineConfidence:confidence,reasonCodes:[]};
  const repairable=reasonCodes.some(code=>input.repairableReasonCodes.includes(code));
  if(repairable&&input.repairAttempts<input.maxRepairAttempts)return {decision:'AUTO_REPAIR_REQUIRED',machineConfidence:confidence,reasonCodes};
  return {decision:'AUTO_REJECTED',machineConfidence:confidence,reasonCodes:reasonCodes.length?reasonCodes:['MACHINE_CONFIDENCE_BELOW_THRESHOLD']};
}

export function splitQa1Findings(structuralReasonCodes:string[],policyReasonCodes:string[]):{structuralCheck:BinaryGate;policyCheck:{status:'PASS'|'NON_BLOCKING';reasonCodes:string[]};qa1:BinaryGate} {
  const structural=Array.from(new Set(structuralReasonCodes)).sort();
  const policy=Array.from(new Set(policyReasonCodes)).sort();
  return {
    structuralCheck:{status:structural.length?'FAIL':'PASS',reasonCodes:structural},
    policyCheck:{status:policy.length?'NON_BLOCKING':'PASS',reasonCodes:policy},
    qa1:{status:structural.length?'FAIL':'PASS',reasonCodes:structural.length?structural:policy.length?['QA1_POLICY_FALSE_POSITIVE_NON_BLOCKING']:[]},
  };
}

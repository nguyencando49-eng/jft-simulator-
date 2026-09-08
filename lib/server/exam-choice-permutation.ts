import type { QuestionRecord } from '@/lib/admin-types';

export interface ChoicePermutationEvidence {
  canonicalAnswerIndex: number;
  displayAnswerIndex: number;
  permutation: number[];
  seed: string;
  locked: boolean;
  reasonCodes: string[];
}

function hashSeed(input:string) {
  let h=2166136261;
  for (let i=0;i<input.length;i+=1) {
    h^=input.charCodeAt(i);
    h=Math.imul(h,16777619);
  }
  return h>>>0;
}

function mulberry32(seed:number) {
  return () => {
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

export function seededShuffle<T>(items:T[],seedText:string) {
  const out=[...items];
  const random=mulberry32(hashSeed(seedText));
  for (let i=out.length-1;i>0;i-=1) {
    const j=Math.floor(random()*(i+1));
    [out[i],out[j]]=[out[j],out[i]];
  }
  return out;
}

export function detectChoiceOrderLock(question:Pick<QuestionRecord,'instruction'|'prompt'|'choices'>):{locked:boolean;reasonCodes:string[]} {
  const text=[question.instruction,question.prompt,...question.choices].join('\n');
  const reasonCodes:string[]=[];
  if (/(?:順番|じゅんばん|順序|ならべ|並べ|最初から|古い順|新しい順)/u.test(text)) reasonCodes.push('ORDER_SEQUENCE_TASK');
  if (/(?:最初|まず|次に|つぎに|そのあと|あとで|最後)/u.test(text) && question.choices.some(choice=>/[1-4１-４一二三四]\s*[.)）、]/u.test(choice))) reasonCodes.push('ORDERED_STEPS_CHOICES');
  if (/(?:表|テーブル|欄|列|行|A欄|B欄|左|右)/u.test(text) && question.choices.some(choice=>/^[A-DＡ-Ｄ]|(?:左|右|上|下)/u.test(choice))) reasonCodes.push('PAIRED_LABEL_OR_TABLE_COLUMN');
  return {locked:reasonCodes.length>0,reasonCodes};
}

export function answerPositionTargets(total:number) {
  return Array.from({length:total},(_,index)=>index%4);
}

export function allocateBalancedAnswerPositions(questions:Array<Pick<QuestionRecord,'instruction'|'prompt'|'choices'|'answer'>>) {
  const ideal=answerPositionTargets(questions.length);
  const targetCounts=[0,0,0,0];
  for (const target of ideal) targetCounts[target]+=1;
  const assigned=questions.map(question=>{
    const locked=detectChoiceOrderLock(question).locked || question.choices.length !== 4;
    return locked ? question.answer : null;
  });
  const counts=[0,0,0,0];
  for (const value of assigned) if (value!==null && value>=0 && value<4) counts[value]+=1;
  for (let index=0;index<assigned.length;index+=1) {
    if (assigned[index]!==null) continue;
    let best=0;
    for (let position=1;position<4;position+=1) {
      const bestDeficit=targetCounts[best]-counts[best];
      const currentDeficit=targetCounts[position]-counts[position];
      if (currentDeficit>bestDeficit || currentDeficit===bestDeficit && counts[position]<counts[best]) best=position;
    }
    assigned[index]=best;
    counts[best]+=1;
  }
  return assigned.map(value=>value ?? 0);
}

export function buildChoicePermutation(input:{
  question: QuestionRecord;
  examSeed: string;
  examFormId: string;
  targetAnswerIndex?: number;
}):ChoicePermutationEvidence {
  const {question,examSeed,examFormId}=input;
  const locked=detectChoiceOrderLock(question);
  if (locked.locked || question.choices.length < 2) {
    return {
      canonicalAnswerIndex: question.answer,
      displayAnswerIndex: question.answer,
      permutation: question.choices.map((_,index)=>index),
      seed: `${examSeed}:${examFormId}:${question.id}:LOCKED`,
      locked: locked.locked,
      reasonCodes: locked.reasonCodes,
    };
  }
  if (!Number.isInteger(question.answer) || question.answer < 0 || question.answer >= question.choices.length) {
    throw new Error(`Invalid canonical answer index for ${question.id}`);
  }
  const displayAnswerIndex=input.targetAnswerIndex ?? hashSeed(`${examSeed}:${examFormId}:${question.id}:ANSWER`) % question.choices.length;
  if (!Number.isInteger(displayAnswerIndex) || displayAnswerIndex < 0 || displayAnswerIndex >= question.choices.length) {
    throw new Error(`Invalid display answer index for ${question.id}`);
  }
  const distractors=question.choices.map((_,index)=>index).filter(index=>index!==question.answer);
  const shuffledDistractors=seededShuffle(distractors,`${examSeed}:${examFormId}:${question.id}:DISTRACTORS:${displayAnswerIndex}`);
  const permutation:number[]=[];
  let distractorIndex=0;
  for (let displayIndex=0;displayIndex<question.choices.length;displayIndex+=1) {
    permutation[displayIndex]=displayIndex===displayAnswerIndex ? question.answer : shuffledDistractors[distractorIndex++];
  }
  validateChoicePermutation(question,permutation,displayAnswerIndex);
  return {
    canonicalAnswerIndex: question.answer,
    displayAnswerIndex,
    permutation,
    seed: `${examSeed}:${examFormId}:${question.id}`,
    locked: false,
    reasonCodes: [],
  };
}

export function validateChoicePermutation(question:Pick<QuestionRecord,'id'|'choices'|'answer'>,permutation:number[],displayAnswerIndex:number) {
  if (!Array.isArray(permutation) || permutation.length !== question.choices.length) throw new Error(`Malformed permutation for ${question.id}`);
  if (new Set(permutation).size !== permutation.length) throw new Error(`Permutation contains duplicate indexes for ${question.id}`);
  for (const index of permutation) if (!Number.isInteger(index) || index < 0 || index >= question.choices.length) throw new Error(`Permutation index out of range for ${question.id}`);
  if (permutation[displayAnswerIndex] !== question.answer) throw new Error(`Permutation does not place the canonical answer at display index for ${question.id}`);
}

export function applyChoicePermutation(question:QuestionRecord,evidence:ChoicePermutationEvidence):QuestionRecord {
  validateChoicePermutation(question,evidence.permutation,evidence.displayAnswerIndex);
  return {
    ...question,
    choices: evidence.permutation.map(index=>question.choices[index]),
    answer: evidence.displayAnswerIndex,
  };
}

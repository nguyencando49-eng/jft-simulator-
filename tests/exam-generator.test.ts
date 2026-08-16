import { describe,expect,it } from 'vitest';
import { generateExamVersion, seededShuffle } from '@/lib/exam-generator';
import type { ExamDraft, QuestionRecord } from '@/lib/admin-types';
const make=(n:number):QuestionRecord=>({id:`Q${n}`,section:'reading',type:'choice',level:'A2.1',instruction:'',prompt:`P${n}`,choices:['a','b'],answer:0,explanationVi:'x',tags:[],version:1,status:'approved',source:'original',createdAt:'x',updatedAt:'x'});
const draft:ExamDraft={id:'MOCK',title:'Mock',durationMinutes:60,status:'draft',rules:[{section:'reading',count:5,allowBack:true,levels:['A2.1']}]};
describe('seeded exam generation',()=>{
  it('is reproducible for the same version seed',()=>{expect(seededShuffle([1,2,3,4,5],'seed')).toEqual(seededShuffle([1,2,3,4,5],'seed'));});
  it('does not always select the first bank rows and changes across versions',()=>{const bank=Array.from({length:20},(_,i)=>make(i+1));const a=generateExamVersion(draft,bank,1);const b=generateExamVersion(draft,bank,2);expect(a.ok&&a.version.questions.map(x=>x.questionId)).not.toEqual(bank.slice(0,5).map(x=>x.id));expect(a.ok&&b.ok&&a.version.questions.map(x=>x.questionId)).not.toEqual(b.ok?b.version.questions.map(x=>x.questionId):[]);});
});

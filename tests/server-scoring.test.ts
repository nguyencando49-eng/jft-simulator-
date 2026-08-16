import { describe,expect,it } from 'vitest';
import type { ExamVersion, QuestionRecord } from '@/lib/admin-types';
import type { CandidateSessionRecord } from '@/lib/server/domain';
import { scoreFrozenExam } from '@/lib/server/server-scoring';
const q=(id:string,answer:number):QuestionRecord=>({id,section:'reading',type:'choice',level:'A2.1',instruction:'',prompt:id,choices:['a','b'],answer,explanationVi:'x',tags:[],version:1,status:'approved',source:'original',createdAt:'x',updatedAt:'x'});
const qs=[q('q1',0),q('q2',1)];
const version:ExamVersion={id:'v',examId:'e',version:1,title:'',durationMinutes:1,rules:[{section:'reading',count:2,allowBack:true,levels:['A2.1']}],createdAt:'x',publishedAt:'x',questions:qs.map(x=>({questionId:x.id,questionVersion:1,snapshot:x}))};
const base:CandidateSessionRecord={id:'s',examVersionId:'v',status:'submitted',startedAt:'x',expiresAt:'2099-01-01T00:00:00Z',submittedAt:'x',currentIndex:1,answers:{q1:0,q2:0,forged:1}};
describe('server scoring',()=>{it('scores only frozen exam questions and ignores forged answer keys',()=>{const r=scoreFrozenExam(version,base);expect(r.correct).toBe(1);expect(r.total).toBe(2);expect(r.answered).toBe(2);expect(r.scorePercent).toBe(50);});});

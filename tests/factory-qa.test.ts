import { describe,expect,it } from 'vitest';
import { runFactoryQa } from '@/lib/server/factory-qa';
import type { FactoryCandidate } from '@/lib/server/factory-domain';
import type { QuestionRecord } from '@/lib/admin-types';
const question=(audioSrc?:string):QuestionRecord=>({id:'AI-L-1',section:'listening',type:'audio_choice',level:'A2.1',instruction:'聞いてください。',prompt:'男の人は何をしますか。',choices:['電話します','帰ります','食べます'],answer:0,explanationVi:'Người đàn ông sẽ gọi điện.',audioSrc,tags:['仕事'],version:1,status:'review',source:'ai',createdAt:'x',updatedAt:'x'});
const candidate=(audioSrc?:string):Omit<FactoryCandidate,'qa'>=>({id:'c1',question:question(audioSrc),audioScript:'会社に電話してください。',generation:{provider:'mock',promptVersion:'v5.1',createdAt:'x'},semanticQa:{score:92,passed:true,summary:'ok',issues:[],provider:'mock'},audio:audioSrc?{status:'ready',storage:'inline-dev'}:{status:'pending'}});
describe('factory QA gate',()=>{
  it('blocks listening approval before rendered audio exists',()=>{const qa=runFactoryQa(candidate());expect(qa.passed).toBe(false);expect(qa.issues.some(i=>i.code==='audio_render')).toBe(true);});
  it('passes a structurally and semantically valid listening candidate after audio render',()=>{const qa=runFactoryQa(candidate('data:audio/wav;base64,AAAA'));expect(qa.passed).toBe(true);});
});

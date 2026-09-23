import { completeProductionQuestionSet } from '@/data/production/mass-question-candidates';
import type { Question,SectionId } from '@/lib/types';
import { isCategoryForSection } from './content-taxonomy';

export const PRODUCTION_BANK_RELEASE_VERSION='JFT_3000_CONTROLLED_V3_2026_09_23' as const;
export type ProductionBankIssue={questionId?:string;code:string;message:string};

const levels:Question['level'][]=['A1','A2.1','A2.2'];
const sections:SectionId[]=['script_vocabulary','conversation_expression','listening','reading'];
const jp=/[ぁ-んァ-ヶ一-龯]/;
const tagValue=(question:Question,prefix:string)=>question.tags.find(tag=>tag.startsWith(prefix))?.slice(prefix.length)||'';
const signature=(question:Question)=>[question.section,question.instruction,question.prompt,...question.choices].join('\u241f').normalize('NFKC').replace(/\s+/g,' ').trim();

export function auditControlledProductionBank(questions:Question[]=completeProductionQuestionSet){
  const issues:ProductionBankIssue[]=[];
  if(questions.length!==3000)issues.push({code:'BANK_SIZE',message:`Expected 3,000 questions, received ${questions.length}.`});
  const ids=new Set<string>(),signatures=new Map<string,string>();
  for(const question of questions){
    if(ids.has(question.id))issues.push({questionId:question.id,code:'DUPLICATE_ID',message:'Question ID is duplicated.'});
    ids.add(question.id);
    if(question.choices.length!==4)issues.push({questionId:question.id,code:'CHOICE_COUNT',message:'Production items require exactly four choices.'});
    if(new Set(question.choices.map(choice=>choice.normalize('NFKC').trim())).size!==question.choices.length)issues.push({questionId:question.id,code:'DUPLICATE_CHOICE',message:'Choices must be unique.'});
    if(!Number.isInteger(question.answer)||question.answer<0||question.answer>=question.choices.length)issues.push({questionId:question.id,code:'ANSWER_INDEX',message:'Answer index is invalid.'});
    if(!question.instruction.trim()||!question.prompt.trim()||!jp.test(question.instruction+question.prompt))issues.push({questionId:question.id,code:'JAPANESE_REQUIRED',message:'Instruction/prompt must contain Japanese learner-facing content.'});
    if(question.choices.some(choice=>!choice.trim()||!/([ぁ-んァ-ヶ一-龯]|\d)/.test(choice)))issues.push({questionId:question.id,code:'CHOICE_LANGUAGE',message:'Every choice must contain Japanese learner-facing content or a numeric expression.'});
    if(!question.explanationVi?.trim())issues.push({questionId:question.id,code:'EXPLANATION_REQUIRED',message:'Vietnamese explanation is required.'});
    const category=tagValue(question,'category:');
    if(!category||!isCategoryForSection(question.section,category))issues.push({questionId:question.id,code:'CATEGORY_METADATA',message:`Invalid category "${category}" for ${question.section}.`});
    for(const prefix of ['topic:','can-do:','difficulty:','section:'])if(!tagValue(question,prefix))issues.push({questionId:question.id,code:'METADATA_REQUIRED',message:`Missing ${prefix} metadata.`});
    if(question.id.startsWith('PROD-')){
      if(!question.tags.includes('generator:controlled-v3'))issues.push({questionId:question.id,code:'GENERATOR_VERSION',message:'Generated production items must use controlled-v3.'});
      if(!tagValue(question,'task:'))issues.push({questionId:question.id,code:'TASK_METADATA',message:'Generated production items require an explicit task blueprint tag.'});
    }
    if(question.section==='listening'&&(!question.audioSrc||question.type!=='audio_choice'))issues.push({questionId:question.id,code:'LISTENING_ASSET',message:'Listening item requires audio_choice and an audio source.'});
    if(question.section!=='listening'&&question.type==='audio_choice')issues.push({questionId:question.id,code:'TYPE_SECTION_MISMATCH',message:'Only Listening may use audio_choice.'});
    if(/undefined|\[object Object\]|NaN/.test(question.prompt+question.choices.join(' ')))issues.push({questionId:question.id,code:'GENERATION_ARTIFACT',message:'Learner-visible content contains a generation artifact.'});
    const key=signature(question),previous=signatures.get(key);
    if(previous)issues.push({questionId:question.id,code:'EXACT_DUPLICATE',message:`Learner-visible item duplicates ${previous}.`});
    else signatures.set(key,question.id);
  }
  const generated=questions.filter(question=>question.id.startsWith('PROD-'));
  const requiredTaskDiversity:Record<SectionId,number>={script_vocabulary:2,conversation_expression:8,listening:3,reading:4};
  const maxTaskShare:Record<SectionId,number>={script_vocabulary:.60,conversation_expression:.20,listening:.45,reading:.35};
  for(const level of levels){
    for(const section of sections){
      const group=generated.filter(question=>question.level===level&&question.section===section);
      const counts=new Map<string,number>();
      for(const question of group){
        const task=tagValue(question,'task:');
        if(task)counts.set(task,(counts.get(task)||0)+1);
      }
      if(counts.size<requiredTaskDiversity[section])issues.push({code:'TASK_DIVERSITY',message:`${level}/${section} requires at least ${requiredTaskDiversity[section]} task blueprints; found ${counts.size}.`});
      const largest=Math.max(0,...counts.values());
      if(group.length&&largest/group.length>maxTaskShare[section])issues.push({code:'TASK_CONCENTRATION',message:`${level}/${section} is over-concentrated in one task blueprint (${largest}/${group.length}).`});
    }
  }
  const byLevel=Object.fromEntries(levels.map(level=>[level,questions.filter(question=>question.level===level).length]));
  const bySection=Object.fromEntries(sections.map(section=>[section,questions.filter(question=>question.section===section).length]));
  for(const level of levels){
    const count=questions.filter(question=>question.level===level).length;
    if(count!==1000)issues.push({code:'LEVEL_BALANCE',message:`${level} requires 1,000 questions; received ${count}.`});
    const expected:Record<SectionId,number>={script_vocabulary:275,conversation_expression:275,listening:175,reading:275};
    for(const section of sections){
      const actual=questions.filter(question=>question.level===level&&question.section===section).length;
      if(actual!==expected[section])issues.push({code:'SECTION_BALANCE',message:`${level}/${section} requires ${expected[section]}; received ${actual}.`});
    }
  }
  return {version:PRODUCTION_BANK_RELEASE_VERSION,passed:issues.length===0,total:questions.length,byLevel,bySection,issues};
}

export function assertControlledProductionBank(){
  const audit=auditControlledProductionBank();
  if(!audit.passed)throw new Error(`Production bank release blocked: ${audit.issues.slice(0,8).map(issue=>`${issue.questionId||'BANK'}:${issue.code}`).join(', ')}`);
  return audit;
}

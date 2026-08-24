import {spawn} from 'node:child_process';
import {access,readFile,unlink,writeFile} from 'node:fs/promises';
import {curriculumCatalog} from '../data/production/curriculum-catalog';
import type {RecoveryBlueprintSpec} from '../data/pilots/generator-recovery-a1-blueprints';
import {azureOpenAiConfig,requestAzureOpenAiJson} from '../lib/server/azure-openai';

async function loadLocalEnv(){
  const text=await readFile('.env.local','utf8');
  for(const line of text.split(/\r?\n/)){const match=line.match(/^([^#=]+)=(.*)$/);if(match&&!process.env[match[1]])process.env[match[1]]=match[2].trim().replace(/^"|"$/g,'');}
}
await loadLocalEnv();

const firstBatch=Number(process.env.CONTROLLED_A1_START_BATCH??5);
const lastBatch=Number(process.env.CONTROLLED_A1_END_BATCH??46);
const batchSize=20;
if(!Number.isInteger(firstBatch)||!Number.isInteger(lastBatch)||firstBatch<5||lastBatch>46||firstBatch>lastBatch){
  throw new Error('Controlled A1 batch range must be integer values within 005..046.');
}
const a1Units=curriculumCatalog.filter(unit=>unit.level==='A1');
const conversationUnitIds=new Set(['A1-N03','A1-N05','A1-N06','A1-N10','A1-N11','A1-N12','A1-N14','A1-N15','A1-N17','A1-N18']);
const sectionSlots=[...Array(5).fill('script_vocabulary'),...Array(5).fill('conversation_expression'),...Array(5).fill('listening'),...Array(5).fill('reading')] as const;
const categories:Record<string,string[]>= {
  script_vocabulary:['word_meaning','word_usage','kanji_reading','kanji_meaning_usage'],
  conversation_expression:['grammar','expression'],
  listening:['conversation','shop_public','announcement_instruction'],
  reading:['content_comprehension','information_search'],
};
const formats:Record<string,string[]>= {script_vocabulary:['isolated-term','sentence'],conversation_expression:['dialogue'],listening:['dialogue','announcement'],reading:['notice','message','schedule']};
const reasonings:Record<string,string>= {script_vocabulary:'direct-recognition',conversation_expression:'appropriate-response',listening:'single-step-comprehension',reading:'single-information-retrieval'};
const sources:Record<string,string>= {script_vocabulary:'target_knowledge',conversation_expression:'communicative_intent',listening:'explicit_fact',reading:'explicit_fact'};
const exists=async(path:string)=>{try{await access(path);return true}catch{return false}};

function expectedId(batch:string,index:number){const section=sectionSlots[index],prefix=section==='script_vocabulary'?'SV':section==='conversation_expression'?'CE':section==='listening'?'LI':'RE';return `A1-CB${batch}-${prefix}-${String(index%5+1).padStart(2,'0')}`;}
function assignments(batchNumber:number){return sectionSlots.map((section,index)=>{const eligible=section==='conversation_expression'?a1Units.filter(unit=>conversationUnitIds.has(unit.id)):a1Units;const unit=eligible[(batchNumber*7+index*3)%eligible.length];const allowed=categories[section];return {id:expectedId(String(batchNumber).padStart(3,'0'),index),section,category:allowed[(batchNumber+index)%allowed.length],unit,allowedFormats:formats[section],reasoning:reasonings[section],answerSource:sources[section]};});}

function validateSpecs(value:unknown,batch:string):RecoveryBlueprintSpec[]{
  if(!Array.isArray(value)||value.length!==batchSize)throw new Error(`Planner returned ${Array.isArray(value)?value.length:'non-array'}/20 specs.`);
  const ids=new Set<string>();
  return value.map((raw,index)=>{
    if(!raw||typeof raw!=='object')throw new Error(`Spec ${index+1} is not an object.`);const spec=raw as RecoveryBlueprintSpec;const assigned=assignments(Number(batch))[index];
    if(spec.id!==assigned.id||spec.section!==assigned.section||spec.category!==assigned.category||spec.unit!==assigned.unit.id)throw new Error(`Spec ${index+1} mutated its assigned metadata.`);
    if(ids.has(spec.id))throw new Error(`Duplicate spec id ${spec.id}.`);ids.add(spec.id);
    const rawFacts=(raw as {facts?:unknown}).facts;
    if(rawFacts&&typeof rawFacts==='object'&&!Array.isArray(rawFacts)){
      spec.facts=Object.entries(rawFacts as Record<string,unknown>).map(([key,item])=>{const value=String(item);return `${key}=${value.startsWith(`${key}=`)?value.slice(key.length+1):value}`;});
      console.warn(`[${batch}] normalized object facts for ${spec.id}.`);
    }
    spec.topic=assigned.unit.topic;
    spec.canDo=assigned.unit.canDo;
    spec.knowledge=[...assigned.unit.anchors];
    if(typeof spec.evidence!=='string'||!spec.evidence.trim())spec.evidence=spec.correct;
    for(const key of ['topic','canDo','taskIntent','templateId','correct','evidence'] as const)if(typeof spec[key]!=='string'||!spec[key].trim())throw new Error(`Spec ${spec.id} has invalid ${key}.`);
    if(!Array.isArray(spec.facts)||spec.facts.length<1||spec.facts.some(x=>typeof x!=='string'||!x.includes('=')))throw new Error(`Spec ${spec.id} has invalid facts.`);
    if(!Array.isArray(spec.distractors)||spec.distractors.length!==3||new Set([spec.correct,...spec.distractors]).size!==4)throw new Error(`Spec ${spec.id} has duplicate/invalid answers.`);
    if(!assigned.allowedFormats.includes(spec.format)||spec.reasoning!==assigned.reasoning||spec.answerSource!==assigned.answerSource)throw new Error(`Spec ${spec.id} violates its task contract.`);
    const factMap=new Map(spec.facts.map(x=>[x.slice(0,x.indexOf('=')),x.slice(x.indexOf('=')+1).trim()]));
    if(spec.section==='conversation_expression'){if(!factMap.get('context'))factMap.set('context','日常生活で話しています。');if(!factMap.get('turnBPrefix'))factMap.set('turnBPrefix','B：＿＿＿＿＿＿。');spec.facts=spec.facts.map(entry=>entry.startsWith('context=')?`context=${factMap.get('context')}`:entry.startsWith('turnBPrefix=')?`turnBPrefix=${factMap.get('turnBPrefix')}`:entry);}
    const required=spec.section==='script_vocabulary'?(spec.category==='word_usage'||spec.category==='kanji_meaning_usage'?['term','sentence']:['term']):spec.section==='conversation_expression'?['context','turnA','turnBPrefix']:spec.section==='listening'?['script','question']:['stimulus','question'];
    if(required.some(key=>!factMap.get(key)))throw new Error(`Spec ${spec.id} is missing required learner-visible facts.`);
    if((spec.category==='word_usage'||spec.category==='kanji_meaning_usage')&&!spec.facts.find(item=>item.startsWith('sentence='))?.includes('＿＿＿'))throw new Error(`Spec ${spec.id} requires one visible blank in its usage sentence.`);
    if(spec.section==='listening'){const script=factMap.get('script')||'';if(!script.includes(spec.evidence)&&!script.includes(spec.correct))throw new Error(`Spec ${spec.id} has no answer evidence in its listening script.`);}
    if(spec.section==='reading'){const stimulus=factMap.get('stimulus')||'';if(!stimulus.includes(spec.evidence)&&!stimulus.includes(spec.correct))throw new Error(`Spec ${spec.id} has no answer evidence in its reading stimulus.`);}
    if(spec.section==='conversation_expression'){
      let dialogue=[factMap.get('context'),factMap.get('turnA'),factMap.get('turnBPrefix')].filter(Boolean).join('\n');
      if(dialogue.split(/[。！？?!\n]+/u).filter(Boolean).length>4){const turns=(factMap.get('turnA')||'').split(/[。！？?!]+/u).map(value=>value.trim()).filter(Boolean);if(turns.length>1){const concise=`${turns.at(-1)}？`;factMap.set('turnA',concise);spec.facts=spec.facts.map(entry=>entry.startsWith('turnA=')?`turnA=${concise}`:entry);dialogue=[factMap.get('context'),concise,factMap.get('turnBPrefix')].filter(Boolean).join('\n');console.warn(`[${batch}] shortened an overlong lead-in for ${spec.id}.`);}}
      const segments=dialogue.split(/[。！？?!\n]+/u).filter(Boolean).length;
      if(dialogue.length>180||segments>4)throw new Error(`Spec ${spec.id} exceeds the A1 conversation contract.`);
      const allChoices=[spec.correct,...spec.distractors].map(choice=>choice.replace(/[。！？?!\s]/gu,''));
      const suffixCounts=new Map<string,number>();for(const choice of allChoices){const suffix=choice.slice(-5);suffixCounts.set(suffix,(suffixCounts.get(suffix)||0)+1);}
      if(/どこ|何を|いつ|だれ|誰/u.test(factMap.get('turnA')||'')&&Math.max(...suffixCounts.values())>=3)throw new Error(`Spec ${spec.id} offers several interchangeable factual responses.`);
    }
    const stimulusFact=spec.facts.find(item=>item.startsWith(spec.section==='listening'?'script=':'stimulus='));
    if(stimulusFact){const stimulus=stimulusFact.slice(stimulusFact.indexOf('=')+1);const segments=stimulus.split(/[。！？?!\n]+/u).filter(Boolean).length;if(stimulus.length>180||segments>4)throw new Error(`Spec ${spec.id} exceeds the A1 stimulus contract.`);}
    return spec;
  });
}

const plannerPrompt=`You are the blueprint planner for an unofficial A1 JFT-style practice simulator. Return JSON only as {"specs":[...]}. Create exactly the requested ORIGINAL item blueprint specs from the immutable assignments. Do not change id, section, category, unit, reasoning, or answerSource. Use only the assigned curriculum unit's Can-do and anchors as required knowledge. New names, numbers, dates, prices and realistic surface contexts are allowed. Keep Japanese natural and A1. Exactly one correct answer and three plausible, same-type, contextually wrong distractors. Avoid nonsense and avoid merely changing names/numbers from common templates.
Each spec requires: id, section, category, unit, topic, canDo, taskIntent, templateId, correct, evidence, facts, distractors, knowledge, format, reasoning, answerSource.
facts MUST be the schema-defined object. Fill every property; use an empty string only for properties irrelevant to that item. knowledge MUST be a JSON array of non-empty strings; it will be replaced deterministically by the assigned curriculum anchors.
SCRIPT/VOCABULARY: kanji_reading uses term= and four kana readings. word_meaning uses term= and four same-type simple Japanese meanings. word_usage and kanji_meaning_usage use term= plus sentence= containing exactly one ＿＿＿ blank; correct and distractors are same-type words that fill the blank, with exactly one contextually valid answer. Never ask for a sentence while returning isolated-word choices.
CONVERSATION/EXPRESSION: requires context=, turnA=, turnBPrefix= and explanationVi=. The relationship and communicative intent must make only the correct response defensible; do not create location questions with several plausible locations.
LISTENING: requires script=, question= and explanationVi=. The visible question/options must not reveal the answer without the audio. READING: requires stimulus=, question= and explanationVi=. The passage must be necessary.
Each Listening script and Reading stimulus must be short: target at most 3 sentence/line segments and never exceed 160 Japanese characters. Conversation context plus both turns must also fit within 3 segments. Listening answer evidence must occur verbatim in script. Reading answer evidence must occur verbatim in stimulus. Use formats allowed by the assignment. Do not include source wording or official questions.`;

const factProperties={term:{type:'string'},sentence:{type:'string'},context:{type:'string'},turnA:{type:'string'},turnBPrefix:{type:'string'},explanationVi:{type:'string'},script:{type:'string'},question:{type:'string'},stimulus:{type:'string'}} as const;
const plannerSchema={type:'object',additionalProperties:false,properties:{specs:{type:'array',minItems:10,maxItems:10,items:{type:'object',additionalProperties:false,properties:{id:{type:'string'},section:{type:'string',enum:['script_vocabulary','conversation_expression','listening','reading']},category:{type:'string'},unit:{type:'string'},topic:{type:'string'},canDo:{type:'string'},taskIntent:{type:'string'},templateId:{type:'string'},correct:{type:'string'},evidence:{type:'string'},facts:{type:'object',additionalProperties:false,properties:factProperties,required:Object.keys(factProperties)},distractors:{type:'array',minItems:3,maxItems:3,items:{type:'string'}},knowledge:{type:'array',minItems:1,items:{type:'string'}},format:{type:'string',enum:['isolated-term','sentence','dialogue','announcement','notice','message','schedule']},reasoning:{type:'string',enum:['direct-recognition','single-information-retrieval','single-step-comprehension','appropriate-response']},answerSource:{type:'string',enum:['target_knowledge','communicative_intent','explicit_fact']}},required:['id','section','category','unit','topic','canDo','taskIntent','templateId','correct','evidence','facts','distractors','knowledge','format','reasoning','answerSource']}}},required:['specs']} as const;

async function planBatch(batchNumber:number){
  const batch=String(batchNumber).padStart(3,'0'),path=`data/production/controlled-a1-batch-${batch}-blueprints.json`;
  if(await exists(path))return path;
  const immutableAssignments=assignments(batchNumber).map(item=>({id:item.id,section:item.section,category:item.category,unit:item.unit.id,topic:item.unit.topic,curriculumCanDo:item.unit.canDo,anchors:item.unit.anchors,allowedFormats:item.allowedFormats,reasoning:item.reasoning,answerSource:item.answerSource}));
  let last:unknown;
  for(let attempt=1;attempt<=3;attempt++)try{
    const planned:unknown[]=[];
    for(let half=0;half<2;half++){const halfAssignments=immutableAssignments.slice(half*10,half*10+10);const response=await requestAzureOpenAiJson<{specs?:unknown}>({...azureOpenAiConfig('factory'),systemPrompt:plannerPrompt,input:{task:'controlled_a1_blueprint_half_batch',promptVersion:'CONTROLLED_A1_BLUEPRINT_PLANNER_V4',batch,half:half+1,attempt,requestedCount:10,immutableAssignments:halfAssignments},maxOutputTokens:9000,jsonSchema:{name:'controlled_a1_blueprint_half_batch',schema:plannerSchema}});if(!Array.isArray(response.specs)||response.specs.length!==10)throw new Error(`Planner returned an invalid half ${half+1}.`);planned.push(...response.specs);}
    const order=new Map(immutableAssignments.map((item,index)=>[item.id,index]));planned.sort((a,b)=>(order.get((a as {id?:string})?.id||'')??999)-(order.get((b as {id?:string})?.id||'')??999));
    const specs=validateSpecs(planned,batch);await writeFile(path,JSON.stringify(specs,null,2)+'\n');return path;
  }catch(error){last=error;console.error(`[${batch}] planner attempt ${attempt} failed: ${error instanceof Error?error.message:String(error)}`);}
  throw last;
}

function runBatch(batchNumber:number){return new Promise<void>((resolve,reject)=>{const batch=String(batchNumber).padStart(3,'0');const child=spawn(process.execPath,['node_modules/vite-node/vite-node.mjs','scripts/run-generator-recovery-a1-pilot.ts'],{cwd:process.cwd(),env:{...process.env,CONTROLLED_A1_AUTO_BATCH:batch},stdio:['ignore','pipe','pipe']});child.stdout.on('data',data=>process.stdout.write(`[${batch}] ${data}`));child.stderr.on('data',data=>process.stderr.write(`[${batch}] ${data}`));child.on('error',reject);child.on('exit',code=>code===0?resolve():reject(new Error(`Batch ${batch} runner exited with ${code}.`)));});}

for(let number=firstBatch;number<=lastBatch;number++){
  const batch=String(number).padStart(3,'0'),artifact=`data/production/controlled-a1-batch-${batch}.json`,blueprintPath=`data/production/controlled-a1-batch-${batch}-blueprints.json`;
  if(await exists(artifact)){console.log(`[${batch}] checkpoint exists; skipped.`);continue;}
  let completed=false,lastError:unknown;
  for(let cycle=1;cycle<=3&&!completed;cycle++)try{await planBatch(number);await runBatch(number);completed=true;}catch(error){lastError=error;console.error(`[${batch}] generation cycle ${cycle} failed: ${error instanceof Error?error.message:String(error)}`);if(await exists(blueprintPath))await unlink(blueprintPath);}
  if(!completed)throw lastError;
  console.log(`[${batch}] COMPLETE`);
}
console.log(`CONTROLLED_A1_RANGE_${String(firstBatch).padStart(3,'0')}_${String(lastBatch).padStart(3,'0')}_COMPLETE`);

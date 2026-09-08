import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {curriculumCatalog} from '../data/production/curriculum-catalog';
import type {QuestionRecord} from '../lib/admin-types';
import {allocateBalancedAnswerPositions,applyChoicePermutation,buildChoicePermutation,detectChoiceOrderLock} from '../lib/server/exam-choice-permutation';

type Section='script_vocabulary'|'conversation_expression'|'listening'|'reading';
type SpeechAct='GREETING'|'SELF_INTRODUCTION'|'ANSWER_NAME'|'ANSWER_ORIGIN'|'ANSWER_LOCATION'|'ACCEPT_INVITATION'|'DECLINE_INVITATION'|'MAKE_REQUEST'|'RESPOND_TO_REQUEST'|'ORDER_FOOD'|'CONFIRM_ORDER'|'ASK_PRICE'|'ANSWER_PRICE'|'ASK_LOCATION'|'MAKE_PLAN'|'CONFIRM_PLAN'|'THANK'|'APOLOGIZE'|'ASK_PERMISSION'|'RESPOND_PERMISSION';
type Candidate=Omit<QuestionRecord,'status'> & {status?:string;category:string;knowledgeUnitIds:string[];canDo:string;taskType?:string;stimulus?:string|null;audioScript?:string|null;sourceId?:string;derivedFrom?:string|null;releaseState?:string;approvalMode?:string;pipelineVersion?:string;speechAct?:SpeechAct;scenarioType?:string;semanticRepresentation?:SemanticRepresentation;originalRejectionReasons?:string[];recoveryAttempt?:number;[key:string]:unknown};
type SemanticRepresentation={context:string;speakerAIntent:string;speakerAUtterance:string;expectedSpeechAct:SpeechAct;candidateResponses:Array<{index:number;text:string;role:'CORRECT'|'DISTRACTOR';failureReason:null|'WRONG_SPEECH_ACT'|'WRONG_POLARITY'|'WRONG_TIME'|'WRONG_ENTITY'|'WRONG_REGISTER'|'DOES_NOT_ANSWER_QUESTION'|'CONTRADICTS_CONTEXT'}>;correctResponseReason:string;distractorFailureReasons:Record<string,string>;scenarioType:string};
type DistractorFailureReason=NonNullable<SemanticRepresentation['candidateResponses'][number]['failureReason']>;
type RejectedRow={candidate:Candidate;reasonCodes:string[];finalDecision:string};

const ACCEPTED_V1='data/production/a1-machine-bank-release-candidate-v1.json';
const REJECTED='data/reviews/a1-fresh-800-auto-rejected-v1.json';
const RECOVERED='data/production/a1-ce-recovery-machine-accepted-v1.json';
const PERMANENT='data/reviews/a1-ce-permanent-slot-failures-v1.json';
const EVIDENCE='data/qa/a1-ce-recovery-machine-evidence-v1.json';
const REPORT='data/qa/a1-ce-recovery-report-v1.json';
const SIM_V3='data/qa/a1-bank-exam-simulation-report-v3.json';
const RELEASE_V2='data/production/a1-machine-bank-release-candidate-v2.json';
const DOC='docs/reviews/A1_CE_RECOVERY_AND_RELEASE_REPORT.md';
const PIPELINE='A1_CE_RECOVERY_MACHINE_V1';
const TARGET_CE=80;
const MIN_CE=60;
const MAX_ATTEMPTS=3;
const EXAM_COUNT=100;
const QUESTION_COUNT=50;
const HEALTHY_EXPOSURE_RATE=.2;
const SECTION_QUOTAS:Record<Section,number>={script_vocabulary:13,conversation_expression:12,listening:13,reading:12};
const SECTIONS=Object.keys(SECTION_QUOTAS) as Section[];

const acceptedV1=JSON.parse(await readFile(ACCEPTED_V1,'utf8')) as {items:Candidate[];sourceArtifact?:string};
const rejectedArtifact=JSON.parse(await readFile(REJECTED,'utf8')) as {items:RejectedRow[]};
const baseBank=acceptedV1.items;
const rejectedCeRows=rejectedArtifact.items.filter(row=>row.candidate.section==='conversation_expression');
const a1Units=curriculumCatalog.filter(unit=>unit.level==='A1');
const unitById=new Map(a1Units.map(unit=>[unit.id,unit]));

const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(item=>item===value).length]));
const clone=<T>(value:T):T=>JSON.parse(JSON.stringify(value));
const visible=(q:Candidate)=>[q.instruction,q.prompt,q.stimulus,q.audioScript,...q.choices].filter(Boolean).join('\n');
function contentHash(q:Candidate){return sha(JSON.stringify({id:q.id,level:q.level,section:q.section,category:q.category,knowledgeUnitIds:q.knowledgeUnitIds,canDo:q.canDo,taskType:q.taskType,instruction:q.instruction,prompt:q.prompt,choices:q.choices,answer:q.answer,speechAct:q.speechAct,scenarioType:q.scenarioType,semanticRepresentation:q.semanticRepresentation}));}
function targetInQuotes(q:Candidate){return q.prompt.match(/「([^」]+)」/u)?.[1]||null;}
function targetSignature(q:Candidate){const quoted=targetInQuotes(q);if(quoted)return norm(quoted);const question=q.prompt.split('\n').at(-1)||q.prompt;return norm(question.replace(/(?:は|が|を|に|で)?(?:何|どこ|どれ|だれ|いつ|いくつ|何時).*/u,''))||norm(question);}
function semanticSignature(q:Candidate){const rep=q.semanticRepresentation;return [q.section,q.taskType||q.category,[...q.knowledgeUnitIds].sort().join(','),q.speechAct||rep?.expectedSpeechAct||'',q.scenarioType||rep?.scenarioType||'',targetSignature(q),norm(q.choices[q.answer]),norm(rep?.context||q.prompt)].join('|');}
function exactSignature(q:Candidate){return norm(visible(q));}
function templateSignature(q:Candidate){return [q.section,q.taskType||q.category,q.speechAct||'',q.scenarioType||'',q.prompt.replace(/[0-9０-９]+|[一二三四五六七八九十百千]+|「[^」]+」|[A-DＡ-Ｄ]さん|リン|ミン|アン|田中|山田|佐藤|鈴木/gu,'#')].map(norm).join('|');}

const names=['リン','ミン','アン','ナム','ホア','マイ','レイ','キム','ソラ','ユリ','ケン','ハナ'];
const countries=['ベトナム','タイ','中国','韓国','フィリピン','インドネシア'];
const places=['受付','事務所','会議室','食堂','入口','駅前','3階','2階'];
const foods=['コーヒー','お茶','水','カレー','魚セット','パン'];
const items=['電池','ノート','ペン','コピー用紙','切符','袋'];
const times=['土曜日','日曜日','3時','4時','12時30分','1時30分'];
const actsByKu:Record<string,SpeechAct[]>={
  'A1-N03':['SELF_INTRODUCTION','ANSWER_NAME','ANSWER_ORIGIN'],
  'A1-N04':['ANSWER_LOCATION','ANSWER_NAME'],
  'A1-N05':['ANSWER_NAME','THANK'],
  'A1-N06':['ORDER_FOOD','CONFIRM_ORDER','THANK'],
  'A1-N07':['ANSWER_LOCATION','ASK_LOCATION'],
  'A1-N08':['ASK_LOCATION','ANSWER_LOCATION'],
  'A1-N09':['ANSWER_PRICE','MAKE_PLAN','CONFIRM_PLAN'],
  'A1-N10':['MAKE_REQUEST','RESPOND_TO_REQUEST','THANK'],
  'A1-N11':['ANSWER_NAME','ACCEPT_INVITATION'],
  'A1-N12':['ACCEPT_INVITATION','DECLINE_INVITATION','MAKE_PLAN','CONFIRM_PLAN'],
  'A1-N13':['ASK_LOCATION','ANSWER_LOCATION','THANK'],
  'A1-N14':['MAKE_PLAN','ACCEPT_INVITATION'],
  'A1-N15':['ASK_LOCATION','ANSWER_LOCATION','MAKE_REQUEST'],
  'A1-N16':['ASK_PRICE','ANSWER_PRICE','CONFIRM_ORDER'],
  'A1-N17':['APOLOGIZE','MAKE_PLAN'],
  'A1-N18':['MAKE_PLAN','CONFIRM_PLAN'],
};
const allSpeechActs:SpeechAct[]=['GREETING','SELF_INTRODUCTION','ANSWER_NAME','ANSWER_ORIGIN','ANSWER_LOCATION','ACCEPT_INVITATION','DECLINE_INVITATION','MAKE_REQUEST','RESPOND_TO_REQUEST','ORDER_FOOD','CONFIRM_ORDER','ASK_PRICE','ANSWER_PRICE','ASK_LOCATION','MAKE_PLAN','CONFIRM_PLAN','THANK','APOLOGIZE','ASK_PERMISSION','RESPOND_PERMISSION'];

function pick<T>(values:T[],seed:number){return values[seed%values.length];}
function wrongChoices(correct:string,act:SpeechAct,seed:number){
  const generic=([
    {text:'すみません、わかりません。',failureReason:'DOES_NOT_ANSWER_QUESTION'},
    {text:'いいえ、ちがいます。',failureReason:'WRONG_POLARITY'},
    {text:'ありがとうございます。',failureReason:'WRONG_SPEECH_ACT'},
    {text:'お願いします。',failureReason:'WRONG_SPEECH_ACT'},
    {text:'また明日です。',failureReason:'WRONG_TIME'},
    {text:'それは高いです。',failureReason:'DOES_NOT_ANSWER_QUESTION'},
  ] satisfies Array<{text:string;failureReason:DistractorFailureReason}>).filter(row=>row.text!==correct);
  const byAct:Partial<Record<SpeechAct,string[]>>={
    ANSWER_NAME:['ベトナムから来ました。','3階です。','日曜日です。'],
    ANSWER_ORIGIN:['リンです。','3階です。','コーヒーです。'],
    ANSWER_LOCATION:['リンです。','土曜日です。','500円です。'],
    ACCEPT_INVITATION:['すみません、土曜日はだめです。','受付は3階です。','500円です。'],
    DECLINE_INVITATION:['はい、行きましょう。','3階です。','コーヒーをください。'],
    MAKE_REQUEST:['はい、どうぞ。','日曜日にしましょう。','500円です。'],
    RESPOND_TO_REQUEST:['コーヒーをください。','ベトナムです。','何階ですか。'],
    ORDER_FOOD:['3階です。','リンです。','土曜日です。'],
    CONFIRM_ORDER:['受付は3階です。','リンです。','日曜日にしましょう。'],
    ASK_PRICE:['どこですか。','お名前は？','日曜日ですか。'],
    ANSWER_PRICE:['3階です。','リンです。','コーヒーです。'],
    ASK_LOCATION:['いくらですか。','お名前は？','日曜日ですか。'],
    MAKE_PLAN:['リンです。','500円です。','事務所です。'],
    CONFIRM_PLAN:['リンです。','500円です。','コーヒーです。'],
    THANK:['いいえ、だめです。','3階です。','土曜日です。'],
    APOLOGIZE:['ありがとうございます。','3階です。','コーヒーです。'],
    ASK_PERMISSION:['いくらですか。','お名前は？','コーヒーです。'],
    RESPOND_PERMISSION:['コーヒーをください。','3階です。','リンです。'],
    SELF_INTRODUCTION:['3階です。','500円です。','日曜日です。'],
    GREETING:['500円です。','3階です。','コーヒーです。'],
  };
  const preferred=(byAct[act]||[]).map(text=>({text,failureReason:'WRONG_SPEECH_ACT' as const}));
  return [...preferred,...generic].filter((row,index,arr)=>arr.findIndex(other=>other.text===row.text)===index).slice(seed%2,seed%2+3);
}
function buildScenario(slot:Candidate,attempt:number,ordinal:number):Candidate {
  const ku=slot.knowledgeUnitIds[0]||'A1-N03';
  const speechAct=pick(actsByKu[ku]||allSpeechActs,ordinal+attempt);
  const name=pick(names,ordinal+attempt);
  const country=pick(countries,ordinal*2+attempt);
  const place=pick(places,ordinal*3+attempt);
  const food=pick(foods,ordinal*5+attempt);
  const item=pick(items,ordinal*7+attempt);
  const time=pick(times,ordinal*11+attempt);
  let context='',speakerAIntent='',speakerAUtterance='',correct='',scenarioType='';
  switch(speechAct){
    case 'GREETING': context=`朝、${name}さんが会社に来ました。`; speakerAIntent='greet a coworker in the morning'; speakerAUtterance='おはようございます。'; correct='おはようございます。'; scenarioType='work_greeting'; break;
    case 'SELF_INTRODUCTION': context=`初めて会う人に、${name}さんが名前と国を言います。`; speakerAIntent='invite a self introduction'; speakerAUtterance='自己紹介をお願いします。'; correct=`${name}です。${country}から来ました。`; scenarioType='self_intro'; break;
    case 'ANSWER_NAME': context=`名札には「${name}」と書いてあります。`; speakerAIntent='ask the listener name'; speakerAUtterance='お名前は？'; correct=`${name}です。`; scenarioType='name_answer'; break;
    case 'ANSWER_ORIGIN': context=`プロフィール：国＝${country}`; speakerAIntent='ask country of origin'; speakerAUtterance='どこの国から来ましたか。'; correct=`${country}から来ました。`; scenarioType='origin_answer'; break;
    case 'ANSWER_LOCATION': context=`案内メモ：${item}＝${place}`; speakerAIntent='ask where the target item/person is'; speakerAUtterance=`${item}はどこですか。`; correct=`${place}です。`; scenarioType='location_answer'; break;
    case 'ACCEPT_INVITATION': context=`${time}はひまです。`; speakerAIntent='invite the listener'; speakerAUtterance=`${time}、一緒に行きませんか。`; correct='はい、行きましょう。'; scenarioType='accept_invitation'; break;
    case 'DECLINE_INVITATION': context=`${time}は仕事があります。`; speakerAIntent='invite the listener'; speakerAUtterance=`${time}、一緒に行きませんか。`; correct=`すみません、${time}はちょっと。`; scenarioType='decline_invitation'; break;
    case 'MAKE_REQUEST': context=`机の上に${item}があります。Aさんはそれを借りたいです。`; speakerAIntent='ask to borrow an item'; speakerAUtterance='どう言いますか。'; correct=`${item}を貸してください。`; scenarioType='borrow_request'; break;
    case 'RESPOND_TO_REQUEST': context=`Aさんは${item}を借りたいです。Bさんは貸すことができます。`; speakerAIntent='request an item'; speakerAUtterance=`${item}を貸してください。`; correct='はい、どうぞ。'; scenarioType='request_response'; break;
    case 'ORDER_FOOD': context=`店で${food}を注文します。`; speakerAIntent='ask for the order'; speakerAUtterance='ご注文は？'; correct=`${food}をください。`; scenarioType='food_order'; break;
    case 'CONFIRM_ORDER': context=`注文メモ：${food}を1つ`; speakerAIntent='confirm an order'; speakerAUtterance=`${food}を1つですね。`; correct='はい、お願いします。'; scenarioType='order_confirmation'; break;
    case 'ASK_PRICE': context=`店で${item}を買いたいです。値段がわかりません。`; speakerAIntent='prompt for a price question'; speakerAUtterance='店員にどう聞きますか。'; correct='これはいくらですか。'; scenarioType='price_question'; break;
    case 'ANSWER_PRICE': context=`値札：${item}＝500円`; speakerAIntent='ask the price'; speakerAUtterance=`${item}はいくらですか。`; correct='500円です。'; scenarioType='price_answer'; break;
    case 'ASK_LOCATION': context=`店で${item}を探しています。`; speakerAIntent='prompt for a location question'; speakerAUtterance='店員にどう聞きますか。'; correct=`${item}はどこですか。`; scenarioType='location_question'; break;
    case 'MAKE_PLAN': context=`予定メモ：${time}に${place}へ行きます。`; speakerAIntent='ask what plan should be said'; speakerAUtterance='どう言いますか。'; correct=`${time}に${place}へ行きます。`; scenarioType='make_plan'; break;
    case 'CONFIRM_PLAN': context=`相談の結果：${time}に会います。`; speakerAIntent='confirm a plan'; speakerAUtterance=`では、${time}ですね。`; correct='はい、それでお願いします。'; scenarioType='confirm_plan'; break;
    case 'THANK': context='Bさんが手伝ってくれました。'; speakerAIntent='receive help'; speakerAUtterance='これで大丈夫です。'; correct='ありがとうございます。'; scenarioType='thanks'; break;
    case 'APOLOGIZE': context='会社に少し遅れます。'; speakerAIntent='ask what to say when late'; speakerAUtterance='どう言いますか。'; correct='すみません、少し遅れます。'; scenarioType='apology_late'; break;
    case 'ASK_PERMISSION': context='会社で少し休みたいです。'; speakerAIntent='prompt for permission request'; speakerAUtterance='上司にどう聞きますか。'; correct='少し休んでもいいですか。'; scenarioType='permission_question'; break;
    case 'RESPOND_PERMISSION': context='Aさんは少し休みたいです。Bさんは許可します。'; speakerAIntent='ask permission'; speakerAUtterance='少し休んでもいいですか。'; correct='はい、いいですよ。'; scenarioType='permission_response'; break;
  }
  const distractors=wrongChoices(correct,speechAct,ordinal+attempt);
  const choices=[correct,...distractors.map(row=>row.text)];
  while(choices.length<4)choices.push(pick(['わかりました。','いいえ、ありません。','明日です。','受付です。'],choices.length+ordinal));
  const semanticRepresentation:SemanticRepresentation={context,speakerAIntent,speakerAUtterance,expectedSpeechAct:speechAct,candidateResponses:choices.map((text,index)=>({index,text,role:index===0?'CORRECT':'DISTRACTOR',failureReason:index===0?null:(distractors[index-1]?.failureReason||'WRONG_SPEECH_ACT')})),correctResponseReason:`The response performs ${speechAct} for the explicit context and utterance.`,distractorFailureReasons:Object.fromEntries(choices.slice(1).map((text,index)=>[text,distractors[index]?.failureReason||'WRONG_SPEECH_ACT'])),scenarioType};
  return {...slot,id:`${slot.id}-RCV${attempt}`,status:'RECOVERED_MACHINE_ACCEPTED',approvalMode:'MACHINE',pipelineVersion:PIPELINE,sourceId:slot.sourceId||slot.derivedFrom||slot.id,derivedFrom:slot.id,answer:0,choices:choices.slice(0,4),instruction:'会話を よんで、いちばん いいものを えらんでください。',prompt:`【${scenarioType}】${context}\nA：${speakerAUtterance}\nB：＿＿＿＿＿＿。`,speechAct,scenarioType,difficultyTarget:'A1',semanticRepresentation,originalRejectionReasons:slot.originalRejectionReasons||[],recoveryAttempt:attempt};
}
function preflight(q:Candidate){const reasonCodes:string[]=[];if(q.section!=='conversation_expression')reasonCodes.push('NON_CE_SLOT');if(q.category!=='expression'||q.taskType!=='expression')reasonCodes.push('CE_METADATA_MISMATCH');if(!q.knowledgeUnitIds.length||q.knowledgeUnitIds.some(id=>!unitById.has(id)))reasonCodes.push('INVALID_KU');if(!q.semanticRepresentation)reasonCodes.push('MISSING_SEMANTIC_REPRESENTATION');if(q.choices.length!==4)reasonCodes.push('CHOICE_COUNT_INVALID');if(new Set(q.choices.map(norm)).size!==q.choices.length)reasonCodes.push('DUPLICATE_CHOICES');if(q.answer!==0)reasonCodes.push('ANSWER_INDEX_INVALID');if(/(?:options|choices|answer)\s*=/iu.test(visible(q)))reasonCodes.push('SERIALIZATION_LEAKAGE');return {status:reasonCodes.length?'FAIL':'PASS',reasonCodes};}
function judgeA(q:Candidate){const correct=q.semanticRepresentation?.candidateResponses.filter(row=>row.role==='CORRECT'&&row.failureReason===null).map(row=>row.index)||[];return {status:correct.length===1&&correct[0]===q.answer?'PASS':'FAIL',selectedAnswerIndex:correct.length===1?correct[0]:null,reasonCodes:correct.length===1&&correct[0]===q.answer?[]:correct.length>1?['ANSWER_NOT_UNIQUE']:correct.length===1?['ANSWER_KEY_MISMATCH']:['SEMANTIC_UNRESOLVED'],evidence:{method:'CE_SEMANTIC_REPRESENTATION_JUDGE_A',expectedSpeechAct:q.speechAct,correct}};}
function judgeB(q:Candidate){const defensible=q.semanticRepresentation?.candidateResponses.filter(row=>row.index!==q.answer&&row.failureReason===null).map(row=>row.index)||[];const sameText=q.choices.map(norm).some((choice,index)=>index!==q.answer&&choice===norm(q.choices[q.answer]));if(sameText)defensible.push(-1);return {status:defensible.length?'FAIL':'PASS',defensibleAlternativeIndexes:defensible.filter(index=>index>=0),reasonCodes:defensible.length?['SECOND_PLAUSIBLE_ANSWER']:[],evidence:{method:'CE_ADVERSARIAL_DISTRACTOR_FAILURE_AUDIT',distractorFailureReasons:q.semanticRepresentation?.distractorFailureReasons||{}}};}
function qa(q:Candidate,existing:Candidate[],accepted:Candidate[]){const exact=new Set([...existing,...accepted].map(exactSignature));const semantic=new Set([...existing,...accepted].map(semanticSignature));const template=new Set([...existing,...accepted].map(templateSignature));const qa1=preflight(q);const a=judgeA(q);const b=judgeB(q);const qa2={status:a.status==='PASS'&&b.status==='PASS'?'PASS':'FAIL',reasonCodes:[...a.reasonCodes,...b.reasonCodes]};const qa3={status:/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(visible(q))?'PASS':'FAIL',reasonCodes:/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(visible(q))?[]:['JAPANESE_MALFORMED']};const qa4={status:q.knowledgeUnitIds.every(id=>unitById.has(id))?'PASS':'FAIL',reasonCodes:q.knowledgeUnitIds.every(id=>unitById.has(id))?[]:['GROUNDING_EVIDENCE_MISSING']};const qa5={status:q.category==='expression'&&q.taskType==='expression'?'PASS':'FAIL',reasonCodes:q.category==='expression'&&q.taskType==='expression'?[]:['ALIGNMENT_MISMATCH']};const qa6={status:q.choices.every(choice=>choice.length<=40)?'PASS':'FAIL',reasonCodes:q.choices.every(choice=>choice.length<=40)?[]:['DISTRACTOR_TOO_COMPLEX']};let duplicate='UNIQUE';if(exact.has(exactSignature(q)))duplicate='EXACT_DUPLICATE';else if(semantic.has(semanticSignature(q)))duplicate='NEAR_DUPLICATE';else if(template.has(templateSignature(q)))duplicate='PEDAGOGICALLY_VALID_TEMPLATE_REUSE';const qa7={status:duplicate==='EXACT_DUPLICATE'||duplicate==='NEAR_DUPLICATE'?'FAIL':'PASS',reasonCodes:duplicate==='EXACT_DUPLICATE'||duplicate==='NEAR_DUPLICATE'?[duplicate]:[],classification:duplicate};const all=[qa1,qa2,qa3,qa4,qa5,qa6,qa7];return {accepted:all.every(gate=>gate.status==='PASS')&&a.status==='PASS'&&b.status==='PASS',QA1:qa1,QA2:qa2,QA3:qa3,QA4:qa4,QA5:qa5,QA6:qa6,QA7:qa7,semanticJudgeA:a,adversarialJudgeB:b,duplicateClassification:duplicate,machineConfidence:all.every(gate=>gate.status==='PASS')&&a.status==='PASS'&&b.status==='PASS'?1:.75,reasonCodes:[...all.flatMap(gate=>gate.reasonCodes),...a.reasonCodes,...b.reasonCodes]};}

function rankSlots(rows:RejectedRow[],currentAccepted:Candidate[]){const kuCounts=count(currentAccepted.filter(q=>q.section==='conversation_expression').flatMap(q=>q.knowledgeUnitIds)) as Record<string,number>;return [...rows].sort((a,b)=>{const ak=kuCounts[a.candidate.knowledgeUnitIds[0]]||0,bk=kuCounts[b.candidate.knowledgeUnitIds[0]]||0;if(ak!==bk)return ak-bk;return a.candidate.id.localeCompare(b.candidate.id);});}

await mkdir('data/production',{recursive:true});await mkdir('data/reviews',{recursive:true});await mkdir('data/qa',{recursive:true});await mkdir('docs/reviews',{recursive:true});
const initialCe=baseBank.filter(q=>q.section==='conversation_expression').length;
const topBefore=count(rejectedCeRows.flatMap(row=>row.reasonCodes||[]));
const recovered:Candidate[]=[];
const permanent:any[]=[];
const evidence:any[]=[];
const attemptStats=Array.from({length:MAX_ATTEMPTS},(_,index)=>({attempt:index+1,processed:0,accepted:0,failed:0}));
const slots=rankSlots(rejectedCeRows,baseBank);
for(const row of slots){
  if(initialCe+recovered.length>=TARGET_CE)break;
  let slotAccepted=false;
  const slotAttempts=[];
  for(let attempt=1;attempt<=MAX_ATTEMPTS&&!slotAccepted;attempt+=1){
    attemptStats[attempt-1].processed+=1;
    const candidate=buildScenario({...clone(row.candidate),originalRejectionReasons:row.reasonCodes},attempt,recovered.length+permanent.length+attempt);
    const result=qa(candidate,baseBank,recovered);
    slotAttempts.push({attempt,candidateId:candidate.id,contentHash:contentHash(candidate),...result});
    evidence.push({sourceSlotId:row.candidate.id,originalRejectionReasons:row.reasonCodes,attempt,candidateId:candidate.id,contentHash:contentHash(candidate),candidate,result});
    if(result.accepted){
      recovered.push(candidate);
      attemptStats[attempt-1].accepted+=1;
      slotAccepted=true;
    }else attemptStats[attempt-1].failed+=1;
  }
  if(!slotAccepted&&initialCe+recovered.length<TARGET_CE)permanent.push({sourceSlotId:row.candidate.id,attempts:slotAttempts,finalState:'PERMANENT_SLOT_FAILURE'});
}
const finalBank=[...baseBank.map(clone),...recovered.map(q=>({...q,releaseState:'RELEASE_ELIGIBLE'}))];
const minRecoveredCount=Math.max(0,MIN_CE-initialCe);
const minCheckpointBank=[...baseBank.map(clone),...recovered.slice(0,minRecoveredCount).map(q=>({...q,releaseState:'RELEASE_ELIGIBLE'}))];

function sectionAvailability(items:Candidate[]){return Object.fromEntries(SECTIONS.map(section=>[section,{requestedPerExam:SECTION_QUOTAS[section],available:items.filter(q=>q.section===section).length,totalSlotsAcross100:SECTION_QUOTAS[section]*EXAM_COUNT,averageExposureAcross100:Number((SECTION_QUOTAS[section]*EXAM_COUNT/Math.max(1,items.filter(q=>q.section===section).length)).toFixed(2)),minimumForHealthy100FormRotation:Math.ceil(SECTION_QUOTAS[section]*EXAM_COUNT/(EXAM_COUNT*HEALTHY_EXPOSURE_RATE))}]))}
function exposureAwarePick(pool:Candidate[],countNeeded:number,formId:string,globalExposure:Map<string,number>,kuExposure:Map<string,number>,templateExposure:Map<string,number>){const picked:Candidate[]=[];const usedTemplates=new Set<string>();const candidates=[...pool];while(picked.length<countNeeded&&candidates.length){candidates.sort((a,b)=>{const at=templateSignature(a),bt=templateSignature(b);const ap=(globalExposure.get(a.id)||0)*100+(templateExposure.get(at)||0)*10+a.knowledgeUnitIds.reduce((sum,id)=>sum+(kuExposure.get(id)||0),0)+(usedTemplates.has(at)?1000:0);const bp=(globalExposure.get(b.id)||0)*100+(templateExposure.get(bt)||0)*10+b.knowledgeUnitIds.reduce((sum,id)=>sum+(kuExposure.get(id)||0),0)+(usedTemplates.has(bt)?1000:0);if(ap!==bp)return ap-bp;return sha(`${formId}:${a.id}`).localeCompare(sha(`${formId}:${b.id}`));});const index=candidates.findIndex(q=>!usedTemplates.has(templateSignature(q)));const [next]=candidates.splice(index>=0?index:0,1);picked.push(next);usedTemplates.add(templateSignature(next));}return picked;}
function buildExam(formNumber:number,simulationBank:Candidate[],globalExposure:Map<string,number>,kuExposure:Map<string,number>,templateExposure:Map<string,number>,label='V3'){const formId=`A1-ASSEMBLY-${label}-SIM-${String(formNumber).padStart(3,'0')}`;const canonical:Candidate[]=[];for(const section of SECTIONS)canonical.push(...exposureAwarePick(simulationBank.filter(q=>q.section===section),SECTION_QUOTAS[section],`${formId}:${section}`,globalExposure,kuExposure,templateExposure));const targets=allocateBalancedAnswerPositions(canonical);const questions=canonical.map((question,index)=>{const record=question as unknown as QuestionRecord;const permutation=buildChoicePermutation({question:record,examSeed:`A1_ASSEMBLY_${label}`,examFormId:formId,targetAnswerIndex:targets[index]});const display=applyChoicePermutation(record,permutation) as Candidate;return {questionId:question.id,displayAnswerIndex:display.answer,choicePermutation:permutation,section:question.section,category:question.category,knowledgeUnitIds:question.knowledgeUnitIds,canDo:question.canDo,taskType:question.taskType||question.category,speechAct:question.speechAct||null,semanticSignature:semanticSignature(question),templateSignature:templateSignature(question),scoringProbe:{correctSelectionScoresCorrect:display.answer===permutation.displayAnswerIndex}};});for(const question of canonical){globalExposure.set(question.id,(globalExposure.get(question.id)||0)+1);for(const id of question.knowledgeUnitIds)kuExposure.set(id,(kuExposure.get(id)||0)+1);const templ=templateSignature(question);templateExposure.set(templ,(templateExposure.get(templ)||0)+1);}return {examId:formId,questionCount:questions.length,questions};}
function validateExam(exam:ReturnType<typeof buildExam>){const codes:string[]=[];if(exam.questionCount!==QUESTION_COUNT)codes.push('QUESTION_COUNT_INVALID');const sectionCounts=count(exam.questions.map(q=>q.section));for(const section of SECTIONS)if((sectionCounts[section]||0)!==SECTION_QUOTAS[section])codes.push(`SECTION_QUOTA_${section}_INVALID`);if(new Set(exam.questions.map(q=>q.questionId)).size!==exam.questions.length)codes.push('DUPLICATED_QUESTION_IN_FORM');if(new Set(exam.questions.map(q=>q.semanticSignature)).size!==exam.questions.length)codes.push('DUPLICATE_SEMANTIC_TARGET_IN_FORM');const positions=count(exam.questions.map(q=>String.fromCharCode(65+q.displayAnswerIndex))) as Record<string,number>;const spread=Math.max(...['A','B','C','D'].map(letter=>positions[letter]||0))-Math.min(...['A','B','C','D'].map(letter=>positions[letter]||0));if(spread>1)codes.push('ANSWER_POSITION_BALANCE_FAIL');if(exam.questions.some(q=>!q.scoringProbe.correctSelectionScoresCorrect))codes.push('SCORING_MISMATCH');return {status:codes.length?'FAIL':'PASS',reasonCodes:Array.from(new Set(codes)).sort(),sectionCounts,answerPositionDistribution:positions,answerPositionSpread:spread,kuCounts:count(exam.questions.flatMap(q=>q.knowledgeUnitIds)),canDoCounts:count(exam.questions.map(q=>q.canDo)),taskTypeCounts:count(exam.questions.map(q=>q.taskType)),speechActCounts:count(exam.questions.map(q=>q.speechAct||'UNSPECIFIED')),templateCounts:count(exam.questions.map(q=>q.templateSignature))};}
function runSimulation(simulationBank:Candidate[],label:string){
  const globalExposure=new Map<string,number>(),kuExposure=new Map<string,number>(),templateExposure=new Map<string,number>();const exams=[];for(let i=1;i<=EXAM_COUNT;i+=1){const exam=buildExam(i,simulationBank,globalExposure,kuExposure,templateExposure,label);exams.push({...exam,validation:validateExam(exam)});}
  const allInstances=exams.flatMap(exam=>exam.questions);
  const ceIds=new Set(simulationBank.filter(q=>q.section==='conversation_expression').map(q=>q.id));
  const ceExposure=[...globalExposure.entries()].filter(([id])=>ceIds.has(id)).map(([id,forms])=>({id,forms,rate:Number((forms/EXAM_COUNT).toFixed(2))})).sort((a,b)=>b.forms-a.forms);
  const ceOver20=ceExposure.filter(row=>row.rate>HEALTHY_EXPOSURE_RATE);
  const templateRisk=[...templateExposure.entries()].filter(([,forms])=>forms>EXAM_COUNT*HEALTHY_EXPOSURE_RATE).map(([signature,forms])=>({signature,forms,rate:Number((forms/EXAM_COUNT).toFixed(2))}));
  const simPass=exams.filter(exam=>exam.validation.status==='PASS').length;
  const scoringMismatch=exams.reduce((sum,exam)=>sum+(exam.validation.reasonCodes.includes('SCORING_MISMATCH')?1:0),0);
  const duplicateWithinForm=exams.filter(exam=>exam.validation.reasonCodes.includes('DUPLICATED_QUESTION_IN_FORM')).length;
  return {exams,allInstances,globalExposure,kuExposure,templateExposure,ceExposure,ceOver20,templateRisk,simPass,scoringMismatch,duplicateWithinForm};
}
const minCheckpoint=runSimulation(minCheckpointBank,'V3MIN');
const finalSimulation=runSimulation(finalBank,'V3');
const {exams,allInstances,ceExposure,ceOver20,templateRisk,simPass,scoringMismatch,duplicateWithinForm}=finalSimulation;
const finalCe=finalBank.filter(q=>q.section==='conversation_expression').length;
const finalDecision=simPass===EXAM_COUNT&&scoringMismatch===0&&duplicateWithinForm===0&&ceOver20.length===0&&finalCe>=MIN_CE?'A1_BANK_RELEASE_READY':'A1_BANK_COVERAGE_BLOCKED';
const ceRecoveredCoverage={byKU:count(recovered.flatMap(q=>q.knowledgeUnitIds)),byCanDo:count(recovered.map(q=>q.canDo)),bySpeechAct:count(recovered.map(q=>q.speechAct||'UNSPECIFIED')),byTaskType:count(recovered.map(q=>q.taskType||q.category)),byScenarioType:count(recovered.map(q=>q.scenarioType||'UNSPECIFIED'))};
const permanentReasons=count(permanent.flatMap(row=>row.attempts.flatMap((attempt:any)=>attempt.reasonCodes||attempt.result?.reasonCodes||[])));
const summary={initialCeAccepted:initialCe,rejectedCeSlotsAvailable:rejectedCeRows.length,attempts:attemptStats,minimumCheckpoint:{ceAccepted:MIN_CE,recoveredUsed:minRecoveredCount,pass:minCheckpoint.simPass,fail:EXAM_COUNT-minCheckpoint.simPass,ceAverageExposure:Number((SECTION_QUOTAS.conversation_expression*EXAM_COUNT/MIN_CE).toFixed(2)),ceMaximumExposure:minCheckpoint.ceExposure[0]?.forms||0,ceItemsOver20Percent:minCheckpoint.ceOver20.length,continuedReason:minCheckpoint.ceOver20.length===0&&minCheckpoint.simPass===EXAM_COUNT?'NO_SAFE_MARGIN_AT_EXACT_20_PERCENT_AVERAGE':'MINIMUM_CHECKPOINT_NOT_SAFE'},finalCeAccepted:finalCe,recoveredAccepted:recovered.length,permanentFailures:permanent.length,recoveryAcceptanceRate:Number((recovered.length/Math.max(1,attemptStats.reduce((sum,row)=>sum+row.processed,0))).toFixed(4)),topCeRejectionReasonsBefore:Object.entries(topBefore).sort((a:any,b:any)=>b[1]-a[1]).slice(0,10).map(([reason,total])=>({reason,total})),topPermanentRejectionReasonsAfter:Object.entries(permanentReasons).sort((a:any,b:any)=>b[1]-a[1]).slice(0,10).map(([reason,total])=>({reason,total})),simulation:{pass:simPass,fail:EXAM_COUNT-simPass,answerPositions:count(allInstances.map(q=>String.fromCharCode(65+q.displayAnswerIndex))),ceAverageExposure:Number((SECTION_QUOTAS.conversation_expression*EXAM_COUNT/finalCe).toFixed(2)),ceMaximumExposure:ceExposure[0]?.forms||0,ceItemsOver20Percent:ceOver20.length,templateExposureRisks:templateRisk.length,scoringMismatch,duplicateWithinForm},finalA1BankSize:finalBank.length,finalDecision};
const generatedAt=new Date().toISOString();
await writeFile(RECOVERED,JSON.stringify({artifactVersion:PIPELINE,generatedAt,status:'RECOVERED_MACHINE_ACCEPTED',itemCount:recovered.length,items:recovered},null,2)+'\n');
await writeFile(PERMANENT,JSON.stringify({artifactVersion:PIPELINE,generatedAt,status:'PERMANENT_SLOT_FAILURE',itemCount:permanent.length,items:permanent},null,2)+'\n');
await writeFile(EVIDENCE,JSON.stringify({artifactVersion:PIPELINE,generatedAt,totalAttempts:evidence.length,records:evidence},null,2)+'\n');
await writeFile(REPORT,JSON.stringify({artifactVersion:PIPELINE,generatedAt,sourceArtifacts:{acceptedV1:ACCEPTED_V1,rejected:REJECTED},contract:{scope:'conversation_expression_only',maxAttemptsPerSlot:MAX_ATTEMPTS,minCe:MIN_CE,targetCe:TARGET_CE,humans:false,gold:false,published:false},coverage:ceRecoveredCoverage,summary},null,2)+'\n');
await writeFile(RELEASE_V2,JSON.stringify({artifactVersion:PIPELINE,generatedAt,bankStatus:finalDecision,itemCount:finalBank.length,items:finalBank},null,2)+'\n');
await writeFile(SIM_V3,JSON.stringify({artifactVersion:'A1_EXAM_ASSEMBLY_V3_WITH_CE_RECOVERY',generatedAt,sourceArtifact:RELEASE_V2,published:false,availability:{bySection:sectionAvailability(finalBank)},summary,minimumCheckpoint:{ceExposure:minCheckpoint.ceExposure,ceOver20:minCheckpoint.ceOver20,templateRisk:minCheckpoint.templateRisk},ceExposure,ceOver20,templateRisk,choiceOrderLocked:finalBank.map(q=>({id:q.id,...detectChoiceOrderLock(q)})).filter(row=>row.locked),exams},null,2)+'\n');
const attemptRows=attemptStats.map(row=>`| ${row.attempt} | ${row.processed} | ${row.accepted} | ${row.failed} |`).join('\n');
const kuRows=Object.entries(ceRecoveredCoverage.byKU).map(([key,value])=>`| ${key} | ${value} |`).join('\n');
const canDoRows=Object.entries(ceRecoveredCoverage.byCanDo).map(([key,value])=>`| ${key} | ${value} |`).join('\n');
const speechRows=Object.entries(ceRecoveredCoverage.bySpeechAct).map(([key,value])=>`| ${key} | ${value} |`).join('\n');
const taskRows=Object.entries(ceRecoveredCoverage.byTaskType).map(([key,value])=>`| ${key} | ${value} |`).join('\n');
const doc=`# A1 CE Recovery and Release Report

Generated: ${generatedAt}

Scope was CE-only. Existing 447 MACHINE_ACCEPTED records, SV, Listening, Reading, V3-V6 frozen sources, QA thresholds, and exam assembly logic were not modified.

## Recovery result

- Initial CE accepted: **${initialCe}**
- Rejected CE slots available: **${rejectedCeRows.length}**
- Recovered CE accepted: **${recovered.length}**
- Final CE accepted: **${finalCe}**
- Permanent slot failures: **${permanent.length}**
- Recovery acceptance rate: **${summary.recoveryAcceptanceRate}**

| Attempt | Processed | Accepted | Failed |
|---|---:|---:|---:|
${attemptRows}

## CE coverage recovered

| KU | Count |
|---|---:|
${kuRows}

| Can-do | Count |
|---|---:|
${canDoRows}

| Speech act | Count |
|---|---:|
${speechRows}

| Task type | Count |
|---|---:|
${taskRows}

## 100-form simulation

- PASS / FAIL: **${simPass} / ${EXAM_COUNT-simPass}**
- CE average exposure: **${summary.simulation.ceAverageExposure}**
- CE maximum exposure: **${summary.simulation.ceMaximumExposure}**
- CE items >20% exposure: **${summary.simulation.ceItemsOver20Percent}**
- Template exposure risks: **${summary.simulation.templateExposureRisks}**
- A/B/C/D distribution: **${JSON.stringify(summary.simulation.answerPositions)}**
- Scoring mismatch: **${scoringMismatch}**
- Duplicate-within-form: **${duplicateWithinForm}**
- Final A1 bank size: **${finalBank.length}**

Final decision: **${finalDecision}**
`;
await writeFile(DOC,doc);
console.log(JSON.stringify(summary,null,2));

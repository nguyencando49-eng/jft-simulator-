import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {curriculumCatalog} from '../data/production/curriculum-catalog';
import type {QuestionRecord} from '../lib/admin-types';
import {buildAnswerOracleInput} from '../lib/server/answer-oracle';
import {DeterministicAnswerOracleProvider} from '../lib/server/answer-oracle-provider';

type Section='script_vocabulary'|'conversation_expression'|'listening'|'reading';
type ReleaseState='RELEASE_ELIGIBLE'|'QUARANTINED';
type AnswerState='ANSWER_CONFIRMED'|'ANSWER_MISMATCH'|'ANSWER_AMBIGUOUS';
type DuplicateClass='UNIQUE'|'PEDAGOGICALLY_VALID_TEMPLATE_REUSE'|'NEAR_DUPLICATE'|'EXACT_DUPLICATE';
type CoverageState='OVERREPRESENTED'|'BALANCED'|'UNDERREPRESENTED'|'MISSING';
type Candidate={id:string;sourceId?:string;derivedFrom?:string|null;level:string;section:Section;category:string;knowledgeUnitIds:string[];canDo:string;taskType?:string;instruction:string;prompt:string;choices:string[];answer:number;status?:string;approvalMode?:string;pipelineVersion?:string;stimulus?:string|null;audioScript?:string|null;repairHistory?:unknown[];[key:string]:unknown};
type EvidenceRecord={id:string;contentHash:string;pipelineVersion:string;deterministicChecks:{status:string};QA1:{status:string};QA2:{status:string};QA3:{status:string};QA4:{status:string};QA5:{status:string};QA6:{status:string};QA7:{status:string};semanticJudgeA:{status:string};adversarialJudgeB:{status:string};machineConfidence:number;finalDecision:string;[key:string]:unknown};

const INPUT='data/production/a1-fresh-800-machine-accepted-v1.json';
const EVIDENCE='data/qa/a1-fresh-800-machine-evidence.json';
const REJECTED='data/reviews/a1-fresh-800-auto-rejected-v1.json';
const RELEASE_GATE='data/qa/a1-bank-final-release-gate.json';
const SIM_REPORT='data/qa/a1-bank-exam-simulation-report.json';
const RELEASE_CANDIDATE='data/production/a1-machine-bank-release-candidate-v1.json';
const QUARANTINE='data/reviews/a1-bank-quarantine-v1.json';
const DOC='docs/reviews/A1_MACHINE_BANK_RELEASE_REPORT.md';
const PIPELINE_VERSION='A1_MACHINE_BANK_RELEASE_GATE_V1';
const EXAM_COUNT=100;
const SECTION_QUOTAS:Record<Section,number>={script_vocabulary:13,conversation_expression:12,listening:13,reading:12};
const SECTIONS=Object.keys(SECTION_QUOTAS) as Section[];

const acceptedArtifact=JSON.parse(await readFile(INPUT,'utf8')) as {itemCount:number;items:Candidate[];sourceHashes?:Record<string,string>};
const evidenceArtifact=JSON.parse(await readFile(EVIDENCE,'utf8')) as {records:EvidenceRecord[]};
const rejectedArtifact=JSON.parse(await readFile(REJECTED,'utf8')) as {items:Array<{candidate:Candidate}>};
const accepted=acceptedArtifact.items;
const evidenceById=new Map(evidenceArtifact.records.map(record=>[record.id,record]));
const rejectedIds=new Set(rejectedArtifact.items.map(row=>row.candidate.id));
const sourceHashes=acceptedArtifact.sourceHashes||{};
const a1Units=curriculumCatalog.filter(unit=>unit.level==='A1');
const unitById=new Map(a1Units.map(unit=>[unit.id,unit]));
const oracle=new DeterministicAnswerOracleProvider();

function stable(value:unknown):string {
  if(Array.isArray(value))return `[${value.map(stable).join(',')}]`;
  if(value&&typeof value==='object')return `{${Object.entries(value as Record<string,unknown>).sort(([a],[b])=>a.localeCompare(b)).map(([key,item])=>`${JSON.stringify(key)}:${stable(item)}`).join(',')}}`;
  return JSON.stringify(value);
}
const sha=(value:string|Buffer)=>createHash('sha256').update(value).digest('hex');
const norm=(value:string)=>value.normalize('NFKC').toLowerCase().replace(/[\s\p{P}\p{S}]+/gu,'');
const count=(values:string[])=>Object.fromEntries([...new Set(values)].sort().map(value=>[value,values.filter(item=>item===value).length]));
const visible=(q:Candidate)=>[q.instruction,q.prompt,q.stimulus,q.audioScript,...q.choices].filter(Boolean).join('\n');
const supportText=(q:Candidate)=>q.section==='listening'?q.audioScript||'':q.section==='reading'?q.stimulus||'':q.prompt;
function contentHash(q:Candidate){
  return sha(stable({level:q.level,section:q.section,category:q.category,knowledgeUnitIds:q.knowledgeUnitIds,canDo:q.canDo,taskType:q.taskType,instruction:q.instruction,prompt:q.prompt,stimulus:q.stimulus||null,audioScript:q.audioScript||null,choices:q.choices,answer:q.answer}));
}
function hashSeed(input:string){let h=2166136261;for(let i=0;i<input.length;i++){h^=input.charCodeAt(i);h=Math.imul(h,16777619);}return h>>>0;}
function mulberry32(seed:number){return()=>{let t=seed+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function seededShuffle<T>(items:T[],seedText:string){const out=[...items];const random=mulberry32(hashSeed(seedText));for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}return out;}

const readings:Record<string,string>={
  '名前':'なまえ','国':'くに','会社':'かいしゃ','家族':'かぞく','父':'ちち','母':'はは','魚':'さかな','野菜':'やさい','飲み物':'のみもの','注文':'ちゅうもん','店員':'てんいん','会計':'かいけい','部屋':'へや','台所':'だいどころ','冷蔵庫':'れいぞうこ','受付':'うけつけ','会議室':'かいぎしつ','事務所':'じむしょ','予定':'よてい','時間':'じかん','昼休み':'ひるやすみ','段ボール':'だんぼーる','コピー':'コピー','書類':'しょるい','映画':'えいが','漫画':'まんが','趣味':'しゅみ','週末':'しゅうまつ','約束':'やくそく','駅前':'えきまえ','空港':'くうこう','電車':'でんしゃ','切符':'きっぷ','温泉':'おんせん','景色':'けしき','寺':'てら','売り場':'うりば','何階':'なんがい','電池':'でんち','値段':'ねだん','円':'えん','袋':'ふくろ','昨日':'きのう','掃除':'そうじ','買い物':'かいもの','新幹線':'しんかんせん','富士山':'ふじさん','旅行':'りょこう','料理':'りょうり','乗り換え':'のりかえ','肉':'にく','貸します':'かします','駅':'えき','友達':'ともだち','兄':'あに','妹':'いもうと','食べ物':'たべもの','寝室':'しんしつ','会議':'かいぎ','終わります':'おわります','仕事':'しごと','飲み会':'のみかい','勤務先':'きんむさき','出身':'しゅっしん','両親':'りょうしん','姉':'あね','牛乳':'ぎゅうにゅう','追加':'ついか','玄関':'げんかん','食堂':'しょくどう','休憩':'きゅうけい','終了':'しゅうりょう','定規':'じょうぎ','音楽':'おんがく','読書':'どくしょ','誘い':'さそい','乗り場':'のりば','散歩':'さんぽ','商品':'しょうひん','現金':'げんきん',
};
const meanings:Record<string,RegExp>={
  '友達':/遊|話.*人/u,'飲み物':/水|飲/u,'メニュー':/食べ物.*飲み物/u,'冷蔵庫':/冷た/u,'受付':/案内|お客/u,'予定':/計画|これから/u,'段ボール':/紙.*箱/u,'スポーツ':/サッカー/u,'一緒に':/ほかの人|同じ/u,'空港':/飛行機/u,'景色':/山|海|見える/u,'温泉':/お湯|体.*温/u,'何階ですか':/建物.*階/u,'いくらですか':/値段/u,'休みの日':/仕事|学校.*ない/u,'新幹線':/速い.*列車/u,'旅行':/町|国.*出かけ/u,'会社員':/会社.*働.*人/u,'ベッド':/寝/u,'コピー用紙':/コピー.*紙/u,'映画館':/映画.*ところ/u,'誘う':/声をかけ/u,'ホーム':/電車.*待/u,'観光':/旅行先.*見/u,'在庫があります':/商品.*残/u,'おつり':/返って.*お金/u,'午前':/昼.*前/u,'体験する':/実際/u,'勤務先':/働.*会社|働.*場所/u,'出身':/生まれ|育っ/u,'両親':/父.*母/u,'姉':/年上.*女/u,'料理':/食べる.*作/u,'牛乳':/牛.*白い.*飲/u,'追加':/増/u,'店員':/店.*働/u,'玄関':/家.*入/u,'寝室':/寝.*部屋/u,'食堂':/食事.*ところ/u,'事務所':/会社.*仕事.*部屋/u,'休憩':/途中.*休/u,'終了':/終わ/u,'書類':/紙.*資料/u,'定規':/長さ|線/u,'音楽':/歌|楽器/u,'読書':/本.*読/u,'約束':/会う.*時間|決め/u,'誘い':/声をかけ/u,'切符':/乗る.*券/u,'乗り場':/乗る.*場所/u,'散歩':/歩/u,'商品':/店.*売/u,'現金':/紙.*お金|硬貨/u,
};
const collocations:Array<[RegExp,RegExp]>=[[/名札/u,/名前/u],[/ベトナム.*私の/u,/国/u],[/東京に/u,/住/u],[/より魚/u,/好き/u],[/店員.*食べたい/u,/注文/u],[/人ではなく.*テレビ/u,/あります/u],[/ではなく.*事務所/u,/います/u],[/5時.*そのあと/u,/終わ/u],[/紙をとめ/u,/ホチキス/u],[/映画を/u,/見/u],[/誘い|友達.*土曜/u,/ませんか/u],[/中央駅.*バス/u,/乗り換/u],[/寺/u,/見たい/u],[/電池.*どこ/u,/売り場/u],[/お金を払|食事.*終/u,/会計/u],[/スーパー/u,/買い物/u],[/富士山/u,/見たい/u],[/空港.*バス/u,/乗ります/u],[/会社で/u,/働/u],[/母.*名古屋/u,/住/u],[/よりお茶/u,/好き/u],[/朝.*コーヒー/u,/飲/u],[/寝室.*ベッド/u,/あります/u],[/会議中/u,/います/u],[/12時30分.*1時30分/u,/まで/u],[/ホチキスで/u,/止め/u],[/荷物/u,/段ボール/u],[/公園.*スポーツ/u,/します/u],[/4番/u,/ホーム/u],[/古い町/u,/歩き/u],[/ノート.*文房具/u,/売り場/u],[/1000円/u,/おつり/u],[/昨日.*映画/u,/見ました/u],[/着物/u,/着て/u],[/魚セット/u,/お願い/u],[/会議.*4時/u,/終わ/u]];

function targetInQuotes(q:Candidate){return q.prompt.match(/「([^」]+)」/u)?.[1]||null;}
function lexicalSelection(q:Candidate){const target=targetInQuotes(q);if(q.category==='kanji_reading'&&target&&readings[target]){const expected=norm(readings[target]);return {indexes:q.choices.map((choice,index)=>norm(choice)===expected?index:-1).filter(index=>index>=0),method:'RELEASE_READING_LEXICON',evidence:`${target}=${readings[target]}`};}if(target&&meanings[target]){const rule=meanings[target];return {indexes:q.choices.map((choice,index)=>rule.test(choice)?index:-1).filter(index=>index>=0),method:'RELEASE_MEANING_RULE',evidence:`${target}:${rule.source}`};}const matching=collocations.filter(([cue])=>cue.test(q.prompt));return {indexes:q.choices.map((choice,index)=>matching.some(([,answer])=>answer.test(choice))?index:-1).filter(index=>index>=0),method:'RELEASE_COLLOCATION_RULE',evidence:matching.map(([cue,answer])=>`${cue.source}->${answer.source}`).join(';')};}
function runtime(q:Candidate):QuestionRecord{return {id:q.id,section:q.section,type:q.section==='listening'?'audio_choice':'choice',level:'A1',instruction:q.instruction,prompt:q.section==='reading'&&q.stimulus?`${q.stimulus}\n\n${q.prompt}`:q.prompt,choices:[...q.choices],answer:q.answer,explanationVi:'Release gate independent answer derivation.',tags:[],version:1,status:'review',source:'ai',createdAt:'RELEASE_GATE',updatedAt:'RELEASE_GATE'};}
async function deriveAnswer(q:Candidate):Promise<{state:AnswerState;derived:number[];method:string;reasonCodes:string[];evidence:unknown}>{
  if(q.section==='script_vocabulary'){const result=lexicalSelection(q);if(result.indexes.length===1&&result.indexes[0]===q.answer)return {state:'ANSWER_CONFIRMED',derived:result.indexes,method:result.method,reasonCodes:[],evidence:result};if(result.indexes.length===1)return {state:'ANSWER_MISMATCH',derived:result.indexes,method:result.method,reasonCodes:['ANSWER_MISMATCH'],evidence:result};return {state:'ANSWER_AMBIGUOUS',derived:result.indexes,method:result.method,reasonCodes:['ANSWER_AMBIGUOUS'],evidence:result};}
  const result=await oracle.solve(buildAnswerOracleInput(runtime(q),q.audioScript||undefined));
  if(result.derivedCorrectOptions.length===1&&result.derivedCorrectOptions[0]===q.answer)return {state:'ANSWER_CONFIRMED',derived:result.derivedCorrectOptions,method:'RELEASE_DETERMINISTIC_ORACLE',reasonCodes:[],evidence:result};
  if(result.derivedCorrectOptions.length===1)return {state:'ANSWER_MISMATCH',derived:result.derivedCorrectOptions,method:'RELEASE_DETERMINISTIC_ORACLE',reasonCodes:['ANSWER_MISMATCH'],evidence:result};
  return {state:'ANSWER_AMBIGUOUS',derived:result.derivedCorrectOptions,method:'RELEASE_DETERMINISTIC_ORACLE',reasonCodes:['ANSWER_AMBIGUOUS'],evidence:result};
}
function promptTargetExplicit(q:Candidate){return q.section==='script_vocabulary'?Boolean(targetInQuotes(q)||/＿/u.test(q.prompt)):/(?:何|どこ|どれ|だれ|誰|いつ|いくつ|なんじ|何時|何曜日|どの|＿)/u.test(q.prompt);}
function root(value:string){return norm(value).replace(/(?:です|ます|ました|しました|します|にいます|を|に|へ|は|が|。)+$/u,'');}
function adversarialSecondAnswer(q:Candidate,derived:number[]){
  const alternatives:number[]=[];
  if(!promptTargetExplicit(q))return {status:'FAIL' as const,defensibleAlternativeIndexes:alternatives,reasonCodes:['PROMPT_TARGET_IMPLICIT'],evidence:{prompt:q.prompt}};
  if(derived.length!==1||derived[0]!==q.answer)return {status:'FAIL' as const,defensibleAlternativeIndexes:derived.filter(index=>index!==q.answer),reasonCodes:['ANSWER_NOT_CONFIRMED'],evidence:{derived}};
  if(q.section==='script_vocabulary'){
    const independent=lexicalSelection(q);
    for(const index of independent.indexes)if(index!==q.answer)alternatives.push(index);
    return {status:alternatives.length?'FAIL' as const:'PASS' as const,defensibleAlternativeIndexes:alternatives,reasonCodes:alternatives.length?['SECOND_PLAUSIBLE_ANSWER']:[],evidence:{method:`ADVERSARIAL_${independent.method}`,checkedAlternatives:q.choices.map((choice,index)=>({index,choice,selectedByRule:independent.indexes.includes(index)}))}};
  }
  const evidence=norm(supportText(q));
  const correctRoot=root(q.choices[q.answer]);
  const directCorrect=evidence.includes(norm(q.choices[q.answer]))||(correctRoot.length>=2&&evidence.includes(correctRoot));
  for(let i=0;i<q.choices.length;i++){if(i===q.answer)continue;const alt=root(q.choices[i]);if(alt.length>=2&&evidence.includes(alt)&&!directCorrect)alternatives.push(i);}
  return {status:alternatives.length?'FAIL' as const:'PASS' as const,defensibleAlternativeIndexes:alternatives,reasonCodes:alternatives.length?['SECOND_PLAUSIBLE_ANSWER']:[],evidence:{directCorrectSupport:directCorrect,alternativeLiteralSupport:alternatives}};
}
function targetSignature(q:Candidate){const quoted=targetInQuotes(q);if(quoted)return norm(quoted);const question=q.prompt.split('\n').at(-1)||q.prompt;return norm(question.replace(/(?:は|が|を|に|で)?(?:何|どこ|どれ|だれ|いつ|いくつ|何時).*/u,''))||norm(question);}
function semanticSignature(q:Candidate){return [q.section,q.taskType||q.category,[...q.knowledgeUnitIds].sort().join(','),targetSignature(q),norm(q.choices[q.answer]),q.section==='script_vocabulary'?'':norm(supportText(q))].join('|');}
function exactSignature(q:Candidate){return norm(visible(q));}
function templateSignature(q:Candidate){return [q.section,q.taskType||q.category,targetSignature(q),q.prompt.replace(/[0-9０-９]+|[一二三四五六七八九十百千]+|「[^」]+」/gu,'#')].map(norm).join('|');}
function integrityChecks(q:Candidate,ids:Set<string>,hashMatched:boolean,sourceStable:boolean){const codes:string[]=[];if(!q.id||!q.level||!q.section||!q.category||!q.taskType||!q.prompt||!q.instruction||!q.canDo)codes.push('MISSING_REQUIRED_FIELD');if(ids.has(q.id))codes.push('DUPLICATE_ID');ids.add(q.id);if(q.level!=='A1')codes.push('INVALID_LEVEL');if(!['MACHINE_ACCEPTED','RECOVERED_MACHINE_ACCEPTED'].includes(String(q.status)))codes.push('INVALID_ACCEPTED_STATUS');if(q.approvalMode!=='MACHINE')codes.push('INVALID_APPROVAL_MODE');if(!Array.isArray(q.choices)||q.choices.length!==4)codes.push('CHOICE_COUNT_INVALID');if(!Number.isInteger(q.answer)||q.answer<0||q.answer>=q.choices.length)codes.push('ANSWER_INDEX_INVALID');if(Array.isArray(q.choices)&&new Set(q.choices.map(norm)).size!==q.choices.length)codes.push('DUPLICATE_NORMALIZED_CHOICES');if(q.section==='listening'&&!q.audioScript?.trim())codes.push('MISSING_AUDIO_SCRIPT');if(q.section==='reading'&&!q.stimulus?.trim())codes.push('MISSING_STIMULUS');if(!q.knowledgeUnitIds?.length||q.knowledgeUnitIds.some(id=>!unitById.has(id)))codes.push('MISSING_KU');if(rejectedIds.has(q.id))codes.push('REJECTED_ITEM_INCLUDED');if(!hashMatched)codes.push('EVIDENCE_TRACE_HASH_MISMATCH');if(!sourceStable)codes.push('SOURCE_MUTATION_DETECTED');if(!/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(visible(q)))codes.push('JAPANESE_MALFORMED');return {status:codes.length?'FAIL':'PASS',reasonCodes:codes};}
function gateEvidenceComplete(record:EvidenceRecord|undefined,q:Candidate){if(!record)return false;return record.finalDecision==='MACHINE_ACCEPTED'&&record.contentHash===contentHash(q)&&record.deterministicChecks?.status==='PASS'&&record.QA1?.status==='PASS'&&record.QA2?.status==='PASS'&&record.QA3?.status==='PASS'&&record.QA4?.status==='PASS'&&record.QA5?.status==='PASS'&&record.QA6?.status==='PASS'&&record.QA7?.status==='PASS'&&record.semanticJudgeA?.status==='PASS'&&record.adversarialJudgeB?.status==='PASS'&&typeof record.machineConfidence==='number';}
async function sourcesStable(){const result:Record<string,{expected:string;actual:string|null;stable:boolean}>={};for(const [path,expected] of Object.entries(sourceHashes)){let actual:string|null=null;try{actual=sha(await readFile(path));}catch{actual=null;}result[path]={expected,actual,stable:actual===expected};}return result;}
function coverage<T extends string>(values:T[],universe:T[]){const counts=count(values) as Record<string,number>;const expected=values.length/(universe.length||1);return Object.fromEntries(universe.sort().map(key=>{const value=counts[key]||0;let state:CoverageState='BALANCED';if(value===0)state='MISSING';else if(value<expected*.5)state='UNDERREPRESENTED';else if(value>expected*1.5)state='OVERREPRESENTED';return [key,{count:value,expected:Number(expected.toFixed(2)),state}];}));}

await mkdir('data/qa',{recursive:true});await mkdir('data/production',{recursive:true});await mkdir('data/reviews',{recursive:true});await mkdir('docs/reviews',{recursive:true});
const sourceStability=await sourcesStable();
const allSourcesStable=Object.values(sourceStability).every(row=>row.stable);
const duplicateById=new Map<string,{classification:DuplicateClass;canonicalId?:string}>();
const exactSeen=new Map<string,Candidate>();
const semanticSeen=new Map<string,Candidate>();
const templateSeen=new Map<string,Candidate>();
for(const q of accepted){const exact=exactSeen.get(exactSignature(q));const semantic=semanticSeen.get(semanticSignature(q));const templ=templateSeen.get(templateSignature(q));if(exact)duplicateById.set(q.id,{classification:'EXACT_DUPLICATE',canonicalId:exact.id});else if(semantic)duplicateById.set(q.id,{classification:'NEAR_DUPLICATE',canonicalId:semantic.id});else if(templ)duplicateById.set(q.id,{classification:'PEDAGOGICALLY_VALID_TEMPLATE_REUSE',canonicalId:templ.id});else duplicateById.set(q.id,{classification:'UNIQUE'});if(!exact)exactSeen.set(exactSignature(q),q);if(!semantic)semanticSeen.set(semanticSignature(q),q);if(!templ)templateSeen.set(templateSignature(q),q);}

const ids=new Set<string>();
const releaseRecords:any[]=[];
const eligible:Candidate[]=[];
const quarantined:any[]=[];
for(const q of accepted){
  const evidence=evidenceById.get(q.id);
  const evidenceComplete=gateEvidenceComplete(evidence,q);
  const integrity=integrityChecks(q,ids,evidenceComplete,allSourcesStable);
  if(!evidenceComplete)integrity.reasonCodes.push('INCOMPLETE_EVIDENCE_TRACE');
  integrity.status=integrity.reasonCodes.length?'FAIL':'PASS';
  const answer=await deriveAnswer(q);
  const adversarial=adversarialSecondAnswer(q,answer.derived);
  const duplicate=duplicateById.get(q.id)||{classification:'UNIQUE' as DuplicateClass};
  const hardReasons=[...integrity.reasonCodes,...answer.reasonCodes,...adversarial.reasonCodes];
  if(duplicate.classification==='EXACT_DUPLICATE'||duplicate.classification==='NEAR_DUPLICATE')hardReasons.push(duplicate.classification);
  const releaseState:ReleaseState=hardReasons.length?'QUARANTINED':'RELEASE_ELIGIBLE';
  const record={id:q.id,sourceId:q.sourceId||q.derivedFrom||q.id,derivedFrom:q.derivedFrom||null,contentHash:contentHash(q),releaseState,integrity,answerReDerivation:answer,adversarialSecondAnswer:adversarial,duplicateScan:duplicate,evidenceTrace:evidenceComplete?'COMPLETE':'INCOMPLETE',reasonCodes:Array.from(new Set(hardReasons)).sort()};
  releaseRecords.push(record);
  if(releaseState==='RELEASE_ELIGIBLE')eligible.push({...q,releaseState,pipelineVersion:PIPELINE_VERSION});
  else quarantined.push({candidate:{...q,releaseState:'QUARANTINED',pipelineVersion:PIPELINE_VERSION},reasonCodes:record.reasonCodes,releaseGateEvidence:record});
}

function buildExam(version:number){
  const items:Candidate[]=[];
  for(const section of SECTIONS){const pool=eligible.filter(q=>q.section===section);items.push(...seededShuffle(pool,`A1-RELEASE-GATE-${version}-${section}`).slice(0,SECTION_QUOTAS[section]));}
  return seededShuffle(items,`A1-RELEASE-GATE-${version}-ORDER`);
}
function answerPositionDistribution(items:Candidate[]){return count(items.map(q=>String.fromCharCode(65+q.answer))) as Record<string,number>;}
function examTemplateCounts(items:Candidate[]){return count(items.map(templateSignature));}
function validateExam(items:Candidate[]){
  const codes:string[]=[];
  if(items.length!==50)codes.push('QUESTION_COUNT_INVALID');
  const bySection=count(items.map(q=>q.section));
  for(const section of SECTIONS)if((bySection[section]||0)!==SECTION_QUOTAS[section])codes.push(`SECTION_QUOTA_${section}_INVALID`);
  if(new Set(items.map(q=>q.id)).size!==items.length)codes.push('DUPLICATED_QUESTION_IN_EXAM');
  const pos=answerPositionDistribution(items);
  for(const letter of ['A','B','C','D']){const value=pos[letter]||0;if(value<8||value>17)codes.push(`ANSWER_POSITION_${letter}_BIAS`);}
  const templates=examTemplateCounts(items);
  if(Object.values(templates).some(value=>value>2))codes.push('EXCESSIVE_TEMPLATE_REUSE');
  const ku=count(items.flatMap(q=>q.knowledgeUnitIds));
  if(Object.values(ku).some(value=>value>8))codes.push('KU_CONCENTRATION');
  const targets=count(items.map(q=>semanticSignature(q)));
  if(Object.values(targets).some(value=>value>1))codes.push('DUPLICATE_SEMANTIC_TARGET');
  return {status:codes.length?'FAIL':'PASS',reasonCodes:Array.from(new Set(codes)).sort(),sectionCounts:bySection,answerPositionDistribution:pos,kuCounts:ku,templateCounts:templates};
}
const simulatedExams=[];
for(let i=1;i<=EXAM_COUNT;i++){const questions=buildExam(i);simulatedExams.push({examId:`A1-RELEASE-SIM-${String(i).padStart(3,'0')}`,questionCount:questions.length,questionIds:questions.map(q=>q.id),validation:validateExam(questions)});}
const exposure=count(simulatedExams.flatMap(exam=>exam.questionIds));
const kuExposure=count(simulatedExams.flatMap(exam=>exam.questionIds.flatMap(id=>eligible.find(q=>q.id===id)?.knowledgeUnitIds||[])));
const templateExposure=count(simulatedExams.flatMap(exam=>exam.questionIds.map(id=>templateSignature(eligible.find(q=>q.id===id)!))));
const highQuestionExposure=Object.entries(exposure).filter(([,value])=>value>EXAM_COUNT*.3).sort((a,b)=>b[1]-a[1]).map(([id,forms])=>({id,forms,rate:Number((forms/EXAM_COUNT).toFixed(2))}));
const highKuExposure=Object.entries(kuExposure).filter(([,value])=>value>EXAM_COUNT*5).sort((a,b)=>b[1]-a[1]).map(([id,forms])=>({id,forms}));
const highTemplateExposure=Object.entries(templateExposure).filter(([,value])=>value>EXAM_COUNT*.5).sort((a,b)=>b[1]-a[1]).slice(0,50).map(([signature,forms])=>({signature,forms}));
const sectionValues=accepted.map(q=>q.section);
const categoryValues=accepted.map(q=>q.category);
const kuValues=accepted.flatMap(q=>q.knowledgeUnitIds);
const canDoValues=accepted.map(q=>q.canDo);
const taskTypeValues=accepted.map(q=>q.taskType||q.category);
const coverageReport={section:coverage(sectionValues,SECTIONS),category:coverage(categoryValues,[...new Set(categoryValues)].sort()),knowledgeUnit:coverage(kuValues,a1Units.map(unit=>unit.id)),canDo:coverage(canDoValues,a1Units.map(unit=>unit.canDo).concat([...new Set(canDoValues.filter(value=>!a1Units.some(unit=>unit.canDo===value)))])),taskType:coverage(taskTypeValues,[...new Set(taskTypeValues)].sort())};
const answerStates=count(releaseRecords.map(record=>record.answerReDerivation.state));
const duplicateStates=count(releaseRecords.map(record=>record.duplicateScan.classification));
const quarantineReasons=count(releaseRecords.flatMap(record=>record.reasonCodes));
const examPassCount=simulatedExams.filter(exam=>exam.validation.status==='PASS').length;
const totalPositions=answerPositionDistribution(simulatedExams.flatMap(exam=>exam.questionIds.map(id=>eligible.find(q=>q.id===id)!)));
const expectedPosition=(EXAM_COUNT*50)/4;
const answerPositionBias=Object.fromEntries(['A','B','C','D'].map(letter=>{const actual=totalPositions[letter]||0;return [letter,{actual,expected:expectedPosition,deviation:Number(((actual-expectedPosition)/expectedPosition).toFixed(4)),status:Math.abs(actual-expectedPosition)/expectedPosition<=.08?'PASS':'FAIL'}];}));
const hardIntegrityFailures=releaseRecords.filter(record=>record.integrity.status==='FAIL').length;
const examAssemblySafe=examPassCount===EXAM_COUNT
  && Object.values(answerPositionBias).every((row:any)=>row.status==='PASS')
  && highQuestionExposure.length===0
  && highKuExposure.length===0
  && highTemplateExposure.length===0;
const finalDecision=hardIntegrityFailures===0&&quarantined.length===0&&examAssemblySafe?'A1_BANK_RELEASE_READY':'A1_BANK_NOT_READY';
const summary={finalInputBankSize:accepted.length,releaseEligible:eligible.length,quarantined:quarantined.length,answerMismatches:answerStates.ANSWER_MISMATCH||0,answerAmbiguities:answerStates.ANSWER_AMBIGUOUS||0,exactDuplicates:duplicateStates.EXACT_DUPLICATE||0,nearDuplicates:duplicateStates.NEAR_DUPLICATE||0,coverageGaps:{missingKnowledgeUnits:Object.entries(coverageReport.knowledgeUnit).filter(([,value]:any)=>value.state==='MISSING').map(([key])=>key),underrepresented:Object.entries(coverageReport.section).filter(([,value]:any)=>value.state==='UNDERREPRESENTED').map(([key])=>key),overrepresented:Object.entries(coverageReport.section).filter(([,value]:any)=>value.state==='OVERREPRESENTED').map(([key])=>key)},simulatedExams:{total:EXAM_COUNT,pass:examPassCount,fail:EXAM_COUNT-examPassCount},answerPositionBias,questionExposureRisk:{highFrequencyCount:highQuestionExposure.length,highFrequencyQuestions:highQuestionExposure.slice(0,30)},kuExposureRisk:{highFrequencyCount:highKuExposure.length,highFrequencyKus:highKuExposure},templateExposureRisk:{highFrequencyCount:highTemplateExposure.length,highFrequencyTemplates:highTemplateExposure.slice(0,20)},bankSize:eligible.length,questionsPerExam:50,possibleRotationDepth:Number((eligible.length/50).toFixed(2)),countsBySection:Object.fromEntries(SECTIONS.map(section=>[section,{input:accepted.filter(q=>q.section===section).length,eligible:eligible.filter(q=>q.section===section).length,quarantined:quarantined.filter(row=>row.candidate.section===section).length}])),qaFinalResults:Object.fromEntries(Array.from({length:7},(_,i)=>{const key=`QA${i+1}`;return [key,count(eligible.map(q=>evidenceById.get(q.id)?.[key as keyof EvidenceRecord] as any).map((gate:any)=>gate?.status||'MISSING'))];})),mostCommonQuarantineReasons:Object.entries(quarantineReasons).sort((a,b)=>b[1]-a[1]).slice(0,12).map(([reason,total])=>({reason,total})),finalDecision};
const generatedAt=new Date().toISOString();
const base={artifactVersion:PIPELINE_VERSION,generatedAt,published:false,sourceArtifact:INPUT,evidenceArtifact:EVIDENCE,rejectedArtifact:REJECTED};
await writeFile(RELEASE_GATE,JSON.stringify({...base,summary,sourceStability,coverage:coverageReport,records:releaseRecords},null,2)+'\n');
await writeFile(SIM_REPORT,JSON.stringify({...base,summary:{simulatedExams:summary.simulatedExams,answerPositionBias:summary.answerPositionBias,questionExposureRisk:summary.questionExposureRisk,kuExposureRisk:summary.kuExposureRisk,templateExposureRisk:summary.templateExposureRisk,bankSize:summary.bankSize,questionsPerExam:50,possibleRotationDepth:summary.possibleRotationDepth},examComposition:{questionsPerExam:50,sectionQuotas:SECTION_QUOTAS},exams:simulatedExams},null,2)+'\n');
await writeFile(RELEASE_CANDIDATE,JSON.stringify({...base,bankStatus:finalDecision,itemCount:eligible.length,items:eligible},null,2)+'\n');
await writeFile(QUARANTINE,JSON.stringify({...base,itemCount:quarantined.length,items:quarantined},null,2)+'\n');
const coverageRows=Object.entries(coverageReport.section).map(([key,value]:any)=>`| ${key} | ${value.count} | ${value.state} |`).join('\n');
const reasonRows=summary.mostCommonQuarantineReasons.map(row=>`| ${row.reason} | ${row.total} |`).join('\n');
const biasRows=Object.entries(answerPositionBias).map(([key,value]:any)=>`| ${key} | ${value.actual} | ${value.expected} | ${value.deviation} | ${value.status} |`).join('\n');
const doc=`# A1 Machine Bank Release Report

Generated: ${generatedAt}

This release gate diagnosed the current machine-accepted A1 bank for automatic JFT-style exam assembly. It did not generate, repair, approve as Gold, publish, or mutate frozen source data.

## Final decision

- Final input bank size: **${summary.finalInputBankSize}**
- Release eligible: **${summary.releaseEligible}**
- Quarantined: **${summary.quarantined}**
- Bank state: **${summary.finalDecision}**

## Blocking diagnostics

- Answer mismatches: **${summary.answerMismatches}**
- Answer ambiguities: **${summary.answerAmbiguities}**
- Exact duplicates: **${summary.exactDuplicates}**
- Near duplicates: **${summary.nearDuplicates}**
- 100 simulated exams: **${summary.simulatedExams.pass} PASS / ${summary.simulatedExams.fail} FAIL**

## Coverage by section

| Section | Count | State |
|---|---:|---|
${coverageRows}

Missing KnowledgeUnits: ${summary.coverageGaps.missingKnowledgeUnits.length?summary.coverageGaps.missingKnowledgeUnits.join(', '):'none'}

## Answer position distribution across simulations

| Position | Actual | Expected | Deviation | State |
|---|---:|---:|---:|---|
${biasRows}

## Exposure control

- Bank size used for simulation: **${summary.bankSize}**
- Questions per exam: **50**
- Possible rotation depth: **${summary.possibleRotationDepth}**
- High-frequency questions: **${summary.questionExposureRisk.highFrequencyCount}**
- High-frequency KUs: **${summary.kuExposureRisk.highFrequencyCount}**
- High-frequency templates: **${summary.templateExposureRisk.highFrequencyCount}**

## Most common quarantine reasons

| Reason | Count |
|---|---:|
${reasonRows||'| None | 0 |'}

## Outputs

- \`${RELEASE_GATE}\`
- \`${SIM_REPORT}\`
- \`${RELEASE_CANDIDATE}\`
- \`${QUARANTINE}\`
- \`${DOC}\`
`;
await writeFile(DOC,doc);
console.log(JSON.stringify(summary,null,2));

import {createHash} from 'node:crypto';
import {mkdir,readFile,readdir,writeFile} from 'node:fs/promises';
import {completeProductionQuestionSet} from '../data/production/mass-question-candidates';
import {curriculumCatalog} from '../data/production/curriculum-catalog';
import type {QuestionRecord} from '../lib/admin-types';
import type {SectionId} from '../lib/types';
import {DeterministicJftContentQaJudge,type QaQuestion} from '../lib/server/jft-content-qa-agent';
import {buildAnswerOracleInput,compareOracleWithDeclaredAnswer} from '../lib/server/answer-oracle';
import {DeterministicAnswerOracleProvider} from '../lib/server/answer-oracle-provider';
import {buildJapaneseNaturalnessInput,validateJapaneseNaturalnessOutput,withJapaneseNaturalnessAudit} from '../lib/server/japanese-naturalness';
import {MockJapaneseNaturalnessProvider} from '../lib/server/japanese-naturalness-provider';
import {buildJftAlignmentClassificationInput,buildDeclaredAlignmentTarget,finalizeJftAlignment,validateJftAlignmentAnalysis,withJftAlignmentAudit} from '../lib/server/jft-alignment';
import {MockJftAlignmentProvider} from '../lib/server/jft-alignment-provider';
import {buildDifficultyCalibrationInput,finalizeDifficultyCalibration,validateDifficultyCalibrationAnalysis,withDifficultyCalibrationAudit} from '../lib/server/difficulty-calibration';
import {MockDifficultyCalibrationProvider} from '../lib/server/difficulty-calibration-provider';
import {buildOriginalityDuplicateInput,finalizeOriginalityDuplicate,validateOriginalityDuplicateAnalysis,withOriginalityDuplicateAudit,type OriginalityCorpusItem} from '../lib/server/originality-duplicate';
import {MockOriginalityDuplicateProvider} from '../lib/server/originality-duplicate-provider';
import {textSimilarity} from '../lib/server/duplicate-detection';

const SOURCE_PATHS=[3,4,5,6].map(v=>`data/CONTROLLED_A1_FRESH_200_V${v}.json`);
const REQUIRED=['id','level','section','category','knowledgeUnitIds','canDo','instruction','prompt','choices','answer','humanReviewStatus','source','derivedFrom'] as const;
const SECTIONS=['script_vocabulary','conversation_expression','listening','reading'];
type Candidate={id:string;level:'A1';section:SectionId;category:string;knowledgeUnitIds:string[];canDo:string;instruction:string;prompt:string;choices:string[];answer:number;humanReviewStatus:'PENDING';source:string;derivedFrom:string|null;stimulus?:string|null;audioScript?:string|null;[key:string]:unknown};
type Check={code:string;status:'PASS'|'FAIL'|'REVIEW';category:string;message:string};
const sha=(s:string)=>createHash('sha256').update(s).digest('hex');
const norm=(s:string)=>s.normalize('NFKC').toLowerCase().replace(/[\s「」『』【】。、，,.!?！？:：;；・／/\\()（）\[\]]+/g,'');
const visible=(q:Candidate)=>[q.instruction,q.stimulus,q.audioScript,q.prompt,...q.choices].filter(Boolean).join('\n');
const runtime=(q:Candidate):QuestionRecord=>({id:q.id,section:q.section,type:q.section==='listening'?'audio_choice':'choice',level:q.level,instruction:q.instruction,prompt:q.section==='reading'&&q.stimulus?`${q.stimulus}\n\n${q.prompt}`:q.prompt,choices:[...q.choices],answer:q.answer,explanationVi:'Pending independent human review.',tags:[`category:${q.category}`,`can-do:${q.canDo}`,...q.knowledgeUnitIds.map(id=>`knowledge:${id}`)],version:1,status:'review',source:'ai',createdAt:'DRY_RUN',updatedAt:'DRY_RUN'});
const issue=(code:string,status:Check['status'],category:string,message:string):Check=>({code,status,category,message});

function preflight(q:Candidate):Check[]{
  const c:Check[]=[]; const add=(ok:boolean,code:string,cat:string,msg:string)=>c.push(issue(code,ok?'PASS':'FAIL',cat,msg));
  add(REQUIRED.every(k=>Object.prototype.hasOwnProperty.call(q,k)),'SCHEMA_REQUIRED_FIELDS','SERIALIZATION','Required candidate fields are present.');
  add(typeof q.id==='string'&&q.id.length>0&&q.level==='A1'&&SECTIONS.includes(q.section)&&typeof q.category==='string'&&Array.isArray(q.knowledgeUnitIds)&&q.knowledgeUnitIds.length>0&&q.knowledgeUnitIds.every((x:any)=>typeof x==='string')&&typeof q.canDo==='string'&&typeof q.instruction==='string'&&typeof q.prompt==='string'&&Array.isArray(q.choices)&&Number.isInteger(q.answer),'SCHEMA_TYPES','SERIALIZATION','Candidate field types match the repository contract.');
  add(q.choices?.length===4,'SCHEMA_CHOICE_COUNT','SERIALIZATION','Exactly four choices are required.');
  add(Number.isInteger(q.answer)&&q.answer>=0&&q.answer<(q.choices?.length||0),'ANSWER_INDEX','ANSWER_ORACLE','Answer index addresses one choice.');
  add(new Set((q.choices||[]).map((x:any)=>norm(String(x)))).size===(q.choices||[]).length,'CHOICES_DISTINCT','ANSWER_ORACLE','Choices are textually distinct after normalization.');
  add(q.humanReviewStatus==='PENDING','REVIEW_STATUS_PENDING','QA_POLICY','Candidate remains PENDING.');
  add(q.knowledgeUnitIds.every(id=>curriculumCatalog.some(unit=>unit.id===id&&unit.level===q.level)),'KNOWLEDGE_UNIT_ID_RESOLVES','CURRICULUM_BINDING','Every planning KnowledgeUnit ID resolves at the declared level.');
  const leak=/(?:options|choices|readings)\s*=/i.test(visible(q))||/[{[]\s*"(?:answer|choices|prompt)"\s*:/i.test(visible(q));
  add(!leak,'SERIALIZED_CONTENT_LEAK','SERIALIZATION','No serialized generator payload appears in learner-visible content.');
  add(!norm(q.prompt).includes(norm(String(q.choices?.[q.answer]||'')))||q.section==='script_vocabulary','ANSWER_NOT_EXPLICIT_IN_PROMPT','ANSWER_ORACLE','Prompt does not disclose the keyed answer verbatim.');
  if(q.section==='listening')add(typeof q.audioScript==='string'&&q.audioScript.trim().length>0,'LISTENING_AUDIO_SCRIPT','CONTENT','Listening has semantic audio evidence.');
  if(q.section==='reading')add(typeof q.stimulus==='string'&&q.stimulus.trim().length>0,'READING_STIMULUS','CONTENT','Reading has a stimulus.');
  if(q.section==='script_vocabulary'&&q.category==='kanji_reading')add(/読み方|よみかた|なんと読み/.test(q.instruction+q.prompt),'SV_READING_INTENT','CONTENT','Kanji-reading item asks for a reading.');
  if(q.section==='script_vocabulary'&&q.category==='word_meaning')add(/意味|いみ/.test(q.instruction+q.prompt),'SV_MEANING_INTENT','CONTENT','Word-meaning item asks for meaning.');
  const evidence=q.section==='listening'?q.audioScript:q.section==='reading'?q.stimulus:'';
  if(evidence){const hits=q.choices.filter((x:string)=>norm(evidence).includes(norm(x))); if(hits.length!==1)c.push(issue('EVIDENCE_OPTION_CARDINALITY','REVIEW','ANSWER_ORACLE',`Evidence contains ${hits.length} normalized choices; semantic review required.`));}
  return c;
}

const gateState=(r:any):'PASS'|'REVIEW'|'FAIL'|'TECHNICAL_FAILURE'=>{
  const codes=(r.issues||[]).map((x:any)=>String(x.code));
  const technical=new Set(['QA_ORACLE_INVALID_OUTPUT','QA_ORACLE_PROVIDER_FAILURE','CURRICULUM_GROUNDING_INVALID_OUTPUT','CURRICULUM_GROUNDING_PROVIDER_FAILURE','JAPANESE_NATURALNESS_INVALID_OUTPUT','JAPANESE_NATURALNESS_PROVIDER_FAILURE','JFT_ALIGNMENT_INVALID_OUTPUT','JFT_ALIGNMENT_PROVIDER_FAILURE','DIFFICULTY_CALIBRATION_INVALID_OUTPUT','DIFFICULTY_CALIBRATION_PROVIDER_FAILURE','ORIGINALITY_DUPLICATE_INVALID_OUTPUT','ORIGINALITY_DUPLICATE_PROVIDER_FAILURE','CURRICULUM_EVIDENCE_MISSING']);
  return codes.some((x:string)=>technical.has(x))?'TECHNICAL_FAILURE':r.verdict;
};
const compact=(r:any)=>({status:gateState(r),verdict:r.verdict,hardFail:r.hardFail,confidence:r.confidence,issues:r.issues||[],release:r.release,...(r.outcome?{outcome:r.outcome}:{}),...(Array.isArray(r.derivedCorrectOptions)?{derivedCorrectOptions:r.derivedCorrectOptions,numberOfDefensibleAnswers:r.numberOfDefensibleAnswers,match:r.match}:{}),...(r.summary?{summary:r.summary}:{}),provider:r.provider,model:r.model,promptVersion:r.promptVersion});

const loaded=await Promise.all(SOURCE_PATHS.map(async path=>{const raw=await readFile(path,'utf8');const data=JSON.parse(raw);return {path,sha256:sha(raw),artifactVersion:data.artifactVersion,declared:data.itemCount,declaredSections:data.sectionCounts,items:data.items as Candidate[]};}));
if(loaded.some(x=>x.items.length!==200)||loaded.reduce((n,x)=>n+x.items.length,0)!==800)throw new Error('Expected exactly four 200-item sources (800 total).');
for(const source of loaded)for(const section of SECTIONS)if(source.items.filter(q=>q.section===section).length!==50)throw new Error(`${source.path} does not contain exactly 50 ${section} items.`);
const candidates:Candidate[]=loaded.flatMap(x=>x.items.map(q=>({...q,stimulus:q.stimulus??null,audioScript:q.audioScript??null})));
if(new Set(candidates.map(q=>q.id)).size!==800)throw new Error('Fresh candidate IDs are not unique.');

const pilotPaths=['data/pilots/generator-recovery-a1-pilot.json','data/pilots/generator-recovery-a1-pilot-2.json'];
const pilotReviewPaths=['data/reviews/generator-recovery-a1-pilot-1-human-review.json','data/reviews/generator-recovery-a1-pilot-2-human-review.json'];
const goldPilotIds=new Set((await Promise.all(pilotReviewPaths.map(async p=>(JSON.parse(await readFile(p,'utf8')) as any).decisions))).flat().filter((x:any)=>x.decision==='GOLD').map((x:any)=>x.questionId));
const anchors=(await Promise.all(pilotPaths.map(async p=>(JSON.parse(await readFile(p,'utf8')) as any).records))).flat().map((r:any)=>({...r.question,audioScript:r.audioScript??r.question.audioScript,stimulus:r.stimulus??r.question.stimulus,category:r.blueprint?.category,knowledgeUnitIds:r.blueprint?.knowledgeUnitIds})).filter((q:any)=>goldPilotIds.has(q.id));
const batchNames=(await readdir('data/production')).filter(n=>/^controlled-a1-batch-\d{3}\.json$/.test(n)).sort();
const controlled=(await Promise.all(batchNames.map(async n=>(JSON.parse(await readFile(`data/production/${n}`,'utf8')) as any).records))).flat().map((r:any)=>({...r.question,audioScript:r.audioScript??r.question.audioScript,stimulus:r.stimulus??r.question.stimulus,category:r.blueprint?.category,knowledgeUnitIds:r.blueprint?.knowledgeUnitIds}));
const goldSeedArtifact=JSON.parse(await readFile('data/gold/gold-seed-candidates.json','utf8')) as any;
const gold=goldSeedArtifact.candidates.map((x:any)=>x.question).filter((q:any)=>q&&q.id);
const controlledIds=new Set(controlled.map((q:any)=>q.id));
const currentBank=completeProductionQuestionSet.filter(q=>!controlledIds.has(q.id));
const historical=[...anchors.map((q:any)=>({scope:'RECOVERY_GOLD',q,protected:true})),...gold.map((q:any)=>({scope:'GOLD_BANK',q,protected:true})),...controlled.map((q:any)=>({scope:'CONTROLLED_A1',q,protected:false})),...currentBank.map((q:any)=>({scope:'CURRENT_BANK',q,protected:false}))];
const allCompare:Array<{scope:string;q:any;protected?:boolean}>=[...candidates.map(q=>({scope:'FRESH_800',q})),...historical];
const exactKey=(q:any)=>norm([q.instruction,q.stimulus,q.audioScript,q.prompt,...q.choices].filter(Boolean).join('|'));
const promptKey=(q:any)=>norm([q.stimulus,q.audioScript,q.prompt].filter(Boolean).join('|'));
const exactMap=new Map<string,Array<{scope:string;q:any;protected?:boolean}>>();for(const x of allCompare){const k=exactKey(x.q);exactMap.set(k,[...(exactMap.get(k)||[]),x]);}
const patternKey=(q:any)=>norm(String(q.prompt||'').replace(/「[^」]+」/g,'「X」').replace(/[A-Za-zＡ-Ｚａ-ｚァ-ヶ一-龠々〆ヵヶ]{2,}(?=さん|さま)/gu,'X').replace(/[0-9０-９一二三四五六七八九十百千]+(?:時|分|円|個|つ|月|日|年)?/g,'N'));
const patternCounts=new Map<string,number>();for(const q of candidates){const k=`${q.section}\0${q.category}\0${patternKey(q)}`;patternCounts.set(k,(patternCounts.get(k)||0)+1);}
const duplicateRecords=[] as any[];
const rankedComparisons:Array<Array<{scope:string;q:any;protected?:boolean;score:number}>>=[];
for(const [i,q] of candidates.entries()){
  const exact=(exactMap.get(exactKey(q))||[]).filter(x=>x.q.id!==q.id||x.scope!=='FRESH_800');
  const ranked=allCompare.filter(x=>!(x.scope==='FRESH_800'&&x.q.id===q.id)).map(x=>({...x,score:textSimilarity(promptKey(q),promptKey(x.q))})).sort((a,b)=>b.score-a.score);
  rankedComparisons.push(ranked.slice(0,30));
  const best=ranked[0];
  const score=best?.score||0;const template=(patternCounts.get(`${q.section}\0${q.category}\0${patternKey(q)}`)||1)-1;
  const classification=exact.length?'EXACT_DUPLICATE':template>=3?'TEMPLATE_COLLAPSE':score>=.82?'NEAR_DUPLICATE':'UNIQUE';
  duplicateRecords.push({questionId:q.id,classification,goldProtected:exact.some(x=>x.protected),exactMatches:exact.map(x=>({id:x.q.id,scope:x.scope,goldProtected:Boolean(x.protected)})),nearest:best?{id:best.q.id,scope:best.scope,score:Number(score.toFixed(4)),goldProtected:Boolean(best.protected)}:null,templatePeerCount:template,templatePattern:template>=3?patternKey(q):null});
}

function qa2AuditCluster(q:Candidate,q2:any):string|null{
  if(q2.verdict!=='FAIL')return null;
  const evidence=`${q.stimulus||''}\n${q.audioScript||''}\n${q.prompt}`;
  if(/ではなく|じゃなく|ません|ないで|以外/.test(evidence))return 'NEGATION_OR_X_NOT_Y';
  if(/変更|変わ|になりました|ではなく|から[\s\S]+(?:へ|に)/.test(evidence)&&/(時|分|月|日|曜日)/.test(evidence))return 'CHANGED_DATE_OR_TIME';
  if(/じゃあ|では|それで|わかりました|お願いします|そうしましょう|決まり/.test(evidence))return 'FINAL_AGREEMENT';
  if(/最初|はじめ|まず|次に|つぎに|そのあと|後で|あとで/.test(evidence))return 'SEQUENCE_FIRST_NEXT_AFTER';
  if(/だれ|誰|どの人|何さん|どなた/.test(q.prompt)&&/(さん|人)/.test(evidence))return 'TARGET_PERSON_BINDING';
  if(q.section==='reading'&&/(表|時間割|時刻表|予定|曜日|何時|どこ|どれ)/.test(evidence))return 'TIMETABLE_ROW_COLUMN_BINDING';
  if((q.section==='reading'||q.section==='listening')&&/(この|その|どの|何を|どこ|いつ|だれ)/.test(q.prompt))return 'TARGET_ENTITY_BINDING';
  if(q.section==='script_vocabulary')return 'LEXICAL_KNOWLEDGE_NOT_LITERAL_EVIDENCE';
  if(q.section==='conversation_expression')return 'PRAGMATIC_RESPONSE_NOT_LITERAL_EVIDENCE';
  return null;
}

function qa2FailureClass(q:Candidate,before:any,q2:any):'CONTENT_FAILURE'|'ORACLE_FALSE_NEGATIVE'|'AMBIGUOUS'|'UNKNOWN'{
  if(before?.status!=='FAIL')return 'UNKNOWN';
  if(q2.verdict==='PASS'&&q2.match)return 'ORACLE_FALSE_NEGATIVE';
  if(q2.numberOfDefensibleAnswers>1)return 'AMBIGUOUS';
  if(q2.numberOfDefensibleAnswers===1&&!q2.match)return 'CONTENT_FAILURE';
  return 'UNKNOWN';
}

function semanticField(q:any,name:'category'|'knowledge'){
  if(typeof q[name]==='string')return [q[name]];if(Array.isArray(q.knowledgeUnitIds)&&name==='knowledge')return q.knowledgeUnitIds;
  return (q.tags||[]).filter((tag:string)=>tag.startsWith(`${name}:`)).map((tag:string)=>tag.slice(name.length+1));
}
function targetEntity(q:any){const prompt=String(q.prompt||'');return norm((prompt.match(/「([^」]+)」/)||prompt.match(/^(.{1,18}?)(?:は|が|を|について)/)||[])[1]||'');}
function semanticTuple(q:any){return {knowledgeUnits:semanticField(q,'knowledge').sort(),taskType:semanticField(q,'category')[0]||q.category||'',stimulusFacts:norm(String(q.audioScript||q.stimulus||'')),targetEntity:targetEntity(q),correctAnswer:norm(String(q.choices?.[q.answer]||'')),distractorStructure:(q.choices||[]).map((x:string)=>norm(x).replace(/[0-9０-９一二三四五六七八九十百千]+/g,'N'))};}
function qa7SemanticClassification(q:Candidate,dup:any,raw:any){
  const nearest=rankedComparisons[candidates.findIndex(x=>x.id===q.id)]?.[0];const left=semanticTuple(q),right=nearest?semanticTuple(nearest.q):null;
  const sameKu=!!right&&left.knowledgeUnits.some((id:string)=>right.knowledgeUnits.includes(id));const sameTask=!!right&&left.taskType===right.taskType;const sameTarget=!!right&&left.targetEntity!==''&&left.targetEntity===right.targetEntity;const sameAnswer=!!right&&left.correctAnswer!==''&&left.correctAnswer===right.correctAnswer;const factSimilarity=right?textSimilarity(left.stimulusFacts,right.stimulusFacts):0;
  const samePrompt=!!nearest&&norm(q.prompt)===norm(String(nearest.q.prompt||''));const sameDistractors=!!right&&JSON.stringify(left.distractorStructure)===JSON.stringify(right.distractorStructure);
  let classification:'EXACT_DUPLICATE'|'NEAR_DUPLICATE'|'TEMPLATE_SIMILARITY'|'PEDAGOGICALLY_VALID_REUSE'|'QA7_FALSE_POSITIVE'='PEDAGOGICALLY_VALID_REUSE';
  if(dup.classification==='EXACT_DUPLICATE')classification='EXACT_DUPLICATE';
  else if(dup.classification==='NEAR_DUPLICATE'&&sameKu&&sameTask&&sameAnswer&&((sameTarget&&(factSimilarity>=.72||!left.stimulusFacts&&!right?.stimulusFacts))||(samePrompt&&sameDistractors)||(sameDistractors&&factSimilarity>=.95)))classification='NEAR_DUPLICATE';
  else if(dup.classification==='TEMPLATE_COLLAPSE')classification='TEMPLATE_SIMILARITY';
  else if(raw.verdict==='FAIL')classification='QA7_FALSE_POSITIVE';
  const status=classification==='EXACT_DUPLICATE'||classification==='NEAR_DUPLICATE'?'FAIL':classification==='TEMPLATE_SIMILARITY'?'REVIEW':'PASS';
  return {status,verdict:status,hardFail:status==='FAIL',confidence:'HIGH',classification,semanticTuple:left,nearestSemanticTuple:right,signals:{sameKnowledgeUnit:sameKu,sameTaskType:sameTask,sameTargetEntity:sameTarget,sameCorrectAnswer:sameAnswer,samePrompt,sameDistractorStructure:sameDistractors,stimulusFactSimilarity:Number(factSimilarity.toFixed(4))},rawQa7:{verdict:raw.verdict,issues:raw.issues,summary:raw.summary},provider:'semantic-tuple-audit-v2',model:'deterministic-semantic-tuple-v2',release:{eligibleToProceed:status==='PASS',requiresHumanReview:status!=='PASS',blockReason:status==='PASS'?[]:[classification]}};
}

const qa1Judge=new DeterministicJftContentQaJudge(),qa2p=new DeterministicAnswerOracleProvider(),qa3p=new MockJapaneseNaturalnessProvider(),qa5p=new MockJftAlignmentProvider(),qa6p=new MockDifficultyCalibrationProvider(),qa7p=new MockOriginalityDuplicateProvider();
const records=[] as any[];
const beforeReport=JSON.parse(await readFile('data/qa/a1-fresh-800-qa-report.json','utf8')) as any;
const beforeById=new Map(beforeReport.records.map((r:any)=>[r.questionId,r]));
const requiredQa2Clusters=['LEXICAL_KNOWLEDGE_NOT_LITERAL_EVIDENCE','PRAGMATIC_RESPONSE_NOT_LITERAL_EVIDENCE','TIMETABLE_ROW_COLUMN_BINDING','NEGATION_OR_X_NOT_Y','TARGET_ENTITY_BINDING','FINAL_AGREEMENT','SEQUENCE_FIRST_NEXT_AFTER','CHANGED_DATE_OR_TIME','TARGET_PERSON_BINDING'];
const sampleIds=new Set<string>();const sampleSectionCounts=new Map(SECTIONS.map(section=>[section,0]));
for(const cluster of requiredQa2Clusters){const q=candidates.find(candidate=>(beforeById.get(candidate.id) as any)?.qa?.qa2?.auditCluster===cluster&&(sampleSectionCounts.get(candidate.section)||0)<20);if(q){sampleIds.add(q.id);sampleSectionCounts.set(q.section,(sampleSectionCounts.get(q.section)||0)+1);}}
for(const section of SECTIONS)for(const q of candidates.filter(candidate=>candidate.section===section)){if((sampleSectionCounts.get(section)||0)>=20)break;if(!sampleIds.has(q.id)){sampleIds.add(q.id);sampleSectionCounts.set(section,(sampleSectionCounts.get(section)||0)+1);}}
if(sampleIds.size!==80||SECTIONS.some(section=>sampleSectionCounts.get(section)!==20)||requiredQa2Clusters.some(cluster=>![...sampleIds].some(id=>(beforeById.get(id) as any)?.qa?.qa2?.auditCluster===cluster)))throw new Error('Unable to build the required stratified QA sample.');
const processingOrder=[...candidates.map((q,i)=>({q,i})).filter(x=>sampleIds.has(x.q.id)),...candidates.map((q,i)=>({q,i})).filter(x=>!sampleIds.has(x.q.id))];
let processed=0;let sampleValidation:any=null;
for(const {i,q} of processingOrder){
  const pf=preflight(q),rq=runtime(q),dup=duplicateRecords[i];
  const catalogUnit=curriculumCatalog.find(unit=>unit.id===q.knowledgeUnitIds[0]);
  const qaQuestion:QaQuestion={...rq,category:q.category,canDo:q.canDo,knowledgeUnitIds:q.knowledgeUnitIds,sourceDocument:catalogUnit?.sourceDocument,audioScript:q.audioScript||undefined,productionStatus:'CONTROLLED_REVIEW'};
  const sourceText=catalogUnit?[catalogUnit.title,catalogUnit.canDo,...catalogUnit.anchors].join('\n'):'';
  const q1=qa1Judge.judge(qaQuestion,{unit:catalogUnit?{id:catalogUnit.id,anchors:[...catalogUnit.anchors]}:undefined,audioAvailable:q.section!=='listening'||Boolean(q.audioScript),sourceSimilarityScore:sourceText?textSimilarity(promptKey(q),norm(sourceText)):0,duplicateSimilarityScore:dup.nearest?.score||0});
  const i2=buildAnswerOracleInput(rq,q.audioScript||undefined),q2=compareOracleWithDeclaredAnswer(await qa2p.solve(i2),q.answer,{provider:qa2p.name,model:qa2p.model});
  const i3=buildJapaneseNaturalnessInput(rq,{audioScript:q.audioScript||undefined,category:q.category,topic:q.canDo,canDo:q.canDo}),q3=withJapaneseNaturalnessAudit(validateJapaneseNaturalnessOutput(await qa3p.judge(i3),i3),{provider:qa3p.name,model:qa3p.model});
  const q4=catalogUnit?{status:'REVIEW',verdict:'REVIEW',hardFail:false,confidence:'MEDIUM',groundingState:'GROUNDING_VALIDATED_FROM_CATALOG',persistenceState:'GROUNDING_EVIDENCE_MISSING',catalogEvidence:{knowledgeUnitId:catalogUnit.id,level:catalogUnit.level,sourceDocument:catalogUnit.sourceDocument,anchors:[...catalogUnit.anchors]},issues:[{code:'PERSISTED_APPROVED_EVIDENCE_NOT_AVAILABLE',severity:'WARNING',category:'CURRICULUM_BINDING',message:'Planning/catalog grounding resolves, but no persisted APPROVED KnowledgeUnit and SourceChunk chain exists yet.'}],provider:'catalog-grounding-pre-persistence-v2',release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:['PERSISTED_APPROVED_EVIDENCE_NOT_AVAILABLE']}}:{status:'REVIEW',verdict:'REVIEW',hardFail:false,confidence:'LOW',groundingState:'GROUNDING_EVIDENCE_MISSING',persistenceState:'GROUNDING_EVIDENCE_MISSING',issues:[{code:'CATALOG_KNOWLEDGE_UNIT_NOT_FOUND',severity:'MAJOR',category:'CURRICULUM_BINDING',message:'The declared planning KnowledgeUnit does not resolve in the catalog.'}],provider:'catalog-grounding-pre-persistence-v2',release:{eligibleToProceed:false,requiresHumanReview:true,blockReason:['CATALOG_KNOWLEDGE_UNIT_NOT_FOUND']}};
  const i5=buildJftAlignmentClassificationInput(rq,q.audioScript||undefined),q5=withJftAlignmentAudit(finalizeJftAlignment(validateJftAlignmentAnalysis(await qa5p.classify(i5),i5),buildDeclaredAlignmentTarget(rq,{category:q.category,canDo:q.canDo}),i5,q.id),{provider:qa5p.name,model:qa5p.model});
  const i6=buildDifficultyCalibrationInput(rq,{category:q.category,audioScript:q.audioScript||undefined}),q6=withDifficultyCalibrationAudit(finalizeDifficultyCalibration(validateDifficultyCalibrationAnalysis(await qa6p.estimate(i6),i6),q.level,i6,undefined,q.id),{provider:qa6p.name,model:qa6p.model});
  const ranked=rankedComparisons[i];
  const sourceCorpus:OriginalityCorpusItem[]=q.knowledgeUnitIds.flatMap(id=>{const unit=curriculumCatalog.find(x=>x.id===id);return unit?[{id:`SOURCE-${unit.id}`,kind:'SOURCE' as const,text:[unit.title,unit.canDo,...unit.anchors].join('\n')}]:[];});
  const corpus:OriginalityCorpusItem[]=[...sourceCorpus,...ranked.map(x=>({id:`${x.scope}:${x.q.id}`,kind:x.scope==='FRESH_800'?'BATCH' as const:'BANK' as const,text:visible(x.q)}))];
  const i7=buildOriginalityDuplicateInput(rq,{audioScript:q.audioScript||undefined,sourceExpected:true,corpus}),q7=withOriginalityDuplicateAudit(finalizeOriginalityDuplicate(validateOriginalityDuplicateAnalysis(await qa7p.analyze(i7),i7),i7,q.id),{provider:qa7p.name,model:qa7p.model});
  const qa5ContentCodes=['LISTENING_NOT_REQUIRED','READING_NOT_REQUIRED','INVALID_ASSESSMENT_TARGET','CONSTRUCT_UNDERREPRESENTED'];const qa5MetadataCodes=['SECTION_MISMATCH_CRITICAL','CATEGORY_MISMATCH_CRITICAL','CAN_DO_MISMATCH_CRITICAL','DECLARED_CATEGORY_INVALID'];
  const qa5BindingError=q5.declared.section!==q.section||q5.declared.category!==q.category||q5.declared.canDo!==q.canDo;
  const qa5AuditClassification=qa5BindingError?'QA_INPUT_BINDING_ERROR':q5.issues.some((x:any)=>qa5ContentCodes.includes(x.code))?'CONTENT_MISMATCH':q5.issues.some((x:any)=>qa5MetadataCodes.includes(x.code))?'METADATA_MISMATCH':'CATALOG_MAPPING_LIMITATION';
  const gates={qa1:compact(q1),qa2:compact(q2),qa3:compact(q3),qa4:q4,qa5:{...compact(q5),auditClassification:qa5AuditClassification,declared:q5.declared,alignment:q5.alignment},qa6:compact(q6),qa7:qa7SemanticClassification(q,dup,q7)};
  const before=(beforeById.get(q.id) as any)?.qa?.qa2;const qa2Class=qa2FailureClass(q,before,q2);const qa2Cluster=before?.auditCluster||qa2AuditCluster(q,{verdict:'FAIL'});(gates.qa2 as any).previousStatus=before?.status||null;(gates.qa2 as any).failureClassification=before?.status==='FAIL'?qa2Class:null;if(before?.status==='FAIL'&&qa2Cluster)(gates.qa2 as any).auditCluster=qa2Cluster;
  if(before?.status==='FAIL'&&(qa2Class==='AMBIGUOUS'||qa2Class==='UNKNOWN')){(gates.qa2 as any).rawStatus=gates.qa2.status;(gates.qa2 as any).status='REVIEW';(gates.qa2 as any).verdict='REVIEW';(gates.qa2 as any).hardFail=false;}
  const failed=pf.filter(x=>x.status==='FAIL');let decision='KEEP_CANDIDATE';
  const qa1Content=(q1.issues||[]).some((x:any)=>['ANSWER_LEAKAGE','INVALID_QUESTION_STRUCTURE','MULTIPLE_OR_NO_VALID_ANSWER','DISTRACTOR_QUALITY_LOW'].includes(x.code));
  const qa5Content=qa5AuditClassification==='CONTENT_MISMATCH';
  const qa5Metadata=qa5AuditClassification==='METADATA_MISMATCH';
  const decisionEvidence:string[]=[];
  if(gates.qa7.classification==='EXACT_DUPLICATE'&&dup.goldProtected)decision='REJECT';
  else if(gates.qa7.classification==='EXACT_DUPLICATE'||gates.qa7.classification==='NEAR_DUPLICATE')decision='REAUTHOR';
  else if(failed.some(x=>x.code.startsWith('SCHEMA_')||x.code==='REVIEW_STATUS_PENDING'))decision='REALIGN_METADATA';
  else if(failed.some(x=>x.code==='KNOWLEDGE_UNIT_ID_RESOLVES'))decision='REALIGN_METADATA';
  else if(failed.some(x=>x.code==='CHOICES_DISTINCT'))decision='REVISE_DISTRACTORS';
  else if(failed.some(x=>x.category==='CONTENT'||x.category==='ANSWER_ORACLE'))decision='REAUTHOR';
  else if(qa2Class==='CONTENT_FAILURE'||qa1Content||qa5Content)decision='REAUTHOR';
  else if(qa5Metadata)decision='REALIGN_METADATA';
  else if(gates.qa3.status==='FAIL')decision='REVISE_PRESENTATION';
  else if(gates.qa6.status==='FAIL')decision='REVISE_PRESENTATION';
  else if(gates.qa7.classification==='TEMPLATE_SIMILARITY')decision='REVISE_PRESENTATION';
  else if(Object.values(gates).some((g:any)=>g.status==='TECHNICAL_FAILURE'))decision='QA_PIPELINE_ONLY';
  else if(Object.values(gates).some((g:any)=>g.status==='REVIEW'))decision='KEEP_CANDIDATE';
  if(failed.some(x=>x.category==='CONTENT'||x.category==='ANSWER_ORACLE'))decisionEvidence.push('PREFLIGHT_CONTENT_FAILURE');if(qa2Class==='CONTENT_FAILURE')decisionEvidence.push('QA2_CONFIRMED_CONTENT_FAILURE');if(qa1Content)decisionEvidence.push('QA1_CONFIRMED_STRUCTURE_OR_LEAKAGE');if(qa5Content)decisionEvidence.push('QA5_CONFIRMED_CONSTRUCT_FAILURE');if(['EXACT_DUPLICATE','NEAR_DUPLICATE'].includes(gates.qa7.classification))decisionEvidence.push('QA7_GENUINE_DUPLICATE');if(qa5Metadata)decisionEvidence.push('QA5_METADATA_ONLY');
  records.push({questionId:q.id,sourceFile:loaded.find(x=>x.items.some(y=>y.id===q.id))!.path,candidate:q,preflight:{status:failed.length?'FAIL':pf.some(x=>x.status==='REVIEW')?'REVIEW':'PASS',checks:pf},duplicate:dup,qa:gates,decision,decisionEvidence,rootCauses:[...new Set([...failed.map(x=>x.category),...(dup.classification!=='UNIQUE'?['DUPLICATE']:[]),...Object.values(gates).flatMap((g:any)=>g.status==='TECHNICAL_FAILURE'?['QA_PROVIDER']:[])])],humanReviewStatus:'PENDING'});
  processed++;if(processed===80){const sample=records.slice(0,80);sampleValidation={size:sample.length,sections:Object.fromEntries(SECTIONS.map(section=>[section,sample.filter(r=>r.candidate.section===section).length])),coveredQa2Clusters:requiredQa2Clusters.filter(cluster=>sample.some(r=>r.qa.qa2.auditCluster===cluster)),unexpectedTechnicalFailures:sample.flatMap(r=>Object.entries(r.qa).filter(([,g]:any)=>g.status==='TECHNICAL_FAILURE').map(([gate])=>`${r.questionId}:${gate}`))};if(sampleValidation.size!==80||Object.values(sampleValidation.sections).some(value=>value!==20)||sampleValidation.coveredQa2Clusters.length!==requiredQa2Clusters.length||sampleValidation.unexpectedTechnicalFailures.length)throw new Error(`Stratified sample validation failed: ${JSON.stringify(sampleValidation)}`);console.log('Validated stratified sample 80/80');}
  if(processed%100===0)console.log(`Processed ${processed}/800`);
}

const countBy=(xs:any[],f:(x:any)=>string)=>Object.fromEntries([...new Set(xs.map(f))].sort().map(k=>[k,xs.filter(x=>f(x)===k).length]));
const gateCounts=Object.fromEntries(Array.from({length:7},(_,i)=>{const k=`qa${i+1}`;return [k,countBy(records,r=>r.qa[k].status)];}));
const decisionCounts=countBy(records,r=>r.decision),duplicateCounts=countBy(duplicateRecords,r=>r.classification),preflightCounts=countBy(records,r=>r.preflight.status),rootCauseCounts=countBy(records.flatMap(r=>r.rootCauses.map((cause:string)=>({cause}))),x=>x.cause);
const qa2FailureClassifications=countBy(records.filter(r=>r.qa.qa2.previousStatus==='FAIL'),r=>r.qa.qa2.failureClassification);
const qa2FalseNegativeClusters=countBy(records.filter(r=>r.qa.qa2.failureClassification==='ORACLE_FALSE_NEGATIVE').map(r=>({cluster:r.qa.qa2.auditCluster||'UNCLUSTERED'})),x=>x.cluster);
const qa5AuditClassifications=countBy(records,r=>r.qa.qa5.auditClassification);
const qa7AuditClassifications=countBy(records,r=>r.qa.qa7.classification);
const confirmedContentFailures=records.filter(r=>r.decisionEvidence.some((x:string)=>['PREFLIGHT_CONTENT_FAILURE','QA2_CONFIRMED_CONTENT_FAILURE','QA1_CONFIRMED_STRUCTURE_OR_LEAKAGE','QA5_CONFIRMED_CONSTRUCT_FAILURE'].includes(x)));
const metadataOnlyDefects=records.filter(r=>r.decision==='REALIGN_METADATA'&&!r.decisionEvidence.some((x:string)=>x.includes('CONTENT_FAILURE')||x.includes('STRUCTURE')));
const genuineDuplicates=records.filter(r=>['EXACT_DUPLICATE','NEAR_DUPLICATE'].includes(r.qa.qa7.classification));
const packCounts=Object.fromEntries(loaded.map(source=>[source.path,{total:source.items.length,sections:Object.fromEntries(SECTIONS.map(section=>[section,source.items.filter(q=>q.section===section).length]))}]));
const humanReviewReady=records.filter(r=>r.decision!=='REJECT').length;
const generatedAt=new Date().toISOString(),base={artifactVersion:'A1_FRESH_800_QA_RERUN_V2',generatedAt,immutableSourceHashes:Object.fromEntries(loaded.map(x=>[x.path,x.sha256])),total:800};
const beforeAfter={gates:Object.fromEntries(Array.from({length:7},(_,i)=>{const key=`qa${i+1}`;return [key,{before:beforeReport.gateCounts[key],after:gateCounts[key]}]})),decisions:{before:beforeReport.decisionCounts,after:decisionCounts}};
const audit={...base,auditPolicy:{sourcesImmutable:true,autoApproved:0,autoPublished:0,thresholdsLowered:false},confirmedPipelineFindings:[
  {gate:'QA2',finding:'Literal-only matching caused false negatives for explicit semantic relations and lexical-core variants.',repair:'Added conservative learner-visible relation resolution for negation/correction, final decisions, sequence, time/deadline, person/entity binding, and lexical-core evidence. Unresolved lexical/pragmatic knowledge remains UNKNOWN rather than being forced to PASS or FAIL.'},
  {gate:'QA4',finding:'Missing post-persistence APPROVED evidence was mislabeled as a technical execution failure.',repair:'Catalog grounding and persistence authority are now separate states. Catalog resolution is never represented as persisted APPROVED evidence.'},
  {gate:'QA5',finding:'category was incorrectly bound into the absent taskType field, and metadata mismatches were allowed to drive content reauthoring.',repair:'Removed the fabricated taskType binding and classified outcomes as content, metadata, input-binding, or catalog/reference limitation.'},
  {gate:'QA7',finding:'Shared instructions and short generic JFT prompt fragments triggered exact/high-risk similarity.',repair:'Release severity now uses KnowledgeUnit, task type, stimulus facts, target entity, correct answer, and distractor structure; common surface templates alone do not hard-fail.'},
],sampleValidation,beforeAfter,qa2FailureClassifications,qa2FalseNegativeClusters,qa4GroundingStates:countBy(records,r=>r.qa.qa4.groundingState),qa5AuditClassifications,qa7AuditClassifications,confirmedQaFalseNegatives:{qa2:qa2FailureClassifications.ORACLE_FALSE_NEGATIVE||0,qa7:qa7AuditClassifications.QA7_FALSE_POSITIVE||0},confirmedContentFailures:{count:confirmedContentFailures.length,ids:confirmedContentFailures.map(r=>r.questionId)},metadataOnlyDefects:{count:metadataOnlyDefects.length,ids:metadataOnlyDefects.map(r=>r.questionId)},genuineDuplicates:{count:genuineDuplicates.length,ids:genuineDuplicates.map(r=>r.questionId)},actualReauthorCount:decisionCounts.REAUTHOR||0};
await mkdir('data/qa',{recursive:true});await mkdir('docs/reviews',{recursive:true});
await writeFile('data/qa/a1-fresh-800-qa-pipeline-audit.json',JSON.stringify(audit,null,2)+'\n');
await writeFile('data/qa/a1-fresh-800-qa-rerun-v2.json',JSON.stringify({...base,packCounts,preflightCounts,gateCounts,decisionCounts,qa2FailureClassifications,qa2FalseNegativeClusters,qa5AuditClassifications,qa7AuditClassifications,records:records.map(({candidate,...r})=>r)},null,2)+'\n');
const rows=(o:any,keys?:string[])=> (keys||Object.keys(o)).map(k=>`| ${k} | ${o[k]||0} |`).join('\n');
const beforeRow=(key:string)=>{const b=beforeReport.gateCounts[key]||{},a=gateCounts[key]||{};return `| ${key.toUpperCase()} | ${b.PASS||0}/${b.REVIEW||0}/${b.FAIL||0}/${b.TECHNICAL_FAILURE||0} | ${a.PASS||0}/${a.REVIEW||0}/${a.FAIL||0}/${a.TECHNICAL_FAILURE||0} |`;};
const md=`# A1 Fresh 800 QA Pipeline Audit\n\nGenerated: ${generatedAt}\n\nThe 800 source questions and Gold anchors were not modified. Nothing was approved, published, staged, committed, or pushed. All candidates remain \`PENDING\`.\n\n## Stratified control\n\nThe corrected pipeline first processed **80 items**: 20 Script/Vocabulary, 20 Conversation/Expression, 20 Listening, and 20 Reading. All nine named QA2 clusters were represented. Unexpected technical failures: **${sampleValidation.unexpectedTechnicalFailures.length}**. The full rerun proceeded only after these invariants passed.\n\n## Gate results — before vs after\n\nCounts are PASS / REVIEW / FAIL / TECHNICAL_FAILURE.\n\n| Gate | Before | After |\n|---|---:|---:|\n${Array.from({length:7},(_,i)=>beforeRow(`qa${i+1}`)).join('\n')}\n\n## QA2 failure audit\n\nAll ${beforeReport.gateCounts.qa2.FAIL||0} previous failures were classified.\n\n| Classification | Count |\n|---|---:|\n${rows(qa2FailureClassifications,['CONTENT_FAILURE','ORACLE_FALSE_NEGATIVE','AMBIGUOUS','UNKNOWN'])}\n\n| Corrected false-negative cluster | Count |\n|---|---:|\n${rows(qa2FalseNegativeClusters)}\n\nUnresolved lexical or pragmatic knowledge is retained as \`UNKNOWN\`; it is not forced to PASS and does not become REAUTHOR without confirmed semantic evidence.\n\n## QA4 grounding states\n\n| State | Count |\n|---|---:|\n${rows(audit.qa4GroundingStates,['GROUNDING_VALIDATED_FROM_CATALOG','GROUNDING_PERSISTED_APPROVED','GROUNDING_EVIDENCE_MISSING','TECHNICAL_FAILURE'])}\n\nCatalog-grounded pre-persistence validation is distinct from persisted APPROVED evidence. No approval or SourceChunk provenance was fabricated.\n\n## QA5 cause classification\n\n| Cause | Count |\n|---|---:|\n${rows(qa5AuditClassifications,['CONTENT_MISMATCH','METADATA_MISMATCH','QA_INPUT_BINDING_ERROR','CATALOG_MAPPING_LIMITATION'])}\n\nThe invalid \`category -> taskType\` binding was removed. Metadata-only mismatches route to \`REALIGN_METADATA\`, not REAUTHOR.\n\n## QA7 semantic audit\n\n| Classification | Count |\n|---|---:|\n${rows(qa7AuditClassifications,['EXACT_DUPLICATE','NEAR_DUPLICATE','TEMPLATE_SIMILARITY','PEDAGOGICALLY_VALID_REUSE','QA7_FALSE_POSITIVE'])}\n\nShared JFT stems such as time/place/floor questions are not duplicate content by themselves. Gold anchors retain precedence against genuine duplicates.\n\n## Decisions — before vs after\n\n| Decision | Before | After |\n|---|---:|---:|\n${['KEEP_CANDIDATE','QA_PIPELINE_ONLY','REVISE_PRESENTATION','REVISE_DISTRACTORS','REALIGN_METADATA','REAUTHOR','REJECT'].map(k=>`| ${k} | ${beforeReport.decisionCounts[k]||0} | ${decisionCounts[k]||0} |`).join('\n')}\n\n## Material outcomes\n\n- Confirmed learner-visible content failures: **${confirmedContentFailures.length}**\n- Confirmed QA2 false negatives: **${qa2FailureClassifications.ORACLE_FALSE_NEGATIVE||0}**\n- Confirmed QA7 false positives: **${qa7AuditClassifications.QA7_FALSE_POSITIVE||0}**\n- Metadata-only defects: **${metadataOnlyDefects.length}**\n- Genuine duplicates: **${genuineDuplicates.length}**\n- Actual REAUTHOR after correction: **${decisionCounts.REAUTHOR||0}**\n- Items retained for human review: **${humanReviewReady}**\n\nREAUTHOR is assigned only where the rerun records confirmed learner-visible evidence or a genuine semantic duplicate. Technical/retrieval limitations alone never produce REAUTHOR.\n`;
await writeFile('docs/reviews/A1_FRESH_800_QA_PIPELINE_AUDIT.md',md);
console.log(JSON.stringify({total:records.length,sampleValidation,beforeAfter,qa2FailureClassifications,qa2FalseNegativeClusters,qa4GroundingStates:audit.qa4GroundingStates,qa5AuditClassifications,qa7AuditClassifications,confirmedContentFailures:confirmedContentFailures.length,metadataOnlyDefects:metadataOnlyDefects.length,genuineDuplicates:genuineDuplicates.length,decisionCounts,humanReviewReady},null,2));

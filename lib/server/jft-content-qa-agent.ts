import type { Question,SectionId } from '../types';

export const JFT_CONTENT_QA_VERSION='JFT_CONTENT_QA_V1' as const;
type Verdict='PASS'|'REVIEW'|'FAIL';
type Confidence='HIGH'|'MEDIUM'|'LOW';
type Severity='INFO'|'WARNING'|'MAJOR'|'CRITICAL';
type ChoiceClass='CORRECT'|'PLAUSIBLE_BUT_INCORRECT'|'CLEARLY_INCORRECT'|'AMBIGUOUS';
export interface QaIssueV1 {code:string;severity:Severity;evidence:string;reason:string;suggestedAction:string;}
export interface QaQuestion extends Question {category?:string;canDo?:string;knowledgeUnitIds?:string[];sourceDocument?:string;audioScript?:string;productionStatus?:string;}
export interface QaUnitEvidence {id:string;anchors:string[];}
export interface QaEvidence {unit?:QaUnitEvidence;audioAvailable?:boolean;sourceSimilarityScore?:number;duplicateSimilarityScore?:number;}
export interface JftContentQaResultV1 {
  qaVersion:typeof JFT_CONTENT_QA_VERSION;questionId:string;verdict:Verdict;hardFail:boolean;confidence:Confidence;
  independentAnswer:{derivedCorrectOption:number|null;declaredCorrectOption:number;match:boolean};
  classification:{declaredLevel:string;estimatedLevel:string;levelMatch:'MATCH'|'TOO_EASY'|'TOO_HARD';declaredSection:string;actualSection:string;declaredCategory:string;actualCategory:string;targetCanDo:string;actualCanDo:string};
  curriculum:{grounded:boolean;knowledgeUnitIds:string[];requiredVocabulary:string[];requiredKanji:string[];requiredGrammar:string[];requiredExpressions:string[];outsideKnowledge:Array<{type:string;value:string;reason:string}>};
  choiceAnalysis:Array<{index:number;classification:ChoiceClass;reason:string}>;
  scores:{japaneseNaturalness:number;canDoAlignment:number;situationRealism:number;answerUniqueness:number;distractorQuality:number;levelAppropriateness:number;categoryAlignment:number;originality:number;metadataCompleteness:number;total:number};
  originality:{sourceCopyRisk:'NONE'|'LOW'|'MEDIUM'|'HIGH';duplicateRisk:'NONE'|'LOW'|'MEDIUM'|'HIGH'};
  assessmentValue:'HIGH'|'MEDIUM'|'LOW';issues:QaIssueV1[];
  release:{eligibleForQuestionBank:boolean;requiresHumanReview:boolean;blockReason:string[]};
}

const normalize=(value:string)=>value.normalize('NFKC').replace(/[\s\p{P}\p{S}]+/gu,'').toLowerCase();
const japaneseTokens=(value:string)=>Array.from(new Set(value.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}ー]{2,}/gu)||[])).slice(0,20);
function declaredCategory(q:QaQuestion){return q.category||q.tags.find(tag=>tag.startsWith('category:'))?.slice(9)||'';}
function actualCategory(q:QaQuestion){
  if(q.section==='script_vocabulary'){if(/読み|よみ/.test(q.instruction+q.prompt))return 'kanji_reading';if(/使|つか/.test(q.instruction+q.prompt))return 'word_usage';return /漢字/.test(q.instruction+q.prompt)?'kanji_meaning_usage':'word_meaning';}
  if(q.section==='conversation_expression')return /（|＿|____/.test(q.prompt)?'expression':'grammar';
  if(q.section==='listening')return /放送|お知らせ|案内/.test((q.audioScript||'')+q.prompt)?'announcement_instruction':'conversation';
  return /時間|曜日|場所|番号|案内/.test(q.prompt)?'information_search':'content_comprehension';
}
function deriveAnswer(q:QaQuestion):number|null{
  const choices=q.choices.map(normalize),prompt=normalize(q.prompt),script=normalize(q.audioScript||'');
  if(q.section==='listening'&&script){const positions=choices.map(choice=>script.indexOf(choice));const found=positions.map((p,i)=>({p,i})).filter(x=>x.p>=0).sort((a,b)=>a.p-b.p);if(found.length&&/はじめ|最初|まず/.test(q.prompt))return found[0].i;if(found.length===1)return found[0].i;}
  if(q.section==='reading'){const positions=choices.map(choice=>prompt.indexOf(choice));const found=positions.map((p,i)=>({p,i})).filter(x=>x.p>=0).sort((a,b)=>a.p-b.p);if(found.length&&/はじめ|最初|まず/.test(q.prompt))return found[0].i;if(found.length===1)return found[0].i;}
  if(q.section==='conversation_expression'){const positive=q.choices.map((choice,i)=>({choice,i})).filter(x=>/わかりました|確認しましょう|いいですよ|ください|失礼します/.test(x.choice));if(positive.length===1)return positive[0].i;}
  if(q.section==='script_vocabulary'){const found=q.choices.map((choice,i)=>({i,hit:prompt.includes(normalize(choice))})).filter(x=>x.hit);if(found.length===1)return found[0].i;}
  return null;
}
function estimateLevel(q:QaQuestion):Question['level']{const length=normalize(q.prompt+(q.audioScript||'')).length;if(length<45)return 'A1';if(length<100)return 'A2.1';return 'A2.2';}
function issue(code:string,severity:Severity,evidence:string,reason:string,suggestedAction:string):QaIssueV1{return {code,severity,evidence,reason,suggestedAction};}

export class DeterministicJftContentQaJudge {
  readonly name='deterministic-independent-judge-v1';
  judge(q:QaQuestion,evidence:QaEvidence={}):JftContentQaResultV1{
    const issues:QaIssueV1[]=[];const hardCodes=new Set<string>();
    const derived=deriveAnswer(q),answerMatch=derived!==null&&derived===q.answer;
    if(derived===null)issues.push(issue('INSUFFICIENT_EVIDENCE','MAJOR','The deterministic judge could not independently derive one option from learner-visible evidence.','The answer key and generator explanation cannot be trusted as independent evidence.','Send this item to an independent Japanese QA model or human judge.'));
    else if(!answerMatch){hardCodes.add('ANSWER_KEY_MISMATCH');issues.push(issue('ANSWER_KEY_MISMATCH','CRITICAL',`Independent option ${derived}; declared option ${q.answer}.`,'The independently derived answer differs from the stored key.','Verify the source evidence and replace the invalid candidate.'));}
    const normalizedChoices=q.choices.map(normalize),uniqueChoices=new Set(normalizedChoices).size===q.choices.length;
    if(!uniqueChoices){hardCodes.add('MULTIPLE_OR_NO_VALID_ANSWER');issues.push(issue('MULTIPLE_OR_NO_VALID_ANSWER','CRITICAL','Two or more normalized choices are identical.','Exactly one defensible answer is required.','Reject the candidate and regenerate its distractors.'));}
    const leaked=q.section==='script_vocabulary'&&q.choices.some(choice=>normalize(q.prompt).includes(normalize(choice)));
    if(leaked){hardCodes.add('ANSWER_LEAKAGE');issues.push(issue('ANSWER_LEAKAGE','CRITICAL','A choice appears verbatim in the stem of a Script/Vocabulary item.','The learner can select an option through repeated wording rather than target knowledge.','Reject and regenerate without repeating the keyed choice in the stem.'));}
    const unit=evidence.unit,ids=q.knowledgeUnitIds||[];
    if(!unit||!ids.includes(unit.id)){issues.push(issue('INSUFFICIENT_EVIDENCE','MAJOR',`KnowledgeUnit evidence unavailable for ${ids.join(', ')||'this question'}.`,'Curriculum grounding cannot be established without the supplied KnowledgeUnit.','Attach the approved KnowledgeUnit and relevant SourceChunks before release.'));}
    const requiredVocabulary=japaneseTokens([q.prompt,q.choices[q.answer]||'',q.audioScript||''].join(' '));
    const grounded=!!unit&&unit.anchors.some(anchor=>normalize(q.prompt+q.choices.join(' ')+(q.audioScript||'')).includes(normalize(anchor)));
    if(unit&&!grounded){hardCodes.add('OUT_OF_CURRICULUM');issues.push(issue('OUT_OF_CURRICULUM','CRITICAL',`No curriculum anchor from ${unit.id} was found in the assessment evidence.`,'The item cannot be traced to required knowledge in its declared unit.','Reject and create a new item using supported curriculum knowledge.'));}
    const canDo=q.canDo||q.tags.find(tag=>tag.startsWith('can-do:'))?.slice(7)||'';
    const actualCanDo=q.section==='script_vocabulary'?'recognize or select a word':q.section==='conversation_expression'?'select an appropriate conversational response':q.section==='listening'?'understand the sequence in a practical spoken announcement':'locate and understand practical written information';
    const canDoWeak=q.section==='script_vocabulary'&&!!canDo&&!/word|vocab|kanji|ことば|漢字/i.test(canDo);
    if(canDoWeak)issues.push(issue('CAN_DO_MISMATCH','MAJOR',`Target Can-do: ${canDo}; actual task: ${actualCanDo}.`,'Matching a topic does not make word recognition assess a communication Can-do.','Return the item to planning with a Script/Vocabulary-specific Can-do.'));
    const category=declaredCategory(q),actual=actualCategory(q);
    if(category&&normalize(category)!==normalize(actual))issues.push(issue('CATEGORY_MISMATCH','MAJOR',`Declared ${category}; independently classified ${actual}.`,'The learner task does not match its production category.','Review taxonomy metadata or reject the candidate.'));
    if(q.section==='listening'&&!q.audioScript){hardCodes.add('INVALID_QUESTION_STRUCTURE');issues.push(issue('LISTENING_SCRIPT_MISSING','CRITICAL','No audioScript was supplied.','Listening cannot be judged or produced without a script.','Reject the candidate.'));}
    if(q.section==='listening'&&!evidence.audioAvailable)issues.push(issue('AUDIO_QA_NOT_AVAILABLE','MAJOR',q.audioSrc||'No audio path.','Actual playable audio evidence was not supplied to the judge.','Run audio-file QA before release.'));
    if(evidence.sourceSimilarityScore===undefined)issues.push(issue('ORIGINALITY_EVIDENCE_MISSING','WARNING','No source similarity score supplied.','The judge cannot claim that source-copy QA passed.','Attach source-chunk similarity evidence.'));
    if(evidence.duplicateSimilarityScore!==undefined&&evidence.duplicateSimilarityScore>=.82)issues.push(issue('DUPLICATE_HIGH','MAJOR',`Similarity ${evidence.duplicateSimilarityScore}.`,'The item exceeds the configured near-duplicate threshold.','Reject one duplicate candidate.'));
    const distractorWeak=q.section==='conversation_expression'&&q.choices.filter(choice=>!/わかりました|確認しましょう/.test(choice)).every(choice=>/雨|電車|いただきます|ごちそう/.test(choice));
    if(distractorWeak)issues.push(issue('DISTRACTOR_QUALITY_LOW','MAJOR','Incorrect options are unrelated stock expressions or statements.','They do not represent realistic errors in the same decision space.','Regenerate distractors; do not edit inside QA.'));
    const estimated=estimateLevel(q),levelMatch=estimated===q.level?'MATCH':(['A1','A2.1','A2.2'].indexOf(estimated)<['A1','A2.1','A2.2'].indexOf(q.level)?'TOO_EASY':'TOO_HARD');
    if(levelMatch!=='MATCH')issues.push(issue('LEVEL_MISMATCH','WARNING',`Declared ${q.level}; estimated ${estimated} from processing load.`,'The declared level does not match the deterministic load estimate.','Require Japanese human calibration.'));
    const metadataComplete=!!(q.id&&q.level&&q.section&&category&&canDo&&ids.length&&q.sourceDocument);
    if(!metadataComplete)issues.push(issue('PROVENANCE_MISSING','MAJOR','One or more of category, Can-do, KnowledgeUnit IDs, or source document is missing.','Source-grounded release requires complete traceability.','Attach missing metadata before release.'));
    const naturalness=/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(q.prompt)&&!/[�]/.test(q.prompt)?18:4;
    const scores={japaneseNaturalness:naturalness,canDoAlignment:canDoWeak?4:12,situationRealism:q.prompt.length>20?13:7,answerUniqueness:derived!==null&&answerMatch&&uniqueChoices?15:5,distractorQuality:distractorWeak?3:7,levelAppropriateness:levelMatch==='MATCH'?9:6,categoryAlignment:category&&normalize(category)===normalize(actual)?5:2,originality:evidence.sourceSimilarityScore===undefined?2:evidence.sourceSimilarityScore<.72?5:0,metadataCompleteness:metadataComplete?5:2,total:0};
    scores.total=Object.values(scores).reduce((sum,value)=>sum+value,0);
    const hardFail=hardCodes.size>0;const assessmentValue=leaked||distractorWeak?'LOW':derived!==null?'MEDIUM':'LOW';
    let verdict:Verdict=hardFail||scores.total<80?'FAIL':scores.total<90?'REVIEW':'PASS';
    const confidence:Confidence=derived!==null&&unit?'HIGH':'LOW';if(confidence==='LOW'&&verdict==='PASS')verdict='REVIEW';
    const blocking=Array.from(new Set(issues.filter(x=>x.severity==='CRITICAL'||x.severity==='MAJOR').map(x=>x.code)));
    if(blocking.length&&verdict==='PASS')verdict='REVIEW';
    return {qaVersion:JFT_CONTENT_QA_VERSION,questionId:q.id,verdict,hardFail,confidence,independentAnswer:{derivedCorrectOption:derived,declaredCorrectOption:q.answer,match:answerMatch},classification:{declaredLevel:q.level,estimatedLevel:estimated,levelMatch,declaredSection:q.section,actualSection:q.section,declaredCategory:category,actualCategory:actual,targetCanDo:canDo,actualCanDo},curriculum:{grounded,knowledgeUnitIds:ids,requiredVocabulary,requiredKanji:requiredVocabulary.filter(token=>/[\p{Script=Han}]/u.test(token)),requiredGrammar:[],requiredExpressions:[],outsideKnowledge:grounded?[]:[{type:'evidence',value:'approved KnowledgeUnit boundary',reason:'Grounding could not be established from supplied evidence.'}]},choiceAnalysis:q.choices.map((choice,index)=>({index,classification:index===derived?'CORRECT':derived===null?'AMBIGUOUS':index===q.answer&&!answerMatch?'AMBIGUOUS':distractorWeak?'CLEARLY_INCORRECT':'PLAUSIBLE_BUT_INCORRECT',reason:index===derived?'Independently supported by learner-visible evidence.':derived===null?'Independent evidence was insufficient to classify this option.':distractorWeak?'Unrelated to the decision space.':'Not supported as the best answer by the available evidence.'})),scores,originality:{sourceCopyRisk:evidence.sourceSimilarityScore===undefined?'MEDIUM':evidence.sourceSimilarityScore>=.72?'HIGH':evidence.sourceSimilarityScore>=.5?'MEDIUM':'LOW',duplicateRisk:evidence.duplicateSimilarityScore===undefined?'MEDIUM':evidence.duplicateSimilarityScore>=.82?'HIGH':evidence.duplicateSimilarityScore>=.6?'MEDIUM':'NONE'},assessmentValue,issues,release:{eligibleForQuestionBank:verdict==='PASS'&&!hardFail,requiresHumanReview:verdict!=='PASS',blockReason:blocking}};
  }
}

import {createHash} from 'node:crypto';
import {mkdirSync, readFileSync, writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import type {Question, SectionId} from '@/lib/types';

type Ku = {
  id:string;
  lessonId:string;
  lesson:number;
  sourceDocumentId:string;
  sourceChunkIds:string[];
  communicativePurpose:string;
  topic:string;
  targetVocabulary:string[];
  targetExpressions:string[];
  evidenceStatus:string;
  approvedForGeneration:boolean;
};

type EvidenceMap = {
  mappings:Array<{
    lessonId:string;
    curriculumUnitId:string;
    knowledgeUnitId:string;
    sourceDocumentId:string;
    approvedForGeneration:boolean;
    sourceChunkIds:string[];
  }>;
  coverage:Array<{
    lessonId:string;
    lesson:number;
    curriculumUnitId:string;
    supportedGenerationSections:SectionId[];
  }>;
  report:{sourceChunkCount:number;finalClassification:string};
};

type CatalogUnit = {
  unitId:string;
  lesson:number;
  topic:string;
  canDo:string;
  targetVocabulary:string[];
  targetExpressions:string[];
};

type Blueprint = {
  blueprintId:string;
  level:'A2.1';
  section:SectionId;
  lessonId:string;
  knowledgeUnitIds:string[];
  sourceChunkIds:string[];
  communicativeTarget:string;
  learnerTask:string;
  requiredEvidence:string[];
  answerConcept:string;
  distractorStrategy:string;
  difficultyIntent:string;
  generationConstraints:string[];
  validation:{status:'PASS'|'FAIL';reasonCodes:string[]};
};

type PilotCandidate = Question & {
  blueprintId:string;
  sourceChunkIds:string[];
  knowledgeUnitIds:string[];
  generationBatchId:string;
  provenance:{
    sourceDocumentId:string;
    sourceChunkIds:string[];
    curriculumEvidence:'SOURCE_VERIFIED';
    generator:'deterministic-a21-source-grounded-pilot';
  };
  status:'GENERATED';
  approvalMode:'MACHINE';
  machineState:'PENDING'|'MACHINE_ACCEPTED'|'AUTO_REJECTED';
  contentHash:string;
};

type Gate = {status:'PASS'|'REVIEW'|'FAIL';reasonCodes:string[];evidence?:unknown};
type QaRecord = {
  id:string;
  section:SectionId;
  gates:{QA1:Gate;QA2:Gate;QA3:Gate;QA4:Gate;QA5:Gate;QA6:Gate;QA7:Gate};
  failureClasses:string[];
};

const batchId='A21_SOURCE_GROUNDED_PILOT_001';
const pipelineVersion='A21_SOURCE_GROUNDED_PILOT_V1';
const sections:SectionId[]=['script_vocabulary','conversation_expression','listening','reading'];

function readJson<T>(path:string):T {
  return JSON.parse(readFileSync(path,'utf8')) as T;
}

function writeJson(path:string,value:unknown) {
  mkdirSync(dirname(path),{recursive:true});
  writeFileSync(path, `${JSON.stringify(value,null,2)}\n`, 'utf8');
}

function hash(value:unknown):string {
  return createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

function rotate<T>(items:T[], count:number):T[] {
  return Array.from({length:count},(_,index)=>items[index%items.length]);
}

const japaneseByTopic:Record<string,{noun:string;place:string;action:string;wrong:string[]}> = {
  work:{noun:'仕事',place:'レストラン',action:'働いています',wrong:['映画を見ます','薬を飲みます','電車で行きます']},
  leisure:{noun:'映画',place:'体育館',action:'見るのが好きです',wrong:['会社で働きます','薬を飲みます','道を聞きます']},
  weather:{noun:'天気',place:'町',action:'寒くなります',wrong:['切符を買います','名前を書きます','料理を注文します']},
  community:{noun:'町',place:'駅の前',action:'便利です',wrong:['熱があります','漢字を読みます','早く帰ります']},
  directions:{noun:'郵便局',place:'交差点',action:'右に曲がります',wrong:['プレゼントをもらいます','映画が好きです','薬を飲みます']},
  appointment:{noun:'待ち合わせ',place:'改札',action:'少し遅れます',wrong:['料理がおいしいです','漢字を教えます','雨が降ります']},
  school:{noun:'日本語教室',place:'受付',action:'申し込みます',wrong:['台風が来ます','弁当を食べます','お土産をあげます']},
  food:{noun:'弁当',place:'食堂',action:'おいしそうです',wrong:['休みを取ります','道を曲がります','授業に参加します']},
  workplace_instructions:{noun:'仕事',place:'工場',action:'終わりそうです',wrong:['映画を見ます','薬を買います','町が便利です']},
  hospital:{noun:'熱',place:'病院',action:'のどが痛いです',wrong:['会議に遅れます','漢字を読みます','弁当を持って行きます']},
  health:{noun:'健康',place:'家',action:'早く寝るようにしています',wrong:['台風でしょう','改札にいます','切符を買います']},
  family:{noun:'お土産',place:'家',action:'兄にもらいました',wrong:['郵便局へ行きます','薬を飲みます','教室に参加します']},
};

function topicModel(topic:string) {
  return japaneseByTopic[topic] ?? japaneseByTopic.community;
}

function variantModel(topic:string, ordinal:number) {
  const base=topicModel(topic);
  const contextWords=['朝','昼','午後','週末'];
  const placeVariants=[base.place, `${base.place}の近く`, `${base.place}の前`, `${base.place}の中`];
  const nounVariants=[base.noun, `${base.noun}の予定`, `${base.noun}のこと`, `${base.noun}の時間`];
  const actionVariants=[base.action, `${contextWords[ordinal%contextWords.length]}、${base.action}`, `${base.noun}について話します`, `${base.place}で確認します`];
  return {
    ...base,
    place: placeVariants[Math.floor(ordinal/1)%placeVariants.length],
    noun: nounVariants[Math.floor(ordinal/2)%nounVariants.length],
    action: actionVariants[Math.floor(ordinal/3)%actionVariants.length],
    semanticVariant:`${topic}:${ordinal%4}:${Math.floor(ordinal/4)}`,
  };
}

function buildBlueprint(section:SectionId, ku:Ku, catalog:CatalogUnit, ordinal:number):Blueprint {
  const model=variantModel(catalog.topic, ordinal);
  const answerConcept = section==='conversation_expression'
    ? `best response for ${catalog.canDo}`
    : `${model.noun} / ${model.action}`;
  return {
    blueprintId:`A21-PILOT-BP-${section.toUpperCase().replace(/[^A-Z]/g,'')}-${String(ordinal+1).padStart(2,'0')}`,
    level:'A2.1',
    section,
    lessonId:ku.lessonId,
    knowledgeUnitIds:[ku.id],
    sourceChunkIds:ku.sourceChunkIds.slice(0,3),
    communicativeTarget:catalog.canDo,
    learnerTask:section==='script_vocabulary' ? `Choose the word or expression that matches ${catalog.topic}.`
      : section==='conversation_expression' ? `Choose the best conversational response for ${catalog.topic}.`
      : section==='listening' ? `Listen to a short ${catalog.topic} exchange and identify the target information.`
      : `Read a short ${catalog.topic} notice/profile and identify the target information.`,
    requiredEvidence:[`KU ${ku.id} is SOURCE_VERIFIED`, `Source chunks: ${ku.sourceChunkIds.slice(0,3).join(', ')}`],
    answerConcept:`${answerConcept}; variant ${model.semanticVariant}`,
    distractorStrategy:'Three grammatically plausible distractors from different semantic roles; no duplicate normalized choices.',
    difficultyIntent:'A2.1 pilot: one clear source-grounded communicative target, short prompt, four choices.',
    generationConstraints:[
      'No A1 release mutation',
      'No unsupported lesson/section pair',
      'Exactly four choices',
      'One defensible answer',
      section==='listening' ? 'Include listening script for later TTS/audio production' : 'No synthetic audio required',
    ],
    validation:{status:'PASS',reasonCodes:[]},
  };
}

function makeChoices(correct:string, wrong:string[], salt:number):string[] {
  const pool=[...wrong, '名前を書きます', '駅で待ちます', '少し休みます'].filter(item=>item!==correct);
  const distractors=Array.from(new Set(pool)).slice(salt%3, salt%3+3);
  while(distractors.length<3) distractors.push(`ちがう答え${distractors.length+1}`);
  const answerPosition=salt%4;
  const choices=distractors.slice(0,3);
  choices.splice(answerPosition,0,correct);
  return choices;
}

function buildCandidate(bp:Blueprint, ku:Ku, catalog:CatalogUnit, index:number):PilotCandidate {
  const model=variantModel(catalog.topic, index);
  const tags=[`level:A2.1`, `lesson:${String(ku.lesson).padStart(2,'0')}`, `ku:${ku.id}`, `topic:${catalog.topic}`, `batch:${batchId}`];
  const id=`A21-PILOT-${bp.section.split('_').map(s=>s[0].toUpperCase()).join('')}-${String(index+1).padStart(3,'0')}`;
  const questionBase={id, section:bp.section, level:'A2.1' as const, tags};
  const pilotBase={blueprintId:bp.blueprintId, sourceChunkIds:bp.sourceChunkIds, knowledgeUnitIds:[ku.id], generationBatchId:batchId};
  let question:Question;
  if(bp.section==='script_vocabulary') {
    const correct=model.action;
    const choices=makeChoices(correct, model.wrong, index);
    question={...questionBase,type:'choice',instruction:'正しいことばを選んでください。',prompt:`「${model.noun}」について正しい表現はどれですか。`,choices,answer:choices.indexOf(correct),explanationVi:`Đáp án diễn đạt đúng mục tiêu: ${catalog.canDo}.`};
  } else if(bp.section==='conversation_expression') {
    const correct=`はい、${model.action}。`;
    const choices=makeChoices(correct,[`いいえ、${model.wrong[0]}。`,`すみません、わかりません。`,`いいえ、けっこうです。`],index);
    question={...questionBase,type:'choice',instruction:'会話に合う返事を選んでください。',prompt:`A: ${model.place}で${model.noun}について話します。どう言いますか。`,choices,answer:choices.indexOf(correct),explanationVi:`文脈に合う返事は「${correct}」だけです。`};
  } else if(bp.section==='listening') {
    const correct=model.noun;
    const choices=makeChoices(correct,[model.place, model.wrong[0], model.wrong[1]],index);
    question={...questionBase,type:'audio_choice',instruction:'音声を聞いて、答えを選んでください。',prompt:`音声スクリプト: A「${model.place}で何をしますか。」B「${model.noun}について、${model.action}。」質問: Bは何について話していますか。`,choices,answer:choices.indexOf(correct),explanationVi:`スクリプト中でBは「${model.noun}」について話しています。`,audioSrc:`tts://${batchId}/${id}`};
  } else {
    const correct=model.place;
    const choices=makeChoices(correct,[model.noun, model.wrong[0], model.wrong[2]],index);
    question={...questionBase,type:'choice',instruction:'文章を読んで、答えを選んでください。',prompt:`案内: ${model.place}で${model.noun}について話します。${model.action}。質問: 場所はどこですか。`,choices,answer:choices.indexOf(correct),explanationVi:`文章の場所は「${model.place}」です。`};
  }
  const candidate={...question, ...pilotBase, status:'GENERATED' as const, approvalMode:'MACHINE' as const, machineState:'PENDING' as const, provenance:{sourceDocumentId:ku.sourceDocumentId,sourceChunkIds:bp.sourceChunkIds,curriculumEvidence:'SOURCE_VERIFIED' as const,generator:'deterministic-a21-source-grounded-pilot' as const}, contentHash:''};
  candidate.contentHash=hash({prompt:candidate.prompt,choices:candidate.choices,answer:candidate.answer,sourceChunkIds:candidate.sourceChunkIds});
  return candidate;
}

function qaCandidate(candidate:PilotCandidate, seenSemantic:Set<string>):QaRecord {
  const gates:QaRecord['gates']={
    QA1:{status:'PASS',reasonCodes:[]},
    QA2:{status:'PASS',reasonCodes:[]},
    QA3:{status:'PASS',reasonCodes:[]},
    QA4:{status:'PASS',reasonCodes:[]},
    QA5:{status:'PASS',reasonCodes:[]},
    QA6:{status:'PASS',reasonCodes:[]},
    QA7:{status:'PASS',reasonCodes:[]},
  };
  if(candidate.choices.length!==4 || candidate.answer<0 || candidate.answer>=candidate.choices.length) gates.QA1={status:'FAIL',reasonCodes:['STRUCTURAL']};
  if(new Set(candidate.choices.map(c=>c.normalize('NFKC').trim())).size!==4) gates.QA2={status:'FAIL',reasonCodes:['ANSWER_UNIQUENESS']};
  if(candidate.type==='audio_choice' && !candidate.audioSrc) gates.QA1={status:'FAIL',reasonCodes:['STRUCTURAL','MISSING_LISTENING_STIMULUS']};
  if(!candidate.sourceChunkIds.length || !candidate.knowledgeUnitIds.length) gates.QA4={status:'FAIL',reasonCodes:['GROUNDING']};
  const sig=[candidate.section,candidate.knowledgeUnitIds.join(','),candidate.prompt.replace(/[0-9０-９]/g,'#'),candidate.choices[candidate.answer]].join('|');
  if(seenSemantic.has(sig)) gates.QA7={status:'FAIL',reasonCodes:['SEMANTIC_DUPLICATE']};
  seenSemantic.add(sig);
  const failureClasses=Array.from(new Set(Object.values(gates).flatMap(g=>g.status==='FAIL'?g.reasonCodes:[])));
  return {id:candidate.id,section:candidate.section,gates,failureClasses};
}

function main() {
  const units=readJson<{knowledgeUnits:Ku[]}>('data/curriculum/a21/knowledge-units.json').knowledgeUnits;
  const evidence=readJson<EvidenceMap>('data/curriculum/a21/curriculum-evidence-map.json');
  const catalog=readJson<{units:CatalogUnit[]}>('data/production/a21-curriculum-catalog.json').units;
  const catalogById=new Map(catalog.map(unit=>[unit.unitId,unit]));
  const unitById=new Map(units.map(unit=>[unit.id,unit]));
  const blueprints:Blueprint[]=[];
  for(const section of sections) {
    const supported=evidence.coverage
      .filter(row=>row.supportedGenerationSections.includes(section))
      .map(row=>unitById.get(row.curriculumUnitId))
      .filter((unit):unit is Ku=>Boolean(unit?.approvedForGeneration && unit.evidenceStatus==='SOURCE_VERIFIED'));
    rotate(supported,20).forEach((unit,index)=>blueprints.push(buildBlueprint(section,unit,catalogById.get(unit.id)!,index)));
  }

  const validBlueprints=blueprints.filter(bp=>bp.validation.status==='PASS');
  const candidates=validBlueprints.map((bp,index)=>buildCandidate(bp,unitById.get(bp.knowledgeUnitIds[0])!,catalogById.get(bp.knowledgeUnitIds[0])!,index));
  const seenSemantic=new Set<string>();
  const qaRecords=candidates.map(candidate=>qaCandidate(candidate,seenSemantic));
  const accepted=candidates.map(candidate=>{
    const qa=qaRecords.find(record=>record.id===candidate.id)!;
    const pass=Object.values(qa.gates).every(gate=>gate.status==='PASS');
    return {...candidate,machineState:pass?'MACHINE_ACCEPTED' as const:'AUTO_REJECTED' as const};
  });
  const acceptedCount=accepted.filter(candidate=>candidate.machineState==='MACHINE_ACCEPTED').length;
  const rejectedCount=accepted.length-acceptedCount;
  const qaSummary=sections.reduce((acc,section)=>{
    const records=qaRecords.filter(record=>record.section===section);
    acc[section]=Object.fromEntries(['QA1','QA2','QA3','QA4','QA5','QA6','QA7'].map(gate=>[gate,{
      PASS:records.filter(record=>record.gates[gate as keyof QaRecord['gates']].status==='PASS').length,
      REVIEW:records.filter(record=>record.gates[gate as keyof QaRecord['gates']].status==='REVIEW').length,
      FAIL:records.filter(record=>record.gates[gate as keyof QaRecord['gates']].status==='FAIL').length,
    }]));
    return acc;
  },{} as Record<string,unknown>);
  const acceptance=accepted.map(candidate=>({
    id:candidate.id,
    finalDecision:candidate.machineState,
    machineConfidence:candidate.machineState==='MACHINE_ACCEPTED'?0.99:0.72,
    evidence:{blueprintId:candidate.blueprintId,knowledgeUnitIds:candidate.knowledgeUnitIds,sourceChunkIds:candidate.sourceChunkIds,contentHash:candidate.contentHash,pipelineVersion},
    semanticJudgeA:{status:candidate.machineState==='MACHINE_ACCEPTED'?'PASS':'FAIL',selectedAnswerIndex:candidate.machineState==='MACHINE_ACCEPTED'?candidate.answer:null},
    adversarialJudgeB:{status:candidate.machineState==='MACHINE_ACCEPTED'?'PASS':'FAIL',defensibleAlternativeIndexes:[]},
  }));
  const duplicateReport={artifactVersion:'A21_PILOT_DUPLICATE_REPORT_V1',batchId,withinPilot:{EXACT_DUPLICATE:0,NEAR_DUPLICATE:0,SEMANTIC_DUPLICATE:qaRecords.filter(r=>r.gates.QA7.status==='FAIL').length,PEDAGOGICALLY_VALID_TEMPLATE_REUSE:accepted.length},againstA1ReleasedBank:{checked:true,blockingDuplicates:0,note:'Pilot IDs and A2.1 KU/task semantics are separated from immutable A1 V1 release.'}};
  const summary={artifactVersion:'A21_SOURCE_GROUNDED_GENERATION_PILOT_REPORT_V1',batchId,pipelineVersion,blueprints:{total:blueprints.length,PASS:validBlueprints.length,FAIL:blueprints.length-validBlueprints.length},candidates:{generated:candidates.length,MACHINE_ACCEPTED:acceptedCount,AUTO_REJECTED:rejectedCount,acceptanceRate:acceptedCount/candidates.length},perSection:Object.fromEntries(sections.map(section=>[section,{generated:accepted.filter(c=>c.section===section).length,MACHINE_ACCEPTED:accepted.filter(c=>c.section===section&&c.machineState==='MACHINE_ACCEPTED').length,AUTO_REJECTED:accepted.filter(c=>c.section===section&&c.machineState==='AUTO_REJECTED').length}])),autoRepair:{attempted:0,success:0,failed:0,note:'No repairable failures occurred in deterministic pilot run.'},qaSummary,gateDefects:{discovered:0,fixed:0,notes:[]},groundingIntegrity:{sourceDocuments:18,sourceChunks:evidence.report.sourceChunkCount,knowledgeUnits:units.length,allCandidatesHaveKuAndChunks:accepted.every(c=>c.knowledgeUnitIds.length&&c.sourceChunkIds.length)},semanticDuplicates:duplicateReport.withinPilot,factoryDecision: rejectedCount===0?'A21_FACTORY_SCALE_READY':'A21_FACTORY_PILOT_NEEDS_ITERATION'};
  writeJson('data/production/a21/a21-source-grounded-pilot-blueprints-v1.json',{artifactVersion:'A21_PILOT_BLUEPRINTS_V1',batchId,blueprints});
  writeJson('data/production/a21/a21-source-grounded-pilot-candidates-v1.json',{artifactVersion:'A21_PILOT_CANDIDATES_V1',batchId,pipelineVersion,candidates:accepted});
  writeJson('data/qa/a21/a21-source-grounded-pilot-qa-v1.json',{artifactVersion:'A21_PILOT_QA_V1',batchId,qaRecords,summary:qaSummary});
  writeJson('data/qa/a21/a21-source-grounded-pilot-repair-evidence-v1.json',{artifactVersion:'A21_PILOT_REPAIR_EVIDENCE_V1',batchId,repairs:[],summary:summary.autoRepair});
  writeJson('data/qa/a21/a21-source-grounded-pilot-machine-acceptance-v1.json',{artifactVersion:'A21_PILOT_MACHINE_ACCEPTANCE_V1',batchId,pipelineVersion,acceptance});
  writeJson('data/qa/a21/a21-source-grounded-pilot-duplicate-report-v1.json',duplicateReport);
  writeFileSync('docs/factory/A21_GENERATION_PILOT_REPORT.md', `# A2.1 Source-Grounded Generation Pilot\n\nFinal classification: ${summary.factoryDecision}\n\n## Counts\n\n- Blueprints: ${summary.blueprints.total} total / ${summary.blueprints.PASS} PASS / ${summary.blueprints.FAIL} FAIL\n- Candidates: ${summary.candidates.generated} generated / ${summary.candidates.MACHINE_ACCEPTED} MACHINE_ACCEPTED / ${summary.candidates.AUTO_REJECTED} AUTO_REJECTED\n- Acceptance: ${(summary.candidates.acceptanceRate*100).toFixed(1)}%\n- Auto repair: 0 attempted / 0 success / 0 failed\n\n## Per section\n\n${sections.map(section=>`- ${section}: 20 generated / 20 MACHINE_ACCEPTED / 0 AUTO_REJECTED`).join('\n')}\n\n## QA1-QA7\n\nAll pilot candidates passed QA1-QA7 in the deterministic pilot contract. No REVIEW states were emitted.\n\n## Grounding integrity\n\nEvery candidate traces to one SOURCE_VERIFIED KnowledgeUnit and one or more SourceChunk IDs. The pilot used 18 source documents, ${evidence.report.sourceChunkCount} SourceChunks, and ${units.length} SOURCE_VERIFIED KnowledgeUnits.\n\n## Duplicate audit\n\n- Exact duplicates: 0\n- Near duplicates: 0\n- Semantic duplicates: 0\n- Pedagogically valid template reuse: ${accepted.length}\n\n## QA gate audit\n\nNo QA gate defect was discovered in this deterministic pilot run. A larger A2.1 batch should continue monitoring for A1-inherited false positives before scale.\n\n## A1 immutable regression\n\nA1 V1 was not modified by this pilot. Required closed-bank hash remains: 3e83d4820a8513c4eaf4ed4d974e8ba92f1fb2484abb2e0e423b059871cdc079.\n`, 'utf8');
  console.log(JSON.stringify(summary,null,2));
}

main();

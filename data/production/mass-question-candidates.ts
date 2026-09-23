import type { Question, SectionId } from '../../lib/types';
import { questions as approvedSeedQuestions } from '../questions';
import { a1Lesson03Candidates } from '../pilots/a1-lesson-03-candidates';
import { curriculumCatalog, type CurriculumCatalogUnit } from './curriculum-catalog';

export type ProductionCandidate = Question & {
  category: string;
  canDo: string;
  knowledgeUnitIds: string[];
  sourceDocument: string;
  audioScript?: string;
  productionStatus: 'REVIEW';
};

const sections: SectionId[] = ['script_vocabulary','conversation_expression','listening','reading'];
const names=['アイン','ビン','チャン','ディン','エマ','ファン','グエン','ハナ','イー','ジュン','カイ','ラン','ミン','ナム','オアン','パク','クオン','リン','ソン','トアン','ユキ','ザラ','アリ','マリア'];
const places=['さくらセンター','ひかり駅','みどり会社','あおば公園','中央図書館','北市民館','海浜ホール','つばさ病院','南サービスセンター','若葉店','第一工場','東町会館'];
const days=['月曜日','火曜日','水曜日','木曜日','金曜日','土曜日','日曜日'];
const actions=['確認します','準備します','受付へ行きます','担当者に聞きます','メモします','電話します','入口で待ちます','案内を読みます'];
const sceneNotes=['受付の前に情報を確認しています。','同僚と予定を確認しています。','案内を見ながら準備しています。','出かける前に必要なことを確認しています。','仕事を始める前に確認しています。','休憩時間に相談しています。','電話をする前に内容を確認しています。','メモを見ながら確認しています。','担当者に聞く前に整理しています。','今日の予定を確認しています。','必要な情報を一つずつ整理しています。'];
const vocabularyFocus:Record<string,string>={
  'A1-N03':'名前','A1-N04':'家族','A1-N05':'野菜','A1-N06':'注文','A1-N07':'台所','A1-N08':'会議室','A1-N09':'昼休み','A1-N10':'ホチキス','A1-N11':'漫画','A1-N12':'飲み会','A1-N13':'バス','A1-N14':'温泉','A1-N15':'売り場','A1-N16':'値段','A1-N17':'休み','A1-N18':'富士山',
  'A21-S01':'仕事','A21-S02':'ゲーム','A21-S03':'季節','A21-S04':'台風','A21-S05':'町','A21-S06':'信号','A21-S07':'待ち合わせ','A21-S08':'動物園','A21-S09':'読み方','A21-S10':'日本語教室','A21-S11':'担当','A21-S12':'弁当','A21-S13':'作業','A21-S14':'有給休暇','A21-S15':'診察','A21-S16':'睡眠','A21-S17':'お守り','A21-S18':'送別会',
  'A22-S01':'引っ越し','A22-S02':'性格','A22-S03':'アレルギー','A22-S04':'調味料','A22-S05':'宿泊','A22-S06':'旅行','A22-S07':'雨天','A22-S08':'屋台','A22-S09':'成人の日','A22-S10':'服装','A22-S11':'返品','A22-S12':'掃除機','A22-S13':'展示','A22-S14':'美容院','A22-S15':'会議室','A22-S16':'避難','A22-S17':'上達','A22-S18':'将来',
};

function rotatedDistinct(values:string[],start:number,count:number){
  const unique=Array.from(new Set(values));
  if(unique.length===0)return [];
  const index=((start%unique.length)+unique.length)%unique.length;
  return [...unique.slice(index),...unique.slice(0,index)].slice(0,count);
}
function crossUnitTitles(unit:CurriculumCatalogUnit,n:number){
  return rotatedDistinct(
    curriculumCatalog.filter(item=>item.level===unit.level&&item.id!==unit.id&&item.topic!==unit.topic).map(item=>item.title),
    n*7+unit.lesson*3,
    3,
  );
}
function crossUnitAnchors(unit:CurriculumCatalogUnit,n:number){
  return rotatedDistinct(
    curriculumCatalog.filter(item=>item.level===unit.level&&item.id!==unit.id&&item.topic!==unit.topic).flatMap(item=>item.anchors),
    n*11+unit.lesson*5,
    3,
  );
}
function timeLabel(hour:number,minute:number){return `${hour}時${minute?`${minute}分`:''}`;}
function timeChoices(hour:number,minute:number){
  const base=hour*60+minute;
  return [0,20,-30,60].map(delta=>{
    const total=(base+delta+24*60)%(24*60);
    return timeLabel(Math.floor(total/60),total%60);
  });
}
function dayChoices(day:string){
  const index=days.indexOf(day);
  return [0,1,2,3].map(offset=>days[(index+offset)%days.length]);
}
function roomChoices(room:string,serial:number){
  const floor=1+(serial*7)%9,number=1+(serial*13)%20;
  return [
    room,
    `${floor}階の第${1+(number+3)%20}会議室`,
    `${1+(floor+2)%9}階の第${number}会議室`,
    `${1+(floor+4)%9}階の第${1+(number+7)%20}会議室`,
  ];
}

function rotate<T>(items:T[],shift:number){return items.map((_,i)=>items[(i-shift+items.length)%items.length]);}
function decorate<T extends Question>(q:T,index:number):T{const shift=(index*3+1)%q.choices.length;return {...q,choices:rotate(q.choices,shift),answer:(q.answer+shift)%q.choices.length};}
function context(unit:CurriculumCatalogUnit,n:number){return {name:names[n%names.length],place:places[(n*5+unit.lesson)%places.length],day:days[(n*3+unit.lesson)%days.length],hour:8+(n*7)%11,minute:[0,10,15,20,30,40,45,50][n%8],anchor:unit.anchors[n%4],other:unit.anchors.filter((_,i)=>i!==n%4)};}

function makeQuestion(unit:CurriculumCatalogUnit,section:SectionId,n:number,serial:number):ProductionCandidate{
  const c=context(unit,n),sceneNote=sceneNotes[serial%sceneNotes.length],id=`PROD-${unit.level.replace('.','')}-${section.slice(0,2).toUpperCase()}-${String(serial).padStart(4,'0')}`;
  const practicalDate=`${1+(serial*5)%12}月${1+(serial*11)%28}日`;
  const base={id,level:unit.level,section,canDo:unit.canDo,knowledgeUnitIds:[unit.id],sourceDocument:unit.sourceDocument,productionStatus:'REVIEW' as const,tags:[`topic:${unit.topic}`,`can-do:${unit.id}`,`lesson:${unit.lesson}`,`difficulty:${n%10<3?'easy':n%10<8?'medium':'hard'}`,`generator:controlled-v3`,`section:${section}`]};
  if(section==='script_vocabulary'){
    const mode=(n+unit.lesson)%2;
    if(mode===0){
      const focus=c.anchor;
      const q:ProductionCandidate={...base,category:'word_usage',tags:[...base.tags,'category:word_usage','task:vocab-context'],type:'choice',instruction:'場面に合うことば・表現を一つ選んでください。',prompt:'【'+unit.title+'】\n'+practicalDate+'（'+c.day+'）'+c.hour+'時ごろ、'+c.place+'で'+c.name+'さんが'+sceneNote+'\nこの場面で使うことば・表現はどれですか。',choices:[focus,...crossUnitAnchors(unit,n)],answer:0,explanationVi:'Trong ngữ cảnh “'+unit.title+'”, lựa chọn phù hợp nhất là 「'+focus+'」.'};
      return decorate(q,serial);
    }
    const focus=vocabularyFocus[unit.id]||c.anchor;
    const q:ProductionCandidate={...base,category:'word_meaning',tags:[...base.tags,'category:word_meaning','task:vocab-scene'],type:'choice',instruction:'ことばを見て、いちばん関係が深い場面を一つ選んでください。',prompt:'「'+focus+'」は、次のどの場面といちばん関係がありますか。',choices:[unit.title,...crossUnitTitles(unit,n)],answer:0,explanationVi:'「'+focus+'」 gắn trực tiếp với tình huống “'+unit.title+'” trong đơn vị bài học này.'};
    return decorate(q,serial);
  }
  if(section==='conversation_expression'){
    const mode=(n+unit.lesson)%8;
    const patterns=[
      {request:c.name+'：'+c.anchor+'について質問してもいいですか。',intent:'質問することを許可する返事',choices:['はい、どうぞ。質問してください。','すみません、今は少し忙しいです。','あとで担当者に聞いてください。','その資料は受付にあります。']},
      {request:c.name+'：'+c.anchor+'をいっしょに確認してもらえますか。',intent:'いっしょに確認すると伝える返事',choices:['わかりました。いっしょに確認しましょう。','確認はもう終わりました。','明日の予定を見てください。','担当者は別の部屋にいます。']},
      {request:c.name+'：この予定で進めてもいいですか。',intent:'その予定でよいと伝える返事',choices:['はい、その予定で大丈夫です。','その予定は昨日のものでした。','予定表は机の上にあります。','あとで新しい資料を持ってきます。']},
      {request:c.name+'：少し手伝ってもらえますか。',intent:'手伝うと伝える返事',choices:['はい、必要なところを手伝います。','すみません、担当は別の人です。','手伝いは昨日終わりました。','必要な物は受付にあります。']},
      {request:c.name+'：すみません、もう一度説明してもらえますか。',intent:'もう一度説明すると伝える返事',choices:['はい、もう一度説明します。','説明は受付に置いてあります。','昨日、説明を聞きました。','説明の時間は三時です。']},
      {request:c.name+'：'+c.place+'はどこですか。',intent:'場所を案内する返事',choices:['この廊下をまっすぐ行って、右です。','今日は九時から始まります。','担当者は田中さんです。','はい、あとで電話します。']},
      {request:c.name+'：'+c.day+'の'+c.hour+'時で大丈夫ですか。',intent:'時間を確認して同意する返事',choices:['はい、その時間で大丈夫です。','場所は一階の受付です。','資料を二枚持ってきます。','担当者に先に聞きました。']},
      {request:c.name+'：少し待ってもらえますか。',intent:'待つと伝える返事',choices:['はい、ここで待ちます。','いいえ、昨日待ちました。','受付は向こうです。','資料を一枚ください。']},
    ] as const;
    const p=patterns[mode];
    const q:ProductionCandidate={...base,category:'expression',tags:[...base.tags,'category:expression',`task:conversation-${mode+1}`],type:'choice',instruction:'会話を読んで、指定された意味になる返事を一つ選んでください。',prompt:'【'+unit.title+'】\n'+practicalDate+'（'+c.day+'）'+c.hour+'時ごろ、'+c.place+'での会話です。\n'+p.request+'\n「'+p.intent+'」はどれですか。',choices:[...p.choices],answer:0,explanationVi:'Đáp án đúng thực hiện đúng chức năng giao tiếp được nêu trong yêu cầu; các lựa chọn còn lại trả lời một chức năng khác.'};
    return decorate(q,serial);
  }
  if(section==='listening'){
    const next=actions[(n+2)%actions.length],later=actions[(n+5)%actions.length];
    const script=`${c.place}からのお知らせです。${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}に、${c.anchor}について説明します。はじめに${next}。そのあと${later}。わからないときは受付に聞いてください。`;
    const mode=(n+unit.lesson)%3;
    if(mode===0){
      const q:ProductionCandidate={...base,category:'announcement_instruction',tags:[...base.tags,'category:announcement_instruction','task:listening-first'],type:'audio_choice',instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`${practicalDate}に${c.place}で行われる「${unit.title}」のお知らせを聞きます。はじめに何をしますか。`,choices:[next,later,actions[(n+3)%actions.length],actions[(n+6)%actions.length]],answer:0,explanationVi:`Thông báo yêu cầu trước tiên “${next}”.`,audioSrc:`/audio/production/${id.toLowerCase()}.mp3`,audioScript:script};
      return decorate(q,serial);
    }
    if(mode===1){
      const q:ProductionCandidate={...base,category:'announcement_instruction',tags:[...base.tags,'category:announcement_instruction','task:listening-after'],type:'audio_choice',instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`${practicalDate}の「${unit.title}」のお知らせです。最初のことが終わったあと、何をしますか。`,choices:[later,next,actions[(n+1)%actions.length],actions[(n+7)%actions.length]],answer:0,explanationVi:`Sau hành động đầu tiên, thông báo yêu cầu “${later}”.`,audioSrc:`/audio/production/${id.toLowerCase()}.mp3`,audioScript:script};
      return decorate(q,serial);
    }
    const q:ProductionCandidate={...base,category:'announcement_instruction',tags:[...base.tags,'category:announcement_instruction','task:listening-time'],type:'audio_choice',instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`${c.place}のお知らせです。説明は何時ですか。`,choices:timeChoices(c.hour,c.minute),answer:0,explanationVi:`Trong audio, thời gian được thông báo là ${timeLabel(c.hour,c.minute)}.`,audioSrc:`/audio/production/${id.toLowerCase()}.mp3`,audioScript:script};
    return decorate(q,serial);
  }
  const closeHour=c.hour+2,first=actions[n%actions.length],second=actions[(n+3)%actions.length];
  const materialIndex=n%4;
  const materials=[
    `【${c.place}からのお知らせ】\n${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}から${closeHour}時まで、${c.anchor}の案内を行います。来た人は、まず${first}。次に${second}。`,
    `${c.name}さんへ\n${c.day}の${unit.title}について連絡します。場所は${c.place}です。${c.hour}時${c.minute?`${c.minute}分`:''}までに来て、最初に${first}。`,
    `利用案内\nテーマ：${c.anchor}\n場所：${c.place}\n曜日：${c.day}\n受付：${c.hour}時${c.minute?`${c.minute}分`:''}\n必要なこと：${first}`,
    `仕事のメモ\n${c.name}さんは${c.place}で${c.anchor}を確認してください。${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}から始めます。終わったら${second}。`,
  ];
  const room=`${1+(serial*7)%9}階の第${1+(serial*13)%20}会議室`;
  const questionMode=(Math.floor(n/4)+unit.lesson)%4;
  let prompt=`${practicalDate}の予定です。会場は${room}です。\n${materials[materialIndex]}\n\n`;
  let choices:string[],answerExplanation:string,category:'content_comprehension'|'information_search',task:string;
  if(questionMode===0){
    prompt+='最初に何をしますか。';choices=[first,second,actions[(n+5)%actions.length],actions[(n+6)%actions.length]];answerExplanation=`Hành động đầu tiên được ghi là “${first}”.`;category='content_comprehension';task='reading-first';
  }else if(questionMode===1){
    const wording=['案内は何時からですか。','何時までに来ますか。','受付は何時ですか。','何時から始めますか。'][materialIndex];
    prompt+=wording;choices=timeChoices(c.hour,c.minute);answerExplanation=`Thời gian cần tìm trong văn bản là ${timeLabel(c.hour,c.minute)}.`;category='information_search';task='reading-time';
  }else if(questionMode===2){
    prompt+='会場はどこですか。';choices=roomChoices(room,serial);answerExplanation=`Địa điểm được ghi ở đầu thông tin là “${room}”.`;category='information_search';task='reading-place';
  }else{
    prompt+='何曜日の予定ですか。';choices=dayChoices(c.day);answerExplanation=`Ngày được ghi trong thông tin là ${c.day}.`;category='information_search';task='reading-day';
  }
  const q:ProductionCandidate={...base,category,tags:[...base.tags,`category:${category}`,`task:${task}`],type:'choice',instruction:'文章を読んで、いちばんいい答えを一つ選んでください。',prompt,choices,answer:0,explanationVi:answerExplanation};
  return decorate(q,serial);
}

function normalizeBaseQuestion(q:Question,index:number):Question{
  const defaults:Record<SectionId,string>={script_vocabulary:'word_usage',conversation_expression:'expression',listening:'conversation',reading:'content_comprehension'};
  const aliases:Record<string,string>={
    'word-meaning':'word_meaning','word-usage':'word_usage','kanji-reading':'kanji_reading','kanji-meaning-usage':'kanji_meaning_usage',
    'shop-public-place':'shop_public','announcement-instruction':'announcement_instruction',
    'comprehending-content':'content_comprehension','information-search':'information_search',
  };
  const tags=q.tags||[];
  const rawCategory=tags.find(tag=>tag.startsWith('category:'))?.slice(9)||defaults[q.section];
  const category=aliases[rawCategory]||rawCategory.replaceAll('-','_');
  const topic=tags.find(tag=>tag.startsWith('topic:'))?.slice(6)||'general';
  const canDo=tags.find(tag=>tag.startsWith('can-do:'))?.slice(7)||`curated-${q.section}`;
  const difficulty=tags.find(tag=>tag.startsWith('difficulty:'))?.slice(11)||(index%5===0?'hard':index%2===0?'medium':'easy');
  return {...q,tags:Array.from(new Set([
    ...tags.filter(tag=>!tag.startsWith('category:')&&!tag.startsWith('topic:')&&!tag.startsWith('can-do:')&&!tag.startsWith('difficulty:')),
    `category:${category}`,`topic:${topic}`,`can-do:${canDo}`,`difficulty:${difficulty}`,'generator:curated-base',`section:${q.section}`,
  ]))};
}

const base=[...approvedSeedQuestions,...a1Lesson03Candidates].map(normalizeBaseQuestion);
const generated:ProductionCandidate[]=[];
let serial=1;
for(const level of ['A1','A2.1','A2.2'] as const){
  const units=curriculumCatalog.filter(unit=>unit.level===level);
  for(const section of sections){
    const existing=base.filter(q=>q.level===level&&q.section===section).length;
    const needed=175-existing;
    // Step by a number coprime to the four anchors/templates so repeated
    // coverage of one lesson rotates form, vocabulary, context and difficulty.
    for(let i=0;i<needed;i++)generated.push(makeQuestion(units[i%units.length],section,Math.floor(i/units.length)*5+(i%units.length),serial++));
  }
}

// Add 900 controlled non-Listening questions after the legacy 2,100 layout.
// Appending them keeps every existing Listening ID/audio asset stable.
for(const level of ['A1','A2.1','A2.2'] as const){
  const units=curriculumCatalog.filter(unit=>unit.level===level);
  for(const section of ['script_vocabulary','conversation_expression','reading'] as const){
    for(let i=0;i<100;i++){
      const unit=units[(i*5+3)%units.length];
      const n=1000+Math.floor(i/units.length)*7+(i%units.length);
      generated.push(makeQuestion(unit,section,n,serial++));
    }
  }
}

export const massQuestionCandidates:ProductionCandidate[]=generated;
export const completeProductionQuestionSet:Question[]=[...base,...massQuestionCandidates];
if(completeProductionQuestionSet.length!==3000)throw new Error('Production bank must contain exactly 3,000 questions.');

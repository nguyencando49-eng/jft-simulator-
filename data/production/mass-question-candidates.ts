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

function crossUnitTitles(unit:CurriculumCatalogUnit,n:number){
  const pool=curriculumCatalog.filter(item=>item.level===unit.level&&item.id!==unit.id&&item.topic!==unit.topic).map(item=>item.title);
  const unique=Array.from(new Set(pool));
  const start=(n*7+unit.lesson*3)%Math.max(1,unique.length);
  return [...unique.slice(start),...unique.slice(0,start)].slice(0,3);
}

function rotate<T>(items:T[],shift:number){return items.map((_,i)=>items[(i-shift+items.length)%items.length]);}
function decorate<T extends Question>(q:T,index:number):T{const shift=(index*3+1)%q.choices.length;return {...q,choices:rotate(q.choices,shift),answer:(q.answer+shift)%q.choices.length};}
function context(unit:CurriculumCatalogUnit,n:number){return {name:names[n%names.length],place:places[(n*5+unit.lesson)%places.length],day:days[(n*3+unit.lesson)%days.length],hour:8+(n*7)%11,minute:[0,10,15,20,30,40,45,50][n%8],anchor:unit.anchors[n%4],other:unit.anchors.filter((_,i)=>i!==n%4)};}

function makeQuestion(unit:CurriculumCatalogUnit,section:SectionId,n:number,serial:number):ProductionCandidate{
  const c=context(unit,n),id=`PROD-${unit.level.replace('.','')}-${section.slice(0,2).toUpperCase()}-${String(serial).padStart(4,'0')}`;
  const practicalDate=`${1+(serial*5)%12}月${1+(serial*11)%28}日`;
  const base={id,level:unit.level,section,canDo:unit.canDo,knowledgeUnitIds:[unit.id],sourceDocument:unit.sourceDocument,productionStatus:'REVIEW' as const,tags:[`topic:${unit.topic}`,`can-do:${unit.id}`,`lesson:${unit.lesson}`,`difficulty:${n%10<3?'easy':n%10<8?'medium':'hard'}`,`generator:controlled-v2`,`section:${section}`]};
  if(section==='script_vocabulary'){
    const focus=unit.anchors[n%3];
    const q:ProductionCandidate={...base,category:'word_meaning',tags:[...base.tags,'category:word_meaning'],type:'choice',instruction:'ことばを見て、いちばん関係が深い場面を一つ選んでください。',prompt:practicalDate+'、'+c.name+'さんは「'+focus+'」ということばを確認しています。どの場面で使うことばですか。',choices:[unit.title,...crossUnitTitles(unit,n)],answer:0,explanationVi:'「'+focus+'」 là từ/cách nói thuộc tình huống “'+unit.title+'” trong bài '+unit.lesson+'.'};
    return decorate(q,serial);
  }
  if(section==='conversation_expression'){
    const mode=(n+unit.lesson)%4;
    const requests=[
      c.name+'：すみません。少し聞いてもいいですか。',
      c.name+'：すみません。いっしょに確認してもらえますか。',
      c.name+'：この予定で進めてもいいですか。',
      c.name+'：少し手伝ってもらえますか。',
    ];
    const intentions=[
      '質問してよいと伝える返事',
      'いっしょに確認すると伝える返事',
      'その予定でよいと伝える返事',
      '手伝うと伝える返事',
    ];
    const responseSets=[
      ['はい、どうぞ。質問してください。','すみません、今は席を外します。','もう一度、予定を確認してください。','受付は向こうにあります。'],
      ['わかりました。いっしょに確認しましょう。','さっき一人で確認しました。','あとで担当者に聞いてください。','確認は明日までです。'],
      ['はい、その予定で大丈夫です。','いいえ、昨日の予定でした。','予定は受付に置いてあります。','終わった予定を見ました。'],
      ['はい、必要なところを手伝います。','すみません、担当者は別の人です。','手伝いは昨日終わりました。','必要な物は受付にあります。'],
    ];
    const q:ProductionCandidate={...base,category:'expression',tags:[...base.tags,'category:expression'],type:'choice',instruction:'会話を読んで、指定された意味になる返事を一つ選んでください。',prompt:'【'+unit.title+'】\n'+practicalDate+'、'+c.place+'での会話です。\n'+requests[mode]+'\n「'+intentions[mode]+'」はどれですか。',choices:responseSets[mode],answer:0,explanationVi:'Đáp án đúng thể hiện chính xác ý định giao tiếp được nêu trong câu hỏi; các lựa chọn còn lại là những phản hồi khác chức năng.'};
    return decorate(q,serial);
  }
  if(section==='listening'){
    const next=actions[(n+2)%actions.length],later=actions[(n+5)%actions.length];
    const script=`${c.place}からのお知らせです。${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}に、${c.anchor}について説明します。はじめに${next}。そのあと${later}。わからないときは受付に聞いてください。`;
    const q:ProductionCandidate={...base,category:'announcement_instruction',tags:[...base.tags,'category:announcement_instruction'],type:'audio_choice',instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`${practicalDate}に${c.place}で行われる「${unit.title}」のお知らせを聞きます。はじめに何をしますか。`,choices:[next,later,actions[(n+3)%actions.length],actions[(n+6)%actions.length]],answer:0,explanationVi:`Thông báo yêu cầu trước tiên “${next}”, sau đó mới “${later}”.`,audioSrc:`/audio/production/${id.toLowerCase()}.mp3`,audioScript:script};
    return decorate(q,serial);
  }
  const closeHour=c.hour+2,first=actions[n%actions.length],second=actions[(n+3)%actions.length];
  const materials=[
    `【${c.place}からのお知らせ】\n${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}から${closeHour}時まで、${c.anchor}の案内を行います。来た人は、まず${first}。次に${second}。`,
    `${c.name}さんへ\n${c.day}の${unit.title}について連絡します。場所は${c.place}です。${c.hour}時${c.minute?`${c.minute}分`:''}までに来て、最初に${first}。`,
    `利用案内\nテーマ：${c.anchor}\n場所：${c.place}\n曜日：${c.day}\n受付：${c.hour}時${c.minute?`${c.minute}分`:''}\n必要なこと：${first}`,
    `仕事のメモ\n${c.name}さんは${c.place}で${c.anchor}を確認してください。${c.day}の${c.hour}時から始めます。終わったら${second}。`,
  ];
  const room=`${1+(serial*7)%9}階の第${1+(serial*13)%20}会議室`;
  const q:ProductionCandidate={...base,category:'content_comprehension',tags:[...base.tags,'category:content_comprehension'],type:'choice',instruction:'文章を読んで、いちばんいい答えを一つ選んでください。',prompt:`${practicalDate}の予定です。会場は${room}です。\n${materials[n%materials.length]}\n\n最初に何をしますか。`,choices:[first,second,actions[(n+5)%actions.length],actions[(n+6)%actions.length]],answer:0,explanationVi:`Thông tin thực hành yêu cầu hành động đầu tiên là “${first}”.`};
  return decorate(q,serial);
}

const base=[...approvedSeedQuestions,...a1Lesson03Candidates];
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

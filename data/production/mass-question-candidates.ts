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

function rotate<T>(items:T[],shift:number){return items.map((_,i)=>items[(i-shift+items.length)%items.length]);}
function decorate<T extends Question>(q:T,index:number):T{const shift=(index*3+1)%q.choices.length;return {...q,choices:rotate(q.choices,shift),answer:(q.answer+shift)%q.choices.length};}
function context(unit:CurriculumCatalogUnit,n:number){return {name:names[n%names.length],place:places[(n*5+unit.lesson)%places.length],day:days[(n*3+unit.lesson)%days.length],hour:8+(n*7)%11,minute:[0,10,15,20,30,40,45,50][n%8],anchor:unit.anchors[n%4],other:unit.anchors.filter((_,i)=>i!==n%4)};}

function makeQuestion(unit:CurriculumCatalogUnit,section:SectionId,n:number,serial:number):ProductionCandidate{
  const c=context(unit,n),id=`PROD-${unit.level.replace('.','')}-${section.slice(0,2).toUpperCase()}-${String(serial).padStart(4,'0')}`;
  const reference=`${unit.lesson}${String(10000+serial).slice(-5)}`;
  const base={id,level:unit.level,section,canDo:unit.canDo,knowledgeUnitIds:[unit.id],sourceDocument:unit.sourceDocument,productionStatus:'REVIEW' as const,tags:[`category:${section}`,`topic:${unit.topic}`,`can-do:${unit.id}`,`lesson:${unit.lesson}`,`difficulty:${n%10<3?'easy':n%10<8?'medium':'hard'}`]};
  if(section==='script_vocabulary'){
    const categories=['word_meaning','word_usage','kanji_reading','kanji_meaning_usage'];
    const prompts=[
      `${c.place}で、${c.name}さんは「${c.anchor}」について聞きたいです。関係がいちばん深いことばはどれですか。`,
      `${c.day}、${c.name}さんは${unit.title}の場面で使うことばを探しています。いちばん合うものはどれですか。`,
      `${c.place}の「${unit.title}」という案内で大切なことばを一つ選びます。必要なことばはどれですか。`,
      `${c.name}さんは${unit.title}について短いメモを書きます。中心になることばはどれですか。`,
    ];
    const q:ProductionCandidate={...base,category:categories[n%4],type:'choice',instruction:'ことばを見て、いちばんいいものを一つ選んでください。',prompt:`資料番号 ${reference}\n${prompts[n%prompts.length]}`,choices:[c.anchor,...c.other],answer:0,explanationVi:`Từ trọng tâm của tình huống “${unit.title}” trong đơn vị kiến thức ${unit.id} là 「${c.anchor}」.`};
    return decorate(q,serial);
  }
  if(section==='conversation_expression'){
    const requests=[
      `${c.name}：すみません。${c.anchor}について教えていただけますか。`,
      `${c.name}：${c.day}に${c.place}へ行きたいんですが、少し聞いてもいいですか。`,
      `${c.name}：${unit.title}のことで、確認したいことがあります。`,
      `${c.name}：このあと${c.anchor}を${actions[n%actions.length]}。これでいいですか。`,
    ];
    const choices=['はい。わかりました。いっしょに確認しましょう。','いいえ、昨日は雨でした。','いただきます。ごちそうさまでした。','その電車は青いです。'];
    const q:ProductionCandidate={...base,category:n%2?'expression':'grammar',type:'choice',instruction:'会話を完成させるために、いちばんいいものを一つ選んでください。',prompt:`受付番号 ${reference}\n【${unit.title}】${requests[n%requests.length]}\n担当者：＿＿＿＿＿＿。`,choices,answer:0,explanationVi:'Người phụ trách đồng ý hỗ trợ và đề nghị cùng kiểm tra, phù hợp với lời hỏi/nhờ trong hội thoại.'};
    return decorate(q,serial);
  }
  if(section==='listening'){
    const next=actions[(n+2)%actions.length],later=actions[(n+5)%actions.length];
    const script=`${c.place}からのお知らせです。${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}に、${c.anchor}について説明します。はじめに${next}。そのあと${later}。わからないときは受付に聞いてください。`;
    const q:ProductionCandidate={...base,category:['conversation','shop_public','announcement_instruction'][n%3],type:'audio_choice',instruction:'音声を聞いて、いちばんいい答えを一つ選んでください。',prompt:`放送番号 ${reference}\n${c.place}の${c.day}の「${unit.title}」について聞きます。${c.name}さんは、はじめに何をしますか。`,choices:[next,later,'すぐ家に帰ります','何もしません'],answer:0,explanationVi:`Thông báo yêu cầu trước tiên “${next}”, sau đó mới “${later}”.`,audioSrc:`/audio/production/${id.toLowerCase()}.mp3`,audioScript:script};
    return decorate(q,serial);
  }
  const closeHour=c.hour+2,first=actions[n%actions.length],second=actions[(n+3)%actions.length];
  const materials=[
    `【${c.place}からのお知らせ】\n${c.day}の${c.hour}時${c.minute?`${c.minute}分`:''}から${closeHour}時まで、${c.anchor}の案内を行います。来た人は、まず${first}。次に${second}。`,
    `${c.name}さんへ\n${c.day}の${unit.title}について連絡します。場所は${c.place}です。${c.hour}時${c.minute?`${c.minute}分`:''}までに来て、最初に${first}。`,
    `利用案内\nテーマ：${c.anchor}\n場所：${c.place}\n曜日：${c.day}\n受付：${c.hour}時${c.minute?`${c.minute}分`:''}\n必要なこと：${first}`,
    `仕事のメモ\n${c.name}さんは${c.place}で${c.anchor}を確認してください。${c.day}の${c.hour}時から始めます。終わったら${second}。`,
  ];
  const q:ProductionCandidate={...base,category:n%2?'information_search':'content_comprehension',type:'choice',instruction:'文章を読んで、いちばんいい答えを一つ選んでください。',prompt:`文書番号 ${reference}\n${materials[n%materials.length]}\n\n最初に何をしますか。`,choices:[first,second,'家で休みます','予定を全部中止します'],answer:0,explanationVi:`Thông tin thực hành yêu cầu hành động đầu tiên là “${first}”.`};
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

export const massQuestionCandidates:ProductionCandidate[]=generated;
export const completeProductionQuestionSet:Question[]=[...base,...massQuestionCandidates];

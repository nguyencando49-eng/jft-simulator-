import type { Question } from '../../lib/types';

export interface CurriculumCatalogUnit {
  id: string;
  level: Question['level'];
  sourceDocument: string;
  lesson: number;
  title: string;
  topic: string;
  canDo: string;
  anchors: [string,string,string,string];
}

// Simulator mapping: 入門 -> A1, 初級1 -> A2.1, 初級2 -> A2.2.
// This split is an internal production decision, not an official curriculum calibration.
const a1: CurriculumCatalogUnit[] = [
  ['A1-N03',3,'私のこと','personal_information','introduce oneself and exchange basic identity information',['名前','国','会社','友達']],
  ['A1-N04',4,'家族と住まい','family','talk simply about family and where people live',['家族','父','母','住んでいます']],
  ['A1-N05',5,'好きな食べ物','food','say which foods and drinks one likes',['魚','肉','野菜','飲み物']],
  ['A1-N06',6,'店で注文する','restaurant','order simple food and drinks at a shop or restaurant',['注文','ハンバーガー','コーヒー','店員']],
  ['A1-N07',7,'部屋が4つあります','housing','describe a home and say what is available',['部屋','冷蔵庫','台所','あります']],
  ['A1-N08',8,'山田さんはどこにいますか','work','ask where a person is in a workplace',['事務所','会議室','受付','います']],
  ['A1-N09',9,'12時から1時まで昼休みです','schedule','understand simple workplace times and schedules',['昼休み','時間','始まります','終わります']],
  ['A1-N10',10,'ホチキス貸してください','workplace_instructions','make and understand simple workplace requests',['ホチキス','コピー','段ボール','貸してください']],
  ['A1-N11',11,'どんなマンガが好きですか','leisure','talk about hobbies and free-time activities',['漫画','映画','スポーツ','趣味']],
  ['A1-N12',12,'いっしょに飲みに行きませんか','appointment','invite someone and arrange a simple outing',['一緒に','飲み会','週末','行きませんか']],
  ['A1-N13',13,'このバスは空港に行きますか','transportation','ask about and follow simple transportation routes',['バス','空港','駅','乗り換えます']],
  ['A1-N14',14,'温泉に入りたいです','leisure','say what one wants to do at a destination',['温泉','景色','寺','入りたい']],
  ['A1-N15',15,'電池がほしいんですが','shopping','ask where a wanted item can be bought',['電池','売り場','何階','ほしい']],
  ['A1-N16',16,'これ、いくらですか','shopping','ask prices and buy quantities of goods',['値段','円','会計','ください']],
  ['A1-N17',17,'休みは、何をしましたか','daily_routine','talk simply about past days off',['休み','買い物','掃除','しました']],
  ['A1-N18',18,'日本で何をしたいですか','leisure','say what one wants to experience in Japan',['新幹線','富士山','旅行','したい']],
].map(([id,lesson,title,topic,canDo,anchors])=>({id,level:'A1',sourceDocument:`TAI LIEU SACH/入門第${lesson}課.docx`,lesson,title,topic,canDo,anchors})) as CurriculumCatalogUnit[];

const a21: CurriculumCatalogUnit[] = [
  ['A21-S01',1,'レストランで働いています','work','talk about work and length of residence',['仕事','工場','半年','働いています']],
  ['A21-S02',2,'ゲームをするのが好きです','leisure','describe hobbies and preferred activities',['ゲーム','映画','体育館','好きです']],
  ['A21-S03',3,'冬はとても寒くなります','weather','describe seasons and changes in weather',['季節','冬','暖かい','なります']],
  ['A21-S04',4,'昨日はすごい雨でしたね','weather','exchange comments and predictions about weather',['台風','雷','風','でしょう']],
  ['A21-S05',5,'とてもにぎやかで便利です','community','describe a town and recommend places',['町','便利','景色','できます']],
  ['A21-S06',6,'郵便局はどう行ったらいいですか','directions','ask for and give multi-step directions',['郵便局','信号','曲がる','交差点']],
  ['A21-S07',7,'道に迷ってちょっと遅れます','appointment','arrange a meeting and report a delay',['待ち合わせ','遅れます','事故','改札']],
  ['A21-S08',8,'野球、したことがありますか','leisure','talk about past experiences and invitations',['経験','動物園','試合','ことがあります']],
  ['A21-S09',9,'読み方を教えてもらいませんか','school','ask politely for language help',['漢字','読み方','レポート','教えて']],
  ['A21-S10',10,'日本語教室に参加したいんですが','school','ask about joining a class or activity',['日本語教室','参加','申し込み','受付']],
  ['A21-S11',11,'肉と野菜は私が買って行きます','community','coordinate responsibilities for an event',['準備','材料','担当','持って行く']],
  ['A21-S12',12,'お弁当、おいしそうですね','food','describe food by appearance and taste',['弁当','味','材料','おいしそう']],
  ['A21-S13',13,'あと10分ぐらいで終わりそうです','workplace_instructions','report progress and expected completion',['作業','予定','終わる','進みます']],
  ['A21-S14',14,'休みを取ってもいいですか','work','request leave and explain a workplace need',['有給休暇','早退','上司','休み']],
  ['A21-S15',15,'熱があって、のどが痛いんです','hospital','describe symptoms at a clinic or pharmacy',['熱','のど','診察','薬']],
  ['A21-S16',16,'食べ過ぎないようにしています','health','discuss health habits and advice',['健康','睡眠','食事','ようにしています']],
  ['A21-S17',17,'兄がくれたお守りです','family','explain gifts and who gave or made them',['お守り','お土産','兄','くれました']],
  ['A21-S18',18,'何かプレゼントをあげませんか','community','plan a gift or farewell event with others',['送別会','誕生日','思い出','プレゼント']],
].map(([id,lesson,title,topic,canDo,anchors])=>({id,level:'A2.1',sourceDocument:`TAI LIEU SACH/初級1第${lesson}課.docx`,lesson,title,topic,canDo,anchors})) as CurriculumCatalogUnit[];

const a22: CurriculumCatalogUnit[] = [
  ['A22-S01',1,'先週、日本に来たばかりです','community','explain recent changes and current circumstances',['先週','引っ越し','ばかり','生活']],
  ['A22-S02',2,'まじめそうな人ですね','personal_information','describe impressions of another person',['性格','親切','まじめ','そうです']],
  ['A22-S03',3,'アレルギーがあるので、食べられないんです','restaurant','explain dietary restrictions and ask about ingredients',['アレルギー','材料','乳製品','食べられない']],
  ['A22-S04',4,'しょうゆをつけないで食べてください','food','understand and explain how to eat a dish',['食べ方','調味料','つけないで','そのまま']],
  ['A22-S05',5,'早く予約したほうがいいですよ','travel','compare travel options and give planning advice',['予約','宿泊','観光地','ほうがいい']],
  ['A22-S06',6,'いろいろなところに行けて、よかったです','travel','describe a trip and evaluate experiences',['旅行','観光','思い出','よかった']],
  ['A22-S07',7,'雨が降ったら、ホールでやります','weather','understand conditional changes to event plans',['雨天','会場','中止','降ったら']],
  ['A22-S08',8,'屋台はどこかわかりますか','festival','find practical information at a public event',['屋台','案内所','会場','どこか']],
  ['A22-S09',9,'成人の日は、何をするんですか','community','ask about and understand Japanese community customs',['成人の日','式典','着物','習慣']],
  ['A22-S10',10,'どんな服を着て行けばいいですか','rules_and_notices','ask what preparation or clothing is appropriate',['服装','持ち物','会場','ばいい']],
  ['A22-S11',11,'ポイントカードを忘れてしまいました','shopping','resolve a problem during payment or shopping',['ポイントカード','会計','返品','しまいました']],
  ['A22-S12',12,'この掃除機は軽くて動かしやすいですよ','shopping','compare product features and understand recommendations',['掃除機','機能','軽い','使いやすい']],
  ['A22-S13',13,'いろいろな資料を展示してあります','public_services','understand facility displays and available information',['展示','資料','入口','してあります']],
  ['A22-S14',14,'前髪は、もう少し短く切ってもらえますか','public_services','request a specific service adjustment politely',['美容院','前髪','短く','てもらえますか']],
  ['A22-S15',15,'会議室の電気がついたままでした','workplace_instructions','report and correct a workplace condition',['会議室','電気','確認','たまま']],
  ['A22-S16',16,'地震が来ても、あわてて動かないでください','disaster','follow emergency and disaster instructions',['地震','避難','非常口','動かないで']],
  ['A22-S17',17,'日本語が前より話せるようになりました','school','describe progress and changes in ability',['上達','練習','前より','ようになりました']],
  ['A22-S18',18,'将来、自分の会社を作ろうと思います','work','talk about future goals and plans',['将来','目標','会社','と思います']],
].map(([id,lesson,title,topic,canDo,anchors])=>({id,level:'A2.2',sourceDocument:'TAI LIEU SACH/SC2_full_20230216.pdf',lesson,title,topic,canDo,anchors})) as CurriculumCatalogUnit[];

export const curriculumCatalog: CurriculumCatalogUnit[] = [...a1,...a21,...a22];

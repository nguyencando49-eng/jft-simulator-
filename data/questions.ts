import { Question } from '@/lib/types';
import { expansionQuestions } from './question-bank-expansion';

export const questions: Question[] = [
  {
    id:'SV-001', section:'script_vocabulary', type:'choice', level:'A1',
    instruction:'（　）に 何が 入りますか。いちばん いいものを ひとつ えらんでください。',
    prompt:'わたしは まいあさ 7時に（　）。',
    choices:['おきます','のみます','かえります','あいます'], answer:0,
    explanationVi:'「7 giờ mỗi sáng tôi thức dậy」→ おきます。', tags:['daily-life','verb']
  },
  {
    id:'SV-002', section:'script_vocabulary', type:'choice', level:'A2.1',
    instruction:'ことばの つかいかたとして いちばん いいものを えらんでください。',
    prompt:'「予約」の つかいかたとして いちばん いいものは どれですか。',
    choices:['病院を予約しました。','雨を予約しました。','電車を予約に乗りました。','会社で予約を働きました。'], answer:0,
    explanationVi:'予約する dùng cho đặt lịch/chỗ, ví dụ đặt lịch bệnh viện.', tags:['kanji','usage']
  },
  {
    id:'CE-001', section:'conversation_expression', type:'choice', level:'A2.1',
    instruction:'会話を 読んで、いちばん いいものを えらんでください。',
    prompt:'A：すみません。明日、少し遅れるかもしれません。\nB：（　）',
    choices:['わかりました。気をつけて来てください。','いただきます。','お大事に。','いってらっしゃい。'], answer:0,
    explanationVi:'Đây là phản hồi phù hợp khi đồng nghiệp báo có thể đến muộn.', tags:['work','conversation']
  },
  {
    id:'CE-002', section:'conversation_expression', type:'choice', level:'A2.2',
    instruction:'場面に あう 表現を えらんでください。',
    prompt:'仕事が終わって、先に帰るとき、同僚に何と言いますか。',
    choices:['お先に失礼します。','いらっしゃいませ。','お待たせしました。','ごちそうさまでした。'], answer:0,
    explanationVi:'「お先に失礼します」 là cách nói chuẩn khi rời nơi làm việc trước đồng nghiệp.', tags:['work','expression']
  },
  {
    id:'LI-001', section:'listening', type:'audio_choice', level:'A1',
    instruction:'音声を 聞いて、質問に 答えてください。',
    prompt:'男の人は 何時に 会社へ 行きますか。',
    choices:['7時','8時','9時','10時'], answer:1,
    explanationVi:'Audio nói người đàn ông đi công ty lúc 8 giờ.', audioSrc:'/audio/sample-01.wav', tags:['category:conversation','topic:work','can-do:understand-time']
  },
  {
    id:'LI-002', section:'listening', type:'audio_choice', level:'A2.1',
    instruction:'音声を 聞いて、いちばん いいものを えらんでください。',
    prompt:'店員は 客に 何を お願いしていますか。',
    choices:['ここで待つ','外で食べる','名前を書く','電話をする'], answer:2,
    explanationVi:'Audio yêu cầu khách viết tên.', audioSrc:'/audio/sample-02.wav', tags:['category:shop-public-place','topic:service','can-do:follow-request']
  },
  {
    id:'RE-001', section:'reading', type:'choice', level:'A1',
    instruction:'文章を 読んで、質問に 答えてください。',
    prompt:'【お知らせ】\n今日は 店が 18時に 閉まります。\n\n店は 何時までですか。',
    choices:['5時','6時','7時','8時'], answer:1,
    explanationVi:'18時 = 6 giờ chiều.', tags:['notice','time']
  },
  {
    id:'RE-002', section:'reading', type:'choice', level:'A2.2',
    instruction:'文章を 読んで、質問に 答えてください。',
    prompt:'田中さんへ\n明日の会議は10時から11時半までです。会議室Aではなく、3階の会議室Bに来てください。資料は今日中にメールで送ります。\n\n田中さんは 明日 どこへ 行きますか。',
    choices:['会議室A','3階の会議室B','受付','食堂'], answer:1,
    explanationVi:'Thông báo đổi địa điểm sang phòng họp B ở tầng 3.', tags:['work','reading']
  },
  ...expansionQuestions,
];

export const sectionLabels = {
  script_vocabulary: 'Script and Vocabulary',
  conversation_expression: 'Conversation and Expression',
  listening: 'Listening Comprehension',
  reading: 'Reading Comprehension',
} as const;

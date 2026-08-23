'use client';

import { useMemo, useState } from 'react';
import type { CandidateReviewItem } from '@/lib/api-client';
import type { SectionId } from '@/lib/types';
import { Card, EmptyState } from '@/components/ui';

const labels:Record<SectionId,string>={script_vocabulary:'Chữ viết & Từ vựng',conversation_expression:'Hội thoại & Biểu đạt',listening:'Nghe hiểu',reading:'Đọc hiểu'};

export default function AnswerReview({items}:{items:CandidateReviewItem[]}){
  const [onlyIncorrect,setOnlyIncorrect]=useState(true);
  const ordered=useMemo(()=>[...items].sort((a,b)=>Number(a.correct)-Number(b.correct)),[items]);
  const visible=onlyIncorrect?ordered.filter(item=>!item.correct):ordered;

  return <Card
    title="Xem lại đáp án"
    className="answer-review-card"
    action={<button type="button" className="secondary compact" onClick={()=>setOnlyIncorrect(value=>!value)}>{onlyIncorrect?'Xem tất cả câu':'Chỉ xem câu sai'}</button>}
  >
    <div data-testid="answer-review">
      {visible.length?<div className="answer-review-list">{visible.map((item,index)=>{
        const unanswered=item.selectedAnswer===null;
        return <article className="answer-review-item" key={item.question.id}>
          <header>
            <div><span>{labels[item.question.section]}</span><b>Câu {items.findIndex(entry=>entry.question.id===item.question.id)+1}</b></div>
            <span className={`badge ${item.correct?'approved':unanswered?'review':'archived'}`}>{item.correct?'Đúng':unanswered?'Chưa trả lời':'Sai'}</span>
          </header>
          <p className="review-instruction">{item.question.instruction}</p>
          {item.question.type==='audio_choice'&&item.question.audioSrc?<audio controls preload="none" src={item.question.audioSrc}>Trình duyệt không hỗ trợ âm thanh.</audio>:null}
          <div className="review-prompt" lang="ja">{item.question.prompt}</div>
          <ol className="review-choices">{item.question.choices.map((choice,choiceIndex)=>{
            const isCorrect=choiceIndex===item.correctAnswer;
            const isSelected=choiceIndex===item.selectedAnswer;
            return <li key={choiceIndex} className={`${isCorrect?'correct':''} ${isSelected&&!isCorrect?'selected-wrong':''}`}>
              <span>{choiceIndex+1}</span><b lang="ja">{choice}</b>
              <small>{isCorrect?'Đáp án đúng':isSelected?'Bạn đã chọn':''}</small>
            </li>;
          })}</ol>
          <div className="review-explanation"><b>Giải thích</b><p>{item.explanationVi||'Chưa có lời giải cho câu này.'}</p></div>
        </article>;
      })}</div>:<EmptyState title="Không có câu sai" description="Bạn đã trả lời đúng tất cả các câu trong bài này."/>}
    </div>
  </Card>;
}

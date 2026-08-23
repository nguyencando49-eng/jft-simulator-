'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { ApiError, candidateApi, type CandidateExam, type CandidateSession } from '@/lib/api-client';
import type { SectionId } from '@/lib/types';
import { Alert, Skeleton } from '@/components/ui';

const SESSION_KEY='jft-v42-active-session';
const labels:Record<SectionId,string>={script_vocabulary:'Chữ viết & Từ vựng',conversation_expression:'Hội thoại & Biểu đạt',listening:'Nghe hiểu',reading:'Đọc hiểu'};
type Phase='loading'|'instructions'|'audio_check'|'section_intro'|'testing'|'section_confirm'|'final_confirm'|'expired'|'error';
type SyncState='idle'|'saving'|'retrying'|'saved'|'error';
type AudioState='idle'|'loading'|'ready'|'playing'|'error';

export default function ExamClient(){
  const bootstrapped=useRef(false);
  const timeoutTriggered=useRef(false);
  const saveQueue=useRef<Promise<void>>(Promise.resolve());
  const pendingSaves=useRef(0);
  const failedSaves=useRef(new Set<string>());
  const router=useRouter();
  const params=useSearchParams();
  const audioRef=useRef<HTMLAudioElement|null>(null);
  const [phase,setPhase]=useState<Phase>('loading');
  const [exam,setExam]=useState<CandidateExam|null>(null);
  const [session,setSession]=useState<CandidateSession|null>(null);
  const [selectedVersionId,setSelectedVersionId]=useState('');
  const [currentIndex,setCurrentIndex]=useState(0);
  const [answers,setAnswers]=useState<Record<string,number>>({});
  const [remaining,setRemaining]=useState(0);
  const [language,setLanguage]=useState<'ja'|'vi'>('ja');
  const [error,setError]=useState('');
  const [sync,setSync]=useState<SyncState>('idle');
  const [plays,setPlays]=useState<Record<string,number>>({});
  const [audioState,setAudioState]=useState<AudioState>('idle');

  useEffect(()=>{if(bootstrapped.current)return;bootstrapped.current=true;void bootstrap();},[]);
  useEffect(()=>{setAudioState('idle');},[currentIndex]);
  useEffect(()=>{
    if(!session||session.status!=='active')return;
    const tick=()=>{
      const left=Math.max(0,new Date(session.expiresAt).getTime()-Date.now());
      setRemaining(left);
      if(left===0&&!timeoutTriggered.current){timeoutTriggered.current=true;void finish();}
    };
    tick();
    const id=setInterval(tick,1000);
    return()=>clearInterval(id);
  },[session]);

  async function restoreSession(id:string){
    const response=await candidateApi.resume(id);
    if(response.session.status==='submitted'){
      localStorage.removeItem(SESSION_KEY);
      router.replace(`/result?sessionId=${encodeURIComponent(response.session.id)}`);
      return true;
    }
    if(response.session.status==='expired'||Date.now()>=new Date(response.session.expiresAt).getTime()){
      localStorage.removeItem(SESSION_KEY);
      setSession(response.session);
      setExam(response.exam);
      setError('Bài luyện tập đã hết thời gian. Hãy mở lịch sử để kiểm tra trạng thái lần làm bài.');
      setPhase('expired');
      return true;
    }
    localStorage.setItem(SESSION_KEY,response.session.id);
    setSession(response.session);
    setExam(response.exam);
    setSelectedVersionId(response.session.examVersionId);
    setAnswers(response.session.answers||{});
    setCurrentIndex(response.session.currentIndex||0);
    setPhase('testing');
    return true;
  }

  async function restoreSessionWithRetry(id:string){
    let lastError:unknown;
    for(let attempt=0;attempt<3;attempt+=1){
      try{return await restoreSession(id);}catch(cause){
        lastError=cause;
        if(cause instanceof ApiError&&cause.status<500)throw cause;
        if(attempt<2)await new Promise(resolve=>setTimeout(resolve,350*(attempt+1)));
      }
    }
    throw lastError;
  }

  async function bootstrap(){
    try{
      const requestedSession=params.get('sessionId');
      const requestedVersion=params.get('examVersionId');
      if(requestedSession){
        try{await restoreSessionWithRetry(requestedSession);}catch{setError('Không thể mở lần luyện tập này hoặc bạn không có quyền truy cập.');setPhase('error');}
        return;
      }

      const [mine,catalog]=await Promise.all([candidateApi.attempts(),candidateApi.publishedExams()]);
      if(requestedVersion){
        const published=catalog.versions.find(item=>item.id===requestedVersion);
        if(!published){setError('Đề luyện tập không tồn tại hoặc chưa được phát hành.');setPhase('error');return;}
        const matching=mine.attempts.find(item=>item.examVersionId===requestedVersion&&item.status==='active'&&Date.now()<new Date(item.expiresAt).getTime());
        if(matching){await restoreSessionWithRetry(matching.id);return;}
        setSelectedVersionId(requestedVersion);
        setPhase('instructions');
        return;
      }

      const hinted=localStorage.getItem(SESSION_KEY);
      if(hinted){
        try{await restoreSessionWithRetry(hinted);return;}catch{localStorage.removeItem(SESSION_KEY);}
      }
      const active=mine.attempts.find(item=>item.status==='active'&&Date.now()<new Date(item.expiresAt).getTime());
      if(active){await restoreSessionWithRetry(active.id);return;}
      if(!catalog.version){setError('Hiện chưa có bài luyện tập khả dụng. Vui lòng quay lại sau.');setPhase('error');return;}
      setSelectedVersionId(catalog.version.id);
      setPhase('instructions');
    }catch{
      setError('Không thể kết nối với bài luyện tập. Vui lòng kiểm tra mạng và thử lại.');
      setPhase('error');
    }
  }

  async function startExam(){
    try{
      setPhase('loading');
      let versionId=selectedVersionId;
      if(!versionId){versionId=(await candidateApi.publishedExams()).version?.id||'';}
      if(!versionId)throw new Error('NO_EXAM');
      const response=await candidateApi.createSession(versionId);
      setSession(response.session);
      setExam(response.exam);
      setAnswers(response.session.answers||{});
      setCurrentIndex(response.session.currentIndex||0);
      localStorage.setItem(SESSION_KEY,response.session.id);
      setPhase(response.session.currentIndex>0?'testing':'section_intro');
    }catch{
      setError('Không thể bắt đầu bài luyện tập lúc này.');
      setPhase('error');
    }
  }

  const q=exam?.questions[currentIndex];
  const rule=exam&&q?exam.rules.find(item=>item.section===q.section):undefined;
  const sectionQuestions=useMemo(()=>exam&&q?exam.questions.map((item,index)=>({item,index})).filter(entry=>entry.item.section===q.section):[],[exam,q]);

  function persist(index?:number,id?:string,choice?:number){
    if(!session)return;
    const key=id?`answer:${id}`:`index:${index}`;
    pendingSaves.current+=1;
    setSync('saving');
    const operation=async()=>{
      let saved=false;
      for(let attempt=0;attempt<3&&!saved;attempt+=1){
        if(attempt>0){setSync('retrying');await new Promise(resolve=>setTimeout(resolve,attempt*450));}
        try{await candidateApi.saveAnswer(session.id,id,choice,index);saved=true;}catch{/* bounded retry below */}
      }
      if(saved)failedSaves.current.delete(key);else failedSaves.current.add(key);
      pendingSaves.current-=1;
      if(failedSaves.current.size)setSync('error');else if(pendingSaves.current===0)setSync('saved');
    };
    saveQueue.current=saveQueue.current.then(operation,operation);
  }

  function choose(choice:number){
    if(!q)return;
    setAnswers(current=>({...current,[q.id]:choice}));
    persist(undefined,q.id,choice);
  }

  function go(index:number){
    if(!exam||!q)return;
    const next=Math.max(0,Math.min(exam.questions.length-1,index));
    if(!rule?.allowBack&&next!==currentIndex)return;
    if(exam.questions[next].section!==q.section)return;
    setCurrentIndex(next);
    persist(next);
  }

  function advance(){
    if(!exam||!q)return;
    if(currentIndex===exam.questions.length-1){setPhase('final_confirm');return;}
    const next=currentIndex+1;
    if(exam.questions[next].section!==q.section){setPhase('section_confirm');return;}
    setCurrentIndex(next);
    persist(next);
  }

  function enterNextSection(){
    if(!exam)return;
    const next=currentIndex+1;
    setCurrentIndex(next);
    persist(next);
    setPhase('section_intro');
  }

  async function finish(){
    if(!session)return;
    setPhase('loading');
    await saveQueue.current;
    if(failedSaves.current.size){
      setError('Một số thay đổi chưa lưu được. Hãy kiểm tra kết nối, chọn lại đáp án đang báo lỗi rồi nộp bài.');
      setPhase('testing');
      timeoutTriggered.current=false;
      return;
    }
    try{
      await candidateApi.submit(session.id);
      localStorage.removeItem(SESSION_KEY);
      router.push(`/result?sessionId=${encodeURIComponent(session.id)}`);
    }catch{
      setError('Không thể nộp bài ngay lúc này. Đáp án đã lưu; vui lòng thử lại.');
      setPhase('error');
    }
  }

  function playAudio(){
    if(!q?.audioSrc||!audioRef.current){setAudioState('error');setError('Câu nghe này chưa có tệp âm thanh khả dụng.');return;}
    const used=plays[q.id]||0;
    if(used>=2)return;
    setAudioState('loading');
    audioRef.current.currentTime=0;
    audioRef.current.play()
      .then(()=>{setAudioState('playing');setPlays(current=>({...current,[q.id]:used+1}));})
      .catch(()=>{setAudioState('error');setError('Không thể phát âm thanh. Hãy kiểm tra kết nối, loa hoặc tai nghe.');});
  }

  const mins=String(Math.floor(remaining/60000)).padStart(2,'0');
  const secs=String(Math.floor((remaining%60000)/1000)).padStart(2,'0');
  const timer=`${mins}:${secs}`;

  if(phase==='loading')return <Frame timer="--:--"><section className="exam-stage"><Skeleton lines={4}/><p>Đang chuẩn bị bài luyện tập…</p></section></Frame>;
  if(phase==='error'||phase==='expired')return <Frame timer={phase==='expired'?'00:00':'--:--'}><section className="exam-stage"><span className="step">{phase==='expired'?'ĐÃ HẾT THỜI GIAN':'KHÔNG THỂ TIẾP TỤC'}</span><h1>{phase==='expired'?'Bài luyện tập đã kết thúc':'Đã xảy ra sự cố'}</h1><Alert tone={phase==='expired'?'warning':'danger'}>{error||'Hệ thống đã tự hoàn tất bài khi hết thời gian.'}</Alert><div className="stage-actions"><button className="secondary" onClick={()=>router.replace('/candidate')}>Về trang học viên</button>{phase==='error'&&<button className="primary" onClick={()=>location.reload()}>Thử lại</button>}</div></section></Frame>;
  if(phase==='instructions')return <Frame timer="--:--"><section className="exam-stage"><span className="step">BƯỚC 1 / 2</span><h1>Hướng dẫn làm bài</h1><ul className="instruction-list"><li>Bài có bốn phần và thời gian chung cho toàn bài.</li><li>Bạn có thể xem lại câu trong cùng phần, trừ phần Nghe hiểu.</li><li>Khi chuyển sang phần tiếp theo, bạn không thể quay lại phần trước.</li><li>Đáp án được lưu tự động trên máy chủ trong khi làm bài.</li></ul><Alert tone="info">Đây là bài luyện tập không chính thức. Kết quả không tương đương điểm JFT-Basic chính thức.</Alert><div className="stage-actions"><button className="secondary" onClick={()=>router.push('/candidate')}>Thoát</button><button className="primary" onClick={()=>setPhase('audio_check')}>Kiểm tra âm thanh</button></div></section></Frame>;
  if(phase==='audio_check')return <Frame timer="--:--"><section className="exam-stage"><span className="step">BƯỚC 2 / 2</span><h1>Kiểm tra âm thanh</h1><p>Đeo tai nghe và phát đoạn mẫu. Hãy điều chỉnh âm lượng trước khi bắt đầu.</p><div className="audio-check"><audio controls preload="auto" src="/audio/sample-01.wav">Trình duyệt không hỗ trợ âm thanh.</audio><p lang="ja">毎朝八時に会社へ行きます。</p></div><div className="stage-actions"><button className="secondary" onClick={()=>setPhase('instructions')}>Quay lại</button><button className="primary" onClick={()=>void startExam()}>Bắt đầu làm bài</button></div></section></Frame>;
  if(!exam||!session||!q)return null;
  if(phase==='section_intro')return <Frame timer={timer}><section className="exam-stage"><span className="step">PHẦN MỚI</span><h1>{labels[q.section]}</h1><p>{q.section==='listening'?'Câu hỏi chạy lần lượt. Mỗi đoạn âm thanh có thể phát tối đa hai lần và không thể quay lại câu trước.':'Bạn có thể chuyển giữa các câu trong phần này trước khi sang phần tiếp theo.'}</p><button className="primary" onClick={()=>setPhase('testing')}>Bắt đầu phần này</button></section></Frame>;
  if(phase==='section_confirm')return <Frame timer={timer}><section className="exam-stage"><span className="step">HOÀN THÀNH PHẦN</span><h1>Chuyển sang phần tiếp theo?</h1><Alert tone="warning">Sau khi tiếp tục, bạn không thể quay lại phần {labels[q.section]}.</Alert><div className="stage-actions"><button className="secondary" onClick={()=>setPhase('testing')}>Ở lại câu hiện tại</button><button className="primary" onClick={enterNextSection}>Tiếp tục</button></div></section></Frame>;
  if(phase==='final_confirm'){
    const unanswered=exam.questions.length-Object.keys(answers).length;
    return <Frame timer={timer}><section className="exam-stage"><span className="step">KIỂM TRA CUỐI</span><h1>Nộp bài luyện tập?</h1>{unanswered>0&&<Alert tone="warning">Bạn vẫn còn {unanswered} câu chưa trả lời. Bạn có chắc muốn nộp bài?</Alert>}<div className="info-grid"><div><b>Đã trả lời</b><span>{Object.keys(answers).length}</span></div><div><b>Chưa trả lời</b><span>{unanswered}</span></div><div><b>Thời gian còn lại</b><span>{timer}</span></div></div><div className="stage-actions"><button className="secondary" onClick={()=>setPhase('testing')}>Quay lại</button><button className="primary danger" onClick={()=>void finish()}>Nộp bài</button></div></section></Frame>;
  }

  const position=sectionQuestions.findIndex(entry=>entry.index===currentIndex)+1;
  const used=plays[q.id]||0;
  const saveLabel=sync==='saving'?'Đang lưu…':sync==='retrying'?'Đang thử lưu lại…':sync==='error'?'Lưu thất bại · kiểm tra mạng':sync==='saved'?'Đã lưu tự động':'Chưa có thay đổi';
  return <Frame timer={timer} section={labels[q.section]} progress={`${currentIndex+1}/${exam.questions.length}`}><div className="cbt-layout"><aside className="question-palette" aria-label="Danh sách câu hỏi"><b>{labels[q.section]}</b><div className="qgrid">{sectionQuestions.map(({item,index},number)=><button key={item.id} aria-label={`Câu ${number+1}${answers[item.id]!==undefined?', đã trả lời':''}`} disabled={!rule?.allowBack&&index!==currentIndex} className={`qnum ${index===currentIndex?'current':''} ${answers[item.id]!==undefined?'answered':''}`} onClick={()=>go(index)}>{number+1}</button>)}</div></aside><section className="cbt-question"><header><div><span>Câu {position} / {sectionQuestions.length}</span><b>{q.level}</b><span className={`save-status ${sync}`} role="status">{saveLabel}</span></div><button className="language-btn" onClick={()=>setLanguage(value=>value==='ja'?'vi':'ja')}>Hướng dẫn: {language==='ja'?'日本語':'Tiếng Việt'}</button></header><div className="cbt-body">{error&&<Alert tone="danger" title="Có thay đổi chưa được xử lý">{error}</Alert>}<p className="instruction">{language==='vi'?'Chọn một đáp án phù hợp nhất.':q.instruction}</p>{q.type==='audio_choice'&&<div className={`listening-player ${audioState==='error'?'has-error':''}`}><audio ref={audioRef} src={q.audioSrc} preload="metadata" onCanPlay={()=>setAudioState(current=>current==='playing'?current:'ready')} onEnded={()=>setAudioState('ready')} onError={()=>{setAudioState('error');setError('Tệp âm thanh không tải được. Vui lòng kiểm tra kết nối hoặc báo cho quản trị viên.');}}/><button className="audio-btn" onClick={playAudio} disabled={used>=2||audioState==='loading'||audioState==='error'} aria-label="Phát âm thanh">▶</button><div><b>{audioState==='error'?'Âm thanh không khả dụng':used>=2?'Đã dùng hết lượt phát':audioState==='loading'?'Đang tải âm thanh…':audioState==='playing'?'Đang phát…':'Phát âm thanh'}</b><span>Còn {Math.max(0,2-used)} / 2 lượt</span></div></div>}<div className="prompt" lang="ja">{q.prompt}</div><fieldset className="choices"><legend className="sr-only">Các lựa chọn</legend>{q.choices.map((choice,index)=><label key={index} className={`choice ${answers[q.id]===index?'selected':''}`}><input type="radio" name={q.id} checked={answers[q.id]===index} onChange={()=>choose(index)}/><span className="choice-index">{index+1}</span><span className="choice-label" lang="ja">{choice}</span></label>)}</fieldset></div><footer><span>Toàn bài: {Object.keys(answers).length}/{exam.questions.length} câu đã trả lời</span><div className="actions"><button className="secondary" disabled={!rule?.allowBack||sectionQuestions[0].index===currentIndex} onClick={()=>go(currentIndex-1)}>Quay lại</button><button className="primary" onClick={advance}>{currentIndex===exam.questions.length-1?'Kiểm tra & nộp':'Tiếp theo'}</button></div></footer></section></div></Frame>;
}

function Frame({timer,section,progress,children}:{timer:string;section?:string;progress?:string;children:React.ReactNode}){
  return <main className="exam-app"><header className="exam-top"><div className="exam-brand"><b>JFT Practice</b><span>Bài luyện tập không chính thức</span></div>{section&&<div className="exam-context"><span>{section}</span><b>{progress}</b></div>}<div className="exam-timer"><span>Thời gian còn lại</span><b>{timer}</b></div></header><div className="mobile-cbt-note">Để có trải nghiệm gần với CBT nhất, hãy dùng máy tính hoặc máy tính bảng.</div>{children}</main>;
}

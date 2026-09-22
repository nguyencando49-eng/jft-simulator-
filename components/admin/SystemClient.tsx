'use client';
import { useEffect,useState } from 'react';
import { adminApi } from '@/lib/api-client';
import { Alert,Badge } from '@/components/ui';

type RuntimeStatus={ready:boolean;authoringReady:boolean;blockers:string[];authoringBlockers:string[];repository:string;authentication:string;assetStorage:string;aiFactory:string;apiVersion:string};

export default function SystemClient(){
  const [data,setData]=useState<RuntimeStatus|null>(null),[error,setError]=useState('');
  useEffect(()=>{void adminApi.system().then(result=>setData(result)).catch(cause=>setError(cause instanceof Error?cause.message:'Tải trạng thái thất bại.'))},[]);
  const rows=data?[['Kho dữ liệu',data.repository],['Xác thực',data.authentication],['Lưu trữ tài nguyên',data.assetStorage],['Xưởng AI',data.aiFactory],['Phiên bản API',data.apiVersion]]:[];
  return <>
    <div className="admin-title"><div><span className="eyebrow">PRODUCTION READINESS</span><h1>Hệ thống</h1><p>Trạng thái runtime và các điều kiện còn thiếu trước khi mở cho người dùng thật.</p></div></div>
    {error&&<Alert tone="danger">{error}</Alert>}
    {data&&<section className="system-readiness">
      <div className="admin-panel">
        <div className="panel-head"><h2>Ứng dụng người học</h2><Badge tone={data.ready?'success':'danger'}>{data.ready?'READY':'NOT READY'}</Badge></div>
        {data.ready?<Alert tone="success">Kho dữ liệu, xác thực và lưu trữ bền vững đã sẵn sàng.</Alert>:<Alert tone="danger" title="Còn blocker production"><ul>{data.blockers.map(item=><li key={item}>{item}</li>)}</ul></Alert>}
      </div>
      <div className="admin-panel">
        <div className="panel-head"><h2>Xưởng nội dung</h2><Badge tone={data.authoringReady?'success':'warning'}>{data.authoringReady?'READY':'CONFIG REQUIRED'}</Badge></div>
        {data.authoringReady?<Alert tone="success">Generation, semantic QA và TTS đang dùng provider production.</Alert>:<Alert tone="warning"><ul>{data.authoringBlockers.map(item=><li key={item}>{item}</li>)}</ul></Alert>}
      </div>
    </section>}
    <section className="admin-panel"><div className="panel-head"><h2>Môi trường đang chạy</h2></div><div className="system-grid">{rows.length?rows.map(([key,value])=><div key={key}><span>{key}</span><b>{value}</b></div>):<p>Đang tải…</p>}</div></section>
  </>;
}

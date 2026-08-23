'use client';
import { useEffect,useState } from 'react';
import { adminApi } from '@/lib/api-client';

export default function SystemClient(){
  const [data,setData]=useState<{repository:string;authentication:string;assetStorage:string;aiFactory:string;apiVersion:string}|null>(null),[error,setError]=useState('');
  useEffect(()=>{void adminApi.system().then(result=>setData(result)).catch(cause=>setError(cause instanceof Error?cause.message:'Tải trạng thái thất bại.'))},[]);
  const rows=data?[['Kho dữ liệu',data.repository],['Xác thực',data.authentication],['Lưu trữ tài nguyên',data.assetStorage],['Xưởng AI',data.aiFactory],['Phiên bản API',data.apiVersion]]:[];
  return <>
    <div className="admin-title"><div><span className="eyebrow">BACKEND V5</span><h1>Hệ thống</h1><p>Trạng thái runtime, lưu trữ, xác thực và nhà cung cấp cho Xưởng AI.</p></div></div>
    {error&&<div className="admin-alert error">{error}</div>}
    <section className="admin-panel"><div className="panel-head"><h2>Môi trường đang chạy</h2><span className="badge green">V5</span></div><div className="system-grid">{rows.length?rows.map(([key,value])=><div key={key}><span>{key}</span><b>{value}</b></div>):<p>Đang tải…</p>}</div></section>
    <section className="admin-panel"><div className="panel-head"><h2>Danh sách API V5</h2></div><p className="muted">Thông tin kỹ thuật dành cho quản trị hệ thống.</p><div className="endpoint-list"><code>POST /api/v1/auth/login</code><code>GET /api/v1/auth/me</code><code>POST /api/v1/auth/logout</code><code>POST /api/v1/auth/signup</code><code>POST /api/v1/auth/recover</code><code>POST /api/v1/auth/reset</code><code>GET/PATCH /api/v1/profile</code><code>GET/POST /api/v1/questions</code><code>GET/POST /api/v1/factory/jobs</code><code>GET /api/v1/factory/jobs/:id</code><code>POST /api/v1/factory/jobs/:id/approve</code><code>GET/PUT/POST /api/v1/exams</code><code>POST /api/v1/sessions</code><code>POST /api/v1/sessions/:id/submit</code><code>GET /api/v1/admin/candidates</code></div></section>
  </>;
}

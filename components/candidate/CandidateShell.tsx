'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import UserMenu from '@/components/auth/UserMenu';

export default function CandidateShell({children}:{children:React.ReactNode}){
  const path=usePathname();
  const links=[
    ['/candidate','Tổng quan'],
    ['/candidate#exams','Đề luyện tập'],
    ['/candidate#history','Lịch sử'],
    ['/candidate/profile','Hồ sơ'],
  ] as const;
  return <main className="candidate-shell candidate-shell-pro">
    <header className="candidate-nav candidate-nav-pro">
      <Link href="/candidate" className="candidate-brand">
        <span>日</span>
        <div><b>JFT Practice</b><small>Japanese CBT training</small></div>
      </Link>
      <nav aria-label="Điều hướng học viên">{links.map(([href,label])=>{
        const active=href==='/candidate/profile'?path.startsWith('/candidate/profile'):href==='/candidate'?path==='/candidate':false;
        return <Link key={href} href={href} className={active?'active':''}>{label}</Link>;
      })}</nav>
      <UserMenu compact/>
    </header>
    {children}
    <footer className="candidate-footer candidate-footer-pro"><div><b>JFT Practice</b><span>Practice with structure. Review with evidence.</span></div><p>Trình mô phỏng luyện tập JFT-Basic không chính thức · Không liên kết với Japan Foundation hoặc Prometric.</p></footer>
  </main>;
}

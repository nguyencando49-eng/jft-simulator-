import { Suspense } from 'react'; import LoginClient from '@/components/auth/LoginClient';
export default function LoginPage(){return <Suspense fallback={<main className="auth-loading" aria-label="Đang tải trang đăng nhập"><span /></main>}><LoginClient/></Suspense>}

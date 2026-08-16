import AdminNav from '@/components/admin/AdminNav'; import AuthGate from '@/components/auth/AuthGate';
export default function AdminLayout({children}:{children:React.ReactNode}){return <AuthGate role="admin"><div className="admin-shell"><AdminNav/><main className="admin-main">{children}</main></div></AuthGate>}

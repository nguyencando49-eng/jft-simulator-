import ResultClient from '@/components/ResultClient';
import AuthGate from '@/components/auth/AuthGate';
export default async function ResultPage({searchParams}:{searchParams:Promise<{sessionId?:string}>}){
  const {sessionId}=await searchParams;
  return <AuthGate role="candidate"><ResultClient sessionId={sessionId}/></AuthGate>;
}

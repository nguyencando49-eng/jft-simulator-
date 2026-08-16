import ExamClient from '@/components/ExamClient'; import AuthGate from '@/components/auth/AuthGate';
export default function ExamPage(){return <AuthGate role="candidate"><ExamClient/></AuthGate>}

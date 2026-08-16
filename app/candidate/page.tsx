import AuthGate from '@/components/auth/AuthGate'; import CandidateDashboard from '@/components/candidate/CandidateDashboard';
export default function CandidatePage(){return <AuthGate role="candidate"><CandidateDashboard/></AuthGate>}

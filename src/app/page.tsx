import dynamic from 'next/dynamic';
import { UI_TOKENS } from '@/lib/theme';

const Dashboard = dynamic(() => import('@/components/features/dashboard/Dashboard'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        background: UI_TOKENS['bg-chrome'],
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: UI_TOKENS['text-secondary'], fontSize: '0.875rem' }}>Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}

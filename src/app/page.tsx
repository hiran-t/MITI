import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/features/dashboard/Dashboard'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        background: '#030712',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#4b5563', fontSize: '0.875rem' }}>Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}

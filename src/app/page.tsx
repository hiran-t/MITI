import dynamic from 'next/dynamic';

const Dashboard = dynamic(() => import('@/components/features/dashboard/Dashboard'), {
  ssr: false,
  loading: () => (
    <div
      style={{
        minHeight: '100vh',
        background: '#111216',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ color: '#adb3c3', fontSize: '0.875rem' }}>Loading...</div>
    </div>
  ),
});

export default function Home() {
  return <Dashboard />;
}

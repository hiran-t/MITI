import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'MITI - ROS2 Web Dashboard',
  description: 'Web application for visualizing and monitoring ROS2 topics',
  icons: {
    icon: '/robot_logo.svg',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* Inline background prevents white flash before CSS loads */}
      <body style={{ background: '#111216', color: '#e8eaf0' }}>{children}</body>
    </html>
  );
}

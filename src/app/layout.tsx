import type { Metadata } from 'next';
import './globals.css';
import { UI_TOKENS } from '@/lib/theme';

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
      <body style={{ background: UI_TOKENS['bg-chrome'], color: UI_TOKENS.text }}>{children}</body>
    </html>
  );
}

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

// Read the server's environment on each request, so the launcher (scripts/start-miti.mjs) or
// Docker can tell the page where foxglove_bridge listens without rebuilding MITI.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const runtime = { bridgePort: Number(process.env.MITI_BRIDGE_PORT) || null };
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{ __html: `window.__MITI__=${JSON.stringify(runtime)};` }}
        />
      </head>
      {/* Inline background prevents white flash before CSS loads */}
      <body style={{ background: UI_TOKENS['bg-chrome'], color: UI_TOKENS.text }}>{children}</body>
    </html>
  );
}

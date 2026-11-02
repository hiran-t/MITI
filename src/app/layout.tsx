import type { Metadata } from 'next';
import './globals.css';
import { UI_TOKENS } from '@/lib/theme';
import { accentVariables, readBranding } from '@/lib/server/branding';

/** The tab's title and icon: MITI's, or those of MITI_BRANDING_DIR (src/lib/server/branding.ts). */
export function generateMetadata(): Metadata {
  const branding = readBranding();
  return {
    title: branding?.title ?? 'MITI - ROS2 Web Dashboard',
    description: 'Web application for visualizing and monitoring ROS2 topics',
    icons: {
      icon: branding?.icon ? '/api/branding/icon' : '/robot_logo.svg',
    },
  };
}

// Read the server's environment on each request, so the launcher (scripts/start-miti.mjs) or
// Docker can tell the page where the bridge listens without rebuilding MITI.
export const dynamic = 'force-dynamic';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const branding = readBranding();
  const runtime = {
    bridgePort: Number(process.env.MITI_BRIDGE_PORT) || null,
    bridgeHint: process.env.MITI_BRIDGE_HINT || null,
    branding: branding && {
      name: branding.name,
      logo: branding.logo ? '/api/branding/logo' : null,
      logoHeight: branding.logoHeight,
    },
  };
  // The accent replaces MITI's teal; `html:root` outranks the `:root` the theme is set on.
  const accent =
    branding?.accent &&
    `html:root{${Object.entries(accentVariables(branding.accent))
      .map(([name, value]) => `${name}:${value}`)
      .join(';')}}`;
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            // `<` is escaped so a name from branding.json cannot end the script.
            __html: `window.__MITI__=${JSON.stringify(runtime).replace(/</g, '\\u003c')};`,
          }}
        />
        {accent && <style dangerouslySetInnerHTML={{ __html: accent }} />}
      </head>
      {/* Inline background prevents white flash before CSS loads */}
      <body style={{ background: UI_TOKENS['bg-chrome'], color: UI_TOKENS.text }}>{children}</body>
    </html>
  );
}

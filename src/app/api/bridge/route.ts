import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * ROS network settings of the foxglove_bridge started beside MITI. scripts/start-miti.mjs owns
 * that bridge and serves the settings on 127.0.0.1 (MITI_BRIDGE_CONTROL, MITI_BRIDGE_TOKEN);
 * this route passes requests through. Without the launcher (Docker, `npm run dev`, a bridge on
 * the robot) the settings live where the bridge runs.
 */
async function forward(init?: RequestInit) {
  const control = process.env.MITI_BRIDGE_CONTROL;
  if (!control)
    return NextResponse.json({
      available: false,
      reason:
        'MITI did not start this foxglove_bridge: set ROS_DOMAIN_ID and ROS_STATIC_PEERS where it runs, or start both with ' +
        (process.env.MITI_BRIDGE_HINT || 'pixi run -e <distro> miti-bridge') +
        '.',
    });
  try {
    const response = await fetch(`${control}/settings`, {
      ...init,
      cache: 'no-store',
      headers: {
        ...init?.headers,
        Authorization: `Bearer ${process.env.MITI_BRIDGE_TOKEN ?? ''}`,
      },
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: 'The MITI launcher is not answering' }, { status: 502 });
  }
}

export function GET() {
  return forward();
}

export async function PUT(request: Request) {
  // JSON only: a cross-site form cannot send it without a CORS preflight, which is refused.
  if (!request.headers.get('content-type')?.includes('application/json'))
    return NextResponse.json({ error: 'Send JSON' }, { status: 415 });
  return forward({
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: await request.text(),
  });
}

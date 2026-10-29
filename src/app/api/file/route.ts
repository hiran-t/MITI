import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';
import { contentTypeFor, findAllowedFile } from '@/lib/server/package-files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Serves `file://` mesh URIs, limited to files inside the ROS package search paths. */
export async function GET(request: Request) {
  const requested = new URL(request.url).searchParams.get('path') ?? '';
  const file = await findAllowedFile(requested);
  if (!file)
    return NextResponse.json(
      { error: `${requested} is not a mesh, texture or URDF inside a ROS package path` },
      { status: 404 }
    );
  return new NextResponse(await fs.readFile(file), {
    headers: {
      'Content-Type': contentTypeFor(file) ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=300',
    },
  });
}

import { NextResponse } from 'next/server';
import { readWidgetFile } from '@/lib/server/widget-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * A file of an installed widget: `/api/widgets/files/<id>/<version>/<path>`. The browser imports
 * the widget's code from here; a version's files never change, so they are cached for good.
 */
export async function GET(_request: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const [id = '', version = '', ...rest] = (await params).path;
  const file = await readWidgetFile(id, version, rest.join('/'));
  if (!file) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      'Content-Type': file.contentType,
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

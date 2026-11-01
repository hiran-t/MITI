import { NextResponse } from 'next/server';
import { readBranding, readBrandingImage } from '@/lib/server/branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The logo or browser icon of MITI_BRANDING_DIR: `/api/branding/logo`, `/api/branding/icon`. */
export function GET(_request: Request, { params }: { params: { file: string } }) {
  const which = params.file === 'logo' || params.file === 'icon' ? params.file : null;
  const image = which && readBrandingImage(readBranding(), which);
  if (!image) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return new NextResponse(new Uint8Array(image.data), {
    headers: {
      'Content-Type': image.contentType,
      // Short, so a new logo shows soon after it is replaced.
      'Cache-Control': 'public, max-age=60',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

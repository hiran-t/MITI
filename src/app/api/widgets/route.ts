import { NextResponse } from 'next/server';
import {
  MAX_PACKAGE_BYTES,
  installWidget,
  listWidgets,
  removeWidget,
  widgetImportAllowed,
} from '@/lib/server/widget-store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Installed widgets; see src/lib/server/widget-store.ts. */
export async function GET() {
  const { widgets, problems } = await listWidgets();
  return NextResponse.json({ importAllowed: widgetImportAllowed(), widgets, problems });
}

const refused = () =>
  NextResponse.json(
    { error: 'Widgets cannot be imported or removed here (MITI_WIDGET_IMPORT=off)' },
    { status: 403 }
  );

/**
 * Whether the request comes from another site's page. A page the operator happens to open must
 * not install code into MITI; tools such as curl send neither header and are let through.
 */
function fromAnotherSite(request: Request): boolean {
  const site = request.headers.get('sec-fetch-site');
  if (site) return site !== 'same-origin' && site !== 'none';
  const origin = request.headers.get('origin');
  if (!origin) return false;
  try {
    return new URL(origin).host !== request.headers.get('host');
  } catch {
    return true;
  }
}

const crossSite = () =>
  NextResponse.json({ error: 'Widgets can only be managed from MITI itself' }, { status: 403 });

/**
 * A package is sent as application/octet-stream (or application/zip). Other sites' pages can send
 * text/plain or form bodies without asking first; those types are refused.
 */
const PACKAGE_TYPES = /^application\/(octet-stream|zip|x-zip-compressed)\b/i;

/** The request body, or null when it is larger than a package may be. */
async function readBody(request: Request): Promise<Uint8Array | null> {
  if (Number(request.headers.get('content-length')) > MAX_PACKAGE_BYTES) return null;
  const reader = request.body?.getReader();
  if (!reader) return new Uint8Array();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > MAX_PACKAGE_BYTES) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const body = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/** Import a widget: the body is the `.miti-widget` file. */
export async function POST(request: Request) {
  if (!widgetImportAllowed()) return refused();
  if (fromAnotherSite(request)) return crossSite();
  if (!PACKAGE_TYPES.test(request.headers.get('content-type') ?? ''))
    return NextResponse.json(
      { error: 'Send the package as Content-Type: application/octet-stream' },
      { status: 415 }
    );
  const body = await readBody(request);
  if (!body)
    return NextResponse.json(
      { error: `The package is larger than ${MAX_PACKAGE_BYTES / 1024 / 1024} MB` },
      { status: 413 }
    );
  try {
    return NextResponse.json(await installWidget(body), { status: 201 });
  } catch (error) {
    const message = (error as Error).message;
    // Problems with the package are the sender's; anything else is the server's (e.g. disk).
    const status = /^(The |manifest\.json)/.test(message) ? 400 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}

/** Remove a widget: `DELETE /api/widgets?id=<id>`. */
export async function DELETE(request: Request) {
  if (!widgetImportAllowed()) return refused();
  if (fromAnotherSite(request)) return crossSite();
  const id = new URL(request.url).searchParams.get('id') ?? '';
  return (await removeWidget(id))
    ? new NextResponse(null, { status: 204 })
    : NextResponse.json({ error: `No widget ${id} is installed` }, { status: 404 });
}

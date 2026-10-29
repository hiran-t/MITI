import { promises as fs } from 'fs';
import { NextResponse } from 'next/server';
import { contentTypeFor, findPackageFile, hasSearchPaths } from '@/lib/server/package-files';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Serves `package://<pkg>/<path>` meshes, textures and URDFs from the local ROS workspace. */
export async function GET(_request: Request, { params }: { params: { path: string[] } }) {
  const [pkg, ...rest] = params.path;
  const relativePath = rest.join('/');
  const contentType = contentTypeFor(relativePath);
  if (!pkg || !relativePath || !contentType)
    return NextResponse.json(
      { error: 'Only mesh, texture and URDF files are served' },
      { status: 400 }
    );
  if (!hasSearchPaths())
    return NextResponse.json(
      {
        error:
          'MITI server has no ROS package path: start it from a shell with the ROS workspace sourced, or set MITI_PACKAGE_PATH',
      },
      { status: 404 }
    );
  const file = await findPackageFile(pkg, relativePath);
  if (!file)
    return NextResponse.json(
      { error: `package://${pkg}/${relativePath} not found` },
      { status: 404 }
    );
  return new NextResponse(await fs.readFile(file), {
    headers: { 'Content-Type': contentType, 'Cache-Control': 'public, max-age=300' },
  });
}

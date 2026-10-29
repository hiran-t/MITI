import { mkdirSync, mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import path from 'path';
import { findAllowedFile, findPackageFile } from '../package-files';

const root = mkdtempSync(path.join(tmpdir(), 'miti-pkg-'));
const install = path.join(root, 'install');
mkdirSync(path.join(install, 'share', 'robot_description', 'meshes'), { recursive: true });
writeFileSync(path.join(install, 'share', 'robot_description', 'meshes', 'base.stl'), 'solid');
writeFileSync(path.join(install, 'share', 'robot_description', 'package.xml'), '<package/>');
writeFileSync(path.join(root, 'secret.stl'), 'solid');
const env = { AMENT_PREFIX_PATH: install };

test('package:// files resolve inside <prefix>/share/<pkg>', async () => {
  expect(await findPackageFile('robot_description', 'meshes/base.stl', env)).toBe(
    path.join(install, 'share', 'robot_description', 'meshes', 'base.stl')
  );
  expect(await findPackageFile('robot_description', 'meshes/missing.stl', env)).toBeNull();
  expect(await findPackageFile('other_pkg', 'meshes/base.stl', env)).toBeNull();
});

test('traversal, unknown packages and non-resource files are refused', async () => {
  expect(await findPackageFile('robot_description', '../../../secret.stl', env)).toBeNull();
  expect(await findPackageFile('../robot_description', 'meshes/base.stl', env)).toBeNull();
  expect(await findPackageFile('robot_description', 'package.xml', env)).toBeNull();
  expect(await findPackageFile('robot_description', 'meshes/base.stl', {})).toBeNull();
});

test('file:// paths must be inside a search root', async () => {
  const mesh = path.join(install, 'share', 'robot_description', 'meshes', 'base.stl');
  expect(await findAllowedFile(mesh, env)).toBe(mesh);
  expect(await findAllowedFile(path.join(root, 'secret.stl'), env)).toBeNull();
  expect(
    await findAllowedFile(path.join(install, 'share', '..', '..', 'secret.stl'), env)
  ).toBeNull();
});

test('MITI_PACKAGE_PATH can name a colcon install folder with isolated packages', async () => {
  const isolated = path.join(root, 'ws', 'install');
  mkdirSync(path.join(isolated, 'arm_pkg', 'share', 'arm_pkg', 'meshes'), { recursive: true });
  writeFileSync(
    path.join(isolated, 'arm_pkg', 'share', 'arm_pkg', 'meshes', 'arm.dae'),
    '<COLLADA/>'
  );
  expect(await findPackageFile('arm_pkg', 'meshes/arm.dae', { MITI_PACKAGE_PATH: isolated })).toBe(
    path.join(isolated, 'arm_pkg', 'share', 'arm_pkg', 'meshes', 'arm.dae')
  );
});

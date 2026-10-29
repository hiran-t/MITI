import { resolveResourceUrl, resourceBase } from '../resources';

test('package:// URIs prefer an explicit mapping, then the mesh server, then MITI', () => {
  const uri = 'package://robot_description/meshes/base link.stl';
  expect(resolveResourceUrl(uri)).toBe('/api/package/robot_description/meshes/base%20link.stl');
  expect(resolveResourceUrl(uri, { meshBaseUrl: 'http://robot:8000/' })).toBe(
    'http://robot:8000/meshes/base link.stl'
  );
  expect(
    resolveResourceUrl(uri, {
      meshBaseUrl: 'http://robot:8000',
      packageMapping: { robot_description: 'http://robot:8001/desc' },
    })
  ).toBe('http://robot:8001/desc/meshes/base link.stl');
});

test('file:// goes through the MITI file route and URLs pass through', () => {
  expect(resolveResourceUrl('file:///opt/ros/share/x/m.dae')).toBe(
    '/api/file?path=%2Fopt%2Fros%2Fshare%2Fx%2Fm.dae'
  );
  expect(resolveResourceUrl('https://host/m.stl')).toBe('https://host/m.stl');
});

test('relative meshes resolve next to URDFs loaded from files, packages and URLs', () => {
  const mesh = (urdf: string) => resolveResourceUrl(`${resourceBase(urdf)}meshes/pelvis.STL`);
  expect(mesh('/home/pacen/g1_description/g1.urdf')).toBe(
    '/api/file?path=%2Fhome%2Fpacen%2Fg1_description%2Fmeshes%2Fpelvis.STL'
  );
  expect(mesh('package://g1_description/urdf/g1.urdf')).toBe(
    '/api/package/g1_description/urdf/meshes/pelvis.STL'
  );
  expect(mesh('http://robot:8000/g1.urdf')).toBe('http://robot:8000/meshes/pelvis.STL');
});

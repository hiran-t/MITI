import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { ColladaLoader } from 'three/examples/jsm/loaders/ColladaLoader.js';
import { colladaZUp } from '../mesh-loader';

/** A COLLADA file with one triangle whose tip is at (0, 0, 1) in the file's own axes. */
const collada = (upAxis: 'Z_UP' | 'Y_UP') => `<?xml version="1.0" encoding="utf-8"?>
<COLLADA xmlns="http://www.collada.org/2005/11/COLLADASchema" version="1.4.1">
  <asset><unit name="meter" meter="1"/><up_axis>${upAxis}</up_axis></asset>
  <library_geometries>
    <geometry id="triangle"><mesh>
      <source id="positions">
        <float_array id="positions-array" count="9">0 0 0 0.1 0 0 0 0 1</float_array>
        <technique_common><accessor source="#positions-array" count="3" stride="3">
          <param name="X" type="float"/><param name="Y" type="float"/><param name="Z" type="float"/>
        </accessor></technique_common>
      </source>
      <vertices id="vertices"><input semantic="POSITION" source="#positions"/></vertices>
      <triangles count="1"><input semantic="VERTEX" source="#vertices" offset="0"/><p>0 1 2</p></triangles>
    </mesh></geometry>
  </library_geometries>
  <library_visual_scenes>
    <visual_scene id="scene"><node id="node"><instance_geometry url="#triangle"/></node></visual_scene>
  </library_visual_scenes>
  <scene><instance_visual_scene url="#scene"/></scene>
</COLLADA>`;

const URDF = `<robot name="arm">
  <link name="link"><visual><geometry><mesh filename="triangle.dae"/></geometry></visual></link>
</robot>`;

/** Where the triangle's tip is once URDFLoader has placed the mesh in its link, as robots load. */
function tip(upAxis: 'Z_UP' | 'Y_UP', ignoreUpAxis: boolean): number[] {
  const loader = new URDFLoader();
  loader.loadMeshCb = (_path, _manager, _material, done) => {
    const parsed = new ColladaLoader().parse(collada(upAxis), '');
    if (!parsed) throw new Error('ColladaLoader could not parse the test file');
    done(colladaZUp(parsed.scene, ignoreUpAxis));
  };
  const robot = loader.parse(URDF);
  robot.updateMatrixWorld(true);
  const meshes: THREE.Mesh[] = [];
  robot.traverse((object) => {
    if (object instanceof THREE.Mesh) meshes.push(object);
  });
  expect(meshes).toHaveLength(1);
  const [mesh] = meshes;
  const point = new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), 2);
  return point.applyMatrix4(mesh.matrixWorld).toArray();
}

function expectNear(actual: number[], expected: number[]) {
  actual.forEach((value, i) => expect(value).toBeCloseTo(expected[i], 6));
}

describe('colladaZUp', () => {
  beforeAll(() => {
    // ColladaLoader reports the file version and warns about Z_UP files.
    jest.spyOn(console, 'debug').mockImplementation(() => {});
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterAll(() => jest.restoreAllMocks());

  it('keeps a Z_UP mesh upright in a robot model', () => {
    expectNear(tip('Z_UP', false), [0, 0, 1]);
  });

  it('turns a Y_UP mesh upright: its +Y becomes +Z', () => {
    expectNear(tip('Y_UP', false), [0, -1, 0]);
  });

  it('takes the geometry as Z-up when told to ignore <up_axis>', () => {
    expectNear(tip('Y_UP', true), [0, 0, 1]);
    expectNear(tip('Z_UP', true), [0, 0, 1]);
  });
});

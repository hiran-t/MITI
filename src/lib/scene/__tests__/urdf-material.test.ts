import * as THREE from 'three';
import URDFLoader from 'urdf-loader';
import { applyUrdfMaterial } from '../urdf-material';

const URDF = `<robot name="arm">
  <material name="red"><color rgba="1 0 0 1"/></material>
  <link name="base_link">
    <visual><geometry><mesh filename="base.stl"/></geometry><material name="red"/></visual>
  </link>
  <link name="arm_link">
    <visual><geometry><mesh filename="arm.dae"/></geometry><material name="red"/></visual>
  </link>
  <link name="tool_link">
    <visual><geometry><mesh filename="tool.stl"/></geometry></visual>
  </link>
  <joint name="arm_joint" type="fixed"><parent link="base_link"/><child link="arm_link"/></joint>
  <joint name="tool_joint" type="fixed"><parent link="arm_link"/><child link="tool_link"/></joint>
</robot>`;

/** Loads the URDF with stand-ins: an STL as one gray mesh, a COLLADA scene as a green group. */
function load() {
  const meshes = new Map<string, THREE.Object3D>();
  const loader = new URDFLoader();
  loader.loadMeshCb = (path, _manager, material, done) => {
    const gray = new THREE.MeshStandardMaterial({ color: 0xaaaaaa });
    const object = path.endsWith('.stl')
      ? new THREE.Mesh(new THREE.BoxGeometry(), gray)
      : new THREE.Group().add(
          new THREE.Mesh(
            new THREE.BoxGeometry(),
            new THREE.MeshStandardMaterial({ color: 0x00ff00 })
          )
        );
    applyUrdfMaterial(object, material);
    meshes.set(path.split('/').pop() ?? path, object);
    done(object);
  };
  loader.parse(URDF);
  return meshes;
}

const colorOf = (mesh: THREE.Object3D) =>
  ((mesh as THREE.Mesh).material as THREE.MeshPhongMaterial).color.getHex();

test("an STL mesh takes its visual's URDF material", () => {
  expect(colorOf(load().get('base.stl')!)).toBe(0xff0000);
});

test('an STL mesh without a URDF material takes the default one, not its own gray', () => {
  const tool = load().get('tool.stl') as THREE.Mesh;
  expect(tool.material).toBeInstanceOf(THREE.Material);
  expect(colorOf(tool)).not.toBe(0xaaaaaa);
});

test('a loaded scene keeps the materials it brings', () => {
  const arm = load().get('arm.dae')!;
  expect(colorOf(arm.children[0])).toBe(0x00ff00);
});

test('the replaced material is disposed', () => {
  const own = new THREE.MeshStandardMaterial();
  const dispose = jest.spyOn(own, 'dispose');
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(), own);
  const urdf = new THREE.MeshPhongMaterial({ color: 0xff0000 });
  applyUrdfMaterial(mesh, urdf);
  expect(mesh.material).toBe(urdf);
  expect(dispose).toHaveBeenCalled();
  applyUrdfMaterial(mesh, urdf);
  expect(dispose).toHaveBeenCalledTimes(1);
});

import { Box3, Group, Material, Mesh, Object3D, Texture, Vector3 } from 'three';
import { LIMITS, ModelError } from './validation';
export interface TreeNode { id: string; name: string; mesh: boolean; children: TreeNode[] }
export interface PreparedModel {
  id: string; name: string; root: Group; scene: Object3D; tree: TreeNode[];
  meshCount: number; triangles: number; vertices: number; dimensions: [number,number,number]; bytes: number;
  demo: boolean; hasExplode: boolean; originals: Map<string, Vector3>;
}
export function objectName(object: Object3D): string {
  return typeof object.userData.name === 'string' && object.userData.name ? object.userData.name : object.name || (object instanceof Mesh ? 'Unnamed mesh' : 'Group');
}
export function disposeModel(root: Object3D) {
  const geometries = new Set<Mesh['geometry']>(); const materials = new Set<Material>(); const textures = new Set<Texture>(); const images = new Set<ImageBitmap>();
  root.traverse(o => { if (o instanceof Mesh) { geometries.add(o.geometry); for (const m of Array.isArray(o.material) ? o.material : [o.material]) materials.add(m); } });
  for (const m of materials) for (const value of Object.values(m)) if (value instanceof Texture) textures.add(value);
  for (const t of textures) { if (typeof ImageBitmap !== 'undefined' && t.image instanceof ImageBitmap) images.add(t.image); t.dispose(); }
  for (const i of images) i.close();
  for (const m of materials) m.dispose();
  for (const g of geometries) g.dispose();
}
export function prepareModel(scene: Object3D, name: string, bytes: number, demo = false): PreparedModel {
  scene.updateMatrixWorld(true);
  const box = new Box3().setFromObject(scene, true);
  const size = box.getSize(new Vector3()), center = box.getCenter(new Vector3());
  if (![...size, ...center].every(Number.isFinite) || Math.max(...size) <= 1e-9) throw new ModelError('The model has no visible geometry or its dimensions are invalid.');
  let meshCount = 0, triangles = 0, vertices = 0, pixels = 0;
  const textures = new Set<Texture>();
  const originals = new Map<string, Vector3>();
  let hasExplode = false;
  scene.traverse(object => {
    originals.set(object.uuid, object.position.clone());
    if (demo && Array.isArray(object.userData.explode)) hasExplode = true;
    if (!(object instanceof Mesh)) return;
    meshCount++; vertices += object.geometry.getAttribute('position')?.count ?? 0;
    triangles += (object.geometry.index?.count ?? object.geometry.getAttribute('position')?.count ?? 0) / 3;
    const mats = Array.isArray(object.material) ? object.material : [object.material];
    for (const m of mats) for (const v of Object.values(m)) if (v instanceof Texture) textures.add(v);
    object.castShadow = false; object.receiveShadow = false;
  });
  for (const t of textures) { const image = t.image as {width?: number; height?: number} | undefined; const w = image?.width ?? 0, h = image?.height ?? 0; pixels += w * h; if (w > LIMITS.textureSize || h > LIMITS.textureSize) throw new ModelError('A texture is larger than 8,192 pixels. Resize the model’s textures.'); }
  if (pixels > LIMITS.texturePixels || meshCount > LIMITS.meshes || vertices > LIMITS.vertices || triangles > LIMITS.triangles) throw new ModelError('This model exceeds the workspace complexity budget. Reduce meshes, polygons, or texture resolution.');
  if (!meshCount) throw new ModelError('No mesh geometry was found in the model.');
  const normalized = new Group(); normalized.name = 'Normalized model';
  const scale = 3.8 / Math.max(...size);
  normalized.scale.setScalar(scale); normalized.position.copy(center).multiplyScalar(-scale); normalized.add(scene);
  const root = new Group(); root.name = name; root.add(normalized);
  const treeNode = (o: Object3D): TreeNode => ({ id: o.uuid, name: objectName(o), mesh: o instanceof Mesh, children: o.children.map(treeNode) });
  return { id: root.uuid, name, root, scene, tree: scene.children.map(treeNode), meshCount, triangles: Math.round(triangles), vertices, dimensions: size.toArray(), bytes, demo, hasExplode, originals };
}
export function resetTransform(model: PreparedModel) { model.root.position.set(0,0,0); model.root.quaternion.identity(); model.root.scale.setScalar(1); }
export function applyExplode(model: PreparedModel, amount: number) {
  model.scene.traverse(o => {
    const original = model.originals.get(o.uuid); if (original) o.position.copy(original);
    const direction: unknown = o.userData.explode;
    if (model.demo && Array.isArray(direction) && direction.length === 3 && direction.every(Number.isFinite)) {
      o.position.x += Number(direction[0]) * amount; o.position.y += Number(direction[1]) * amount; o.position.z += Number(direction[2]) * amount;
    }
  });
}

export const LIMITS = { fileBytes: 50 * 1024 * 1024, totalBytes: 100 * 1024 * 1024, files: 128, meshes: 512, nodes: 3000, vertices: 2_000_000, triangles: 1_000_000, textureSize: 8192, texturePixels: 64_000_000 };
export class ModelError extends Error { constructor(message: string) { super(message); this.name = 'ModelError'; } }
export function validateFiles(files: File[]): File {
  if (!files.length) throw new ModelError('Choose a GLB model, or a GLTF file together with its textures and BIN files.');
  if (files.length > LIMITS.files) throw new ModelError('Too many files. Import at most 128 files at a time.');
  if (files.some(f => f.size === 0)) throw new ModelError('One of the selected files is empty. Export the model again.');
  if (files.some(f => f.size > LIMITS.fileBytes) || files.reduce((n,f) => n + f.size, 0) > LIMITS.totalBytes) throw new ModelError('This model is too large. Limit each file to 50 MB and the complete set to 100 MB.');
  const models = files.filter(f => /\.(glb|gltf)$/i.test(f.name));
  if (models.length !== 1) throw new ModelError(models.length ? 'Import one model at a time, together with its dependencies.' : 'Unsupported format. Choose a .glb or .gltf model.');
  return models[0];
}
type RecordData = Record<string, unknown>;
function record(value: unknown): RecordData { if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ModelError('The model contains invalid GLTF data.'); return value as RecordData; }
function entries(value: unknown): RecordData[] { if (value === undefined) return []; if (!Array.isArray(value)) throw new ModelError('The model contains an invalid data list.'); return value.map(record); }
export function safePath(path: string): string {
  let decoded: string;
  try { decoded = decodeURIComponent(path).replace(/\\/g, '/'); } catch { throw new ModelError('A model dependency has an invalid filename.'); }
  if (/^[a-z][a-z\d+.-]*:/i.test(decoded) || decoded.startsWith('/') || decoded.split('/').includes('..') || Array.from(decoded).some(c => c.charCodeAt(0) < 32)) throw new ModelError('External URLs and parent-directory paths are blocked. Include all dependencies locally, or export a self-contained GLB.');
  return decoded.replace(/^(\.\/)+/, '');
}
export interface Preflight { json: RecordData; uris: string[] }
export function preflight(data: ArrayBuffer, binary: boolean): Preflight {
  let json: RecordData;
  try {
    if (binary) {
      const view = new DataView(data);
      if (data.byteLength < 20 || view.getUint32(0, true) !== 0x46546c67 || view.getUint32(4, true) !== 2 || view.getUint32(8, true) !== data.byteLength || view.getUint32(16, true) !== 0x4e4f534a) throw new Error();
      const length = view.getUint32(12, true);
      if (length > data.byteLength - 20 || length > 12_000_000) throw new Error();
      json = record(JSON.parse(new TextDecoder().decode(data.slice(20, 20 + length))));
    } else json = record(JSON.parse(new TextDecoder().decode(data)));
  } catch { throw new ModelError('This file is not a valid GLTF 2.0 model. Export it again as GLB or GLTF.'); }
  if (record(json.asset).version !== '2.0') throw new ModelError('Only GLTF 2.0 models are supported.');
  if (entries(json.meshes).length > LIMITS.meshes || entries(json.nodes).length > LIMITS.nodes) throw new ModelError('This model has too many objects. Simplify it to at most 512 meshes and 3,000 nodes.');
  const nodes = entries(json.nodes);
  const parents = new Set<number>();
  for (const node of nodes) {
    if (node.children !== undefined && !Array.isArray(node.children)) throw new ModelError('The model contains an invalid hierarchy.');
    for (const child of (node.children ?? []) as unknown[]) {
      if (!Number.isSafeInteger(child) || Number(child) < 0 || Number(child) >= nodes.length || parents.has(Number(child))) throw new ModelError('The model contains an invalid hierarchy.');
      parents.add(Number(child));
    }
  }
  const visiting = new Set<number>(), done = new Set<number>();
  const visit = (index:number, depth=0) => {
    if (visiting.has(index) || depth > 128) throw new ModelError('The model hierarchy is cyclic or too deep.');
    if (done.has(index)) return;
    visiting.add(index);
    for (const child of (nodes[index].children ?? []) as number[]) visit(child,depth+1);
    visiting.delete(index); done.add(index);
  };
  nodes.forEach((_,index)=>{ if (!parents.has(index)) visit(index); });
  nodes.forEach((_,index)=>visit(index));
  let elements = 0, decodedBytes = 0;
  for (const a of entries(json.accessors)) {
    if (!Number.isSafeInteger(a.count) || Number(a.count) < 0 || Number(a.count) > LIMITS.vertices * 3) throw new ModelError('The model declares an invalid or excessive geometry size.');
    elements += Number(a.count);
    const components: Record<string,number> = {SCALAR:1,VEC2:2,VEC3:3,VEC4:4,MAT2:4,MAT3:9,MAT4:16};
    const widths: Record<string,number> = {'5120':1,'5121':1,'5122':2,'5123':2,'5125':4,'5126':4};
    if (!components[String(a.type)] || !widths[String(a.componentType)]) throw new ModelError('The model has an invalid geometry accessor.');
    decodedBytes += Number(a.count) * components[String(a.type)] * widths[String(a.componentType)];
  }
  if (elements > 24_000_000 || decodedBytes > 128 * 1024 * 1024) throw new ModelError('This model exceeds the geometry memory budget. Simplify it before importing.');
  for (const b of entries(json.buffers)) if (!Number.isSafeInteger(b.byteLength) || Number(b.byteLength) > LIMITS.totalBytes || Number(b.byteLength) < 0) throw new ModelError('The model declares an invalid or oversized buffer.');
  const required = json.extensionsRequired;
  if (Array.isArray(required) && required.some(v => ['KHR_draco_mesh_compression', 'KHR_texture_basisu', 'EXT_meshopt_compression'].includes(String(v)))) throw new ModelError('Compressed Draco, Meshopt, or KTX2 assets are not supported in this release. Export an uncompressed GLB.');
  const uris: string[] = [];
  for (const resource of [...entries(json.buffers), ...entries(json.images)]) {
    if (resource.uri === undefined) continue;
    if (typeof resource.uri !== 'string') throw new ModelError('A model dependency has an invalid URI.');
    if (resource.uri.startsWith('data:')) {
      if (!/^data:(application\/(octet-stream|gltf-buffer)|image\/(png|jpeg|webp));base64,[A-Za-z0-9+/=\s]+$/.test(resource.uri)) throw new ModelError('Unsupported embedded resource. Use PNG, JPEG, or WebP textures and binary buffers.');
    } else uris.push(safePath(resource.uri));
  }
  for (const image of entries(json.images)) if (image.mimeType && !['image/png','image/jpeg','image/webp'].includes(String(image.mimeType))) throw new ModelError('Unsupported texture. Use PNG, JPEG, or WebP images.');
  return { json, uris };
}

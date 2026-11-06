import { validateTextures } from './textures';
import { LoadingManager } from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { disposeModel, prepareModel } from './model';
import type { PreparedModel } from './model';
import { ModelError, preflight, safePath, validateFiles } from './validation';
export async function importModel(files: File[]): Promise<PreparedModel> {
  const entry = validateFiles(files);
  const data = await entry.arrayBuffer();
  const { json, uris } = preflight(data, /\.glb$/i.test(entry.name));
  const paths = new Map<string, File>();
  const basenames = new Map<string, File[]>();
  for (const file of files) {
    const path = safePath(file.webkitRelativePath || file.name);
    paths.set(path, file);
    const list = basenames.get(file.name) ?? []; list.push(file); basenames.set(file.name, list);
  }
  const base = (entry.webkitRelativePath || entry.name).split('/').slice(0,-1).join('/');
  const resolved = new Map<string, File>();
  for (const uri of uris) {
    const candidates = basenames.get(uri.split('/').pop()!) ?? [];
    const file = paths.get(base ? `${base}/${uri}` : uri) ?? paths.get(uri) ?? (candidates.length === 1 ? candidates[0] : undefined);
    if (!file) throw new ModelError(`Missing dependency “${uri}”. Select the GLTF and all of its BIN and texture files together, or export a single GLB.`);
    resolved.set(uri, file);
  }
  await validateTextures(json, data, /\.glb$/i.test(entry.name), uri => resolved.get(safePath(uri)));
  const urls = new Map<string, string>();
  const manager = new LoadingManager();
  manager.setURLModifier(url => {
    if (url.startsWith('blob:') || url.startsWith('data:')) return url;
    const path = safePath(url); const file = resolved.get(path);
    if (!file) throw new ModelError(`Unresolved local dependency “${path}”. External requests are blocked.`);
    if (!urls.has(path)) urls.set(path, URL.createObjectURL(file));
    return urls.get(path)!;
  });
  try {
    const result = await new GLTFLoader(manager).parseAsync(data, '');
    try { return prepareModel(result.scene, entry.name, files.reduce((n,f) => n+f.size,0)); }
    catch (error) { disposeModel(result.scene); throw error; }
  } catch (error) {
    if (error instanceof ModelError) throw error;
    throw new ModelError('The model could not be read. Check that it is a valid, uncompressed GLTF 2.0 file and that all dependencies are included.');
  } finally { for (const url of urls.values()) URL.revokeObjectURL(url); }
}
export async function loadDemo(): Promise<PreparedModel> {
  const response = await fetch(`${import.meta.env.BASE_URL}models/orbital-drive.glb`);
  if (!response.ok) throw new ModelError('The example model could not be loaded. Try again or import your own GLB.');
  const data = await response.arrayBuffer(); preflight(data, true);
  const result = await new GLTFLoader().parseAsync(data, '');
  try { return prepareModel(result.scene, 'Orbital drive', data.byteLength, true); } catch (error) { disposeModel(result.scene); throw error; }
}

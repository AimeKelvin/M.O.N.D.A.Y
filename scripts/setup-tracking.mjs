import { mkdir, copyFile, readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
const root = fileURLToPath(new URL('../', import.meta.url));
const target = `${root}public/mediapipe`;
await mkdir(target, { recursive: true });
for (const name of await readdir(`${root}node_modules/@mediapipe/tasks-vision/wasm`)) {
  if (/\.(wasm|js)$/.test(name)) await copyFile(`${root}node_modules/@mediapipe/tasks-vision/wasm/${name}`, `${target}/${name}`);
}
const expectedHash = 'fbc2a30080c3c557093b5ddfc334698132eb341044ccee322ccf8bcf3607cde1';
const url = 'https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
let data;
try { data = await readFile(`${target}/hand_landmarker.task`); } catch {
  console.log('Downloading the version 1 MediaPipe hand landmark model for self-hosting…');
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Model download failed: ${response.status}. Run npm run assets:tracking to retry.`);
  data = Buffer.from(await response.arrayBuffer());
  if (data.length < 1000000 || data.length > 15000000) throw new Error('Unexpected hand model size.');
  if (createHash('sha256').update(data).digest('hex') !== expectedHash) throw new Error('Tracking model checksum mismatch. Refusing unverified model.');
  await writeFile(`${target}/hand_landmarker.task`, data);
}
if (createHash('sha256').update(data).digest('hex') !== expectedHash) throw new Error('Cached tracking model checksum mismatch. Remove public/mediapipe/hand_landmarker.task and retry npm run assets:tracking.');
console.log(`Self-hosted MediaPipe model: ${data.length} bytes; SHA-256 ${createHash('sha256').update(data).digest('hex')}`);

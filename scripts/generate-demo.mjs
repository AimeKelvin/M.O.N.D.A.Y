/**
 * Original MONDAY Orbital Drive study. MIT licensed.
 * Run: npm run generate:demo (or node scripts/generate-demo.mjs)
 * No downloaded geometry, textures, fonts, or external source assets.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import {
  Box3, BoxGeometry, CylinderGeometry, ExtrudeGeometry, Group,
  Mesh, MeshStandardMaterial, Path, Shape, TorusGeometry, Vector3,
} from 'three';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';

// GLTFExporter uses this small browser API only to encode its completed binary.
if (!globalThis.FileReader) {
  globalThis.FileReader = class {
    readAsArrayBuffer(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = result;
        this.onloadend?.();
      });
    }
    readAsDataURL(blob) {
      blob.arrayBuffer().then((result) => {
        this.result = `data:${blob.type};base64,${Buffer.from(result).toString('base64')}`;
        this.onloadend?.();
      });
    }
  };
}

const model = new Group();
model.name = 'Orbital drive · OD–01';
model.userData = {
  title: 'Orbital drive OD–01',
  description: 'Original illustrative planetary-drive assembly, authored for MONDAY. Not an engineering drawing or manufacturing specification.',
  author: 'MONDAY contributors',
  license: 'MIT',
  units: 'illustrative model units',
};

const materials = {
  graphite: new MeshStandardMaterial({ name: 'Graphite housing', color: '#424b51', metalness: 0.78, roughness: 0.34 }),
  dark: new MeshStandardMaterial({ name: 'Dark steel', color: '#242b30', metalness: 0.65, roughness: 0.38 }),
  silver: new MeshStandardMaterial({ name: 'Satin aluminum', color: '#b8c4c9', metalness: 0.85, roughness: 0.27 }),
  steel: new MeshStandardMaterial({ name: 'Machined steel', color: '#77878f', metalness: 0.86, roughness: 0.30 }),
  cyan: new MeshStandardMaterial({ name: 'Cyan identification finish', color: '#83cbd4', metalness: 0.55, roughness: 0.28 }),
  black: new MeshStandardMaterial({ name: 'Elastomer feet', color: '#141a1d', metalness: 0.05, roughness: 0.74 }),
};

const groups = {};
function section(name) {
  const group = new Group();
  group.name = name;
  model.add(group);
  groups[name] = group;
  return group;
}
const housing = section('01 · Housing');
const gearing = section('02 · Planetary stage');
const output = section('03 · Output hub');
const fasteners = section('04 · Fasteners');
const mount = section('05 · Mounting cradle');

function add(parent, name, geometry, material, position = [0, 0, 0], explode = [0, 0, 0], extra = {}) {
  const mesh = new Mesh(geometry, material);
  mesh.name = name;
  mesh.position.set(...position);
  mesh.userData = {
    component: name,
    finish: material.name,
    ...extra,
    explode,
  };
  parent.add(mesh);
  return mesh;
}
function ring(outer, inner, depth, segments = 96, bevel = 0.015) {
  const shape = new Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, curveSegments: segments / 4,
    bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
function cylinder(radius, depth, segments = 64) {
  const geometry = new CylinderGeometry(radius, radius, depth, segments, 1);
  geometry.rotateX(Math.PI / 2);
  return geometry;
}
function band(radius, thickness) {
  return new TorusGeometry(radius, thickness, 8, 96);
}
function gear(teeth, rootRadius, tipRadius, bore, depth) {
  const shape = new Shape();
  const profile = [[0, rootRadius], [.17, rootRadius], [.28, tipRadius], [.65, tipRadius], [.77, rootRadius]];
  for (let tooth = 0; tooth < teeth; tooth++) {
    for (const [offset, radius] of profile) {
      const angle = (tooth + offset) * Math.PI * 2 / teeth;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;
      if (tooth === 0 && offset === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
  }
  shape.closePath();
  const hole = new Path();
  hole.absarc(0, 0, bore, 0, 2 * Math.PI, true);
  shape.holes.push(hole);
  const geometry = new ExtrudeGeometry(shape, {
    depth, steps: 1, bevelEnabled: true, bevelThickness: 0.009,
    bevelSize: 0.009, bevelSegments: 1, curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}
function roundedBox(width, height, depth, radius = .06) {
  const x = -width / 2, y = -height / 2;
  const shape = new Shape();
  shape.moveTo(x + radius, y);
  shape.lineTo(x + width - radius, y);
  shape.quadraticCurveTo(x + width, y, x + width, y + radius);
  shape.lineTo(x + width, y + height - radius);
  shape.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  shape.lineTo(x + radius, y + height);
  shape.quadraticCurveTo(x, y + height, x, y + height - radius);
  shape.lineTo(x, y + radius);
  shape.quadraticCurveTo(x, y, x + radius, y);
  const geometry = new ExtrudeGeometry(shape, { depth, bevelEnabled: true, bevelSize: .018, bevelThickness: .018, bevelSegments: 2, curveSegments: 4 });
  geometry.translate(0, 0, -depth / 2);
  return geometry;
}

// Outer casing is intentionally open toward the viewer; all internals are real geometry.
add(housing, 'Rear casing', cylinder(1.34, .43), materials.graphite, [0, 0, -.64], [0, 0, -.85]);
add(housing, 'Rear bearing cover', cylinder(.64, .14), materials.steel, [0, 0, -.93], [0, 0, -1.05]);
add(housing, 'Rear input shaft', cylinder(.23, .36), materials.silver, [0, 0, -1.14], [0, 0, -1.2]);
add(housing, 'Main casing shell', ring(1.42, 1.22, .84), materials.graphite, [0, 0, -.03], [0, 0, -.42]);
add(housing, 'Front mounting flange', ring(1.51, 1.19, .16), materials.silver, [0, 0, .47], [0, 0, .68]);
add(housing, 'Front dark trim', ring(1.465, 1.37, .025), materials.dark, [0, 0, .574], [0, 0, .68]);
add(housing, 'Front index ring', band(1.225, .018), materials.cyan, [0, 0, .58], [0, 0, .68]);
add(housing, 'Rear flange', ring(1.445, 1.19, .12), materials.steel, [0, 0, -.49], [0, 0, -.65]);
for (let i = 0; i < 4; i++) {
  add(housing, `Cooling rib ${String(i + 1).padStart(2, '0')}`, ring(1.475, 1.405, .055), materials.graphite, [0, 0, -.31 + i * .165], [0, 0, -.42]);
}
add(housing, 'Rear seal', band(1.347, .025), materials.dark, [0, 0, -.68], [0, 0, -.85]);

// Recessed carrier and three visibly distinct planetary gears.
add(gearing, 'Carrier plate', cylinder(1.16, .13), materials.dark, [0, 0, .08], [0, 0, .18]);
add(gearing, 'Inner reaction rim', ring(1.195, 1.115, .13), materials.steel, [0, 0, .275], [0, 0, .26]);
const sun = add(gearing, 'Sun gear · 18 teeth', gear(18, .325, .378, .115, .23), materials.silver, [0, 0, .355], [0, 0, .88], { teeth: 18 });
sun.rotation.z = .06;
for (let i = 0; i < 3; i++) {
  const angle = (i * 120 + 30) * Math.PI / 180;
  const x = Math.cos(angle) * .736;
  const y = Math.sin(angle) * .736;
  const displacement = [Math.cos(angle) * .42, Math.sin(angle) * .42, .69];
  const planet = add(gearing, `Planet gear ${i + 1} · 18 teeth`, gear(18, .325, .378, .116, .23), materials.steel, [x, y, .355], displacement, { teeth: 18 });
  planet.rotation.z = -angle + .1;
  add(gearing, `Planet ${i + 1} bearing race`, ring(.165, .112, .035, 48, .005), materials.silver, [x, y, .496], displacement);
  add(gearing, `Planet ${i + 1} pin`, cylinder(.104, .04, 32), materials.graphite, [x, y, .513], displacement);
  add(gearing, `Planet ${i + 1} center cap`, cylinder(.044, .012, 6), materials.cyan, [x, y, .54], displacement);
  for (let hole = 0; hole < 3; hole++) {
    const hAngle = angle + hole * Math.PI * 2 / 3;
    add(gearing, `Planet ${i + 1} recess ${hole + 1}`, cylinder(.042, .008, 20), materials.dark, [x + Math.cos(hAngle) * .245, y + Math.sin(hAngle) * .245, .479], displacement);
  }
}
add(output, 'Output hub collar', cylinder(.255, .13), materials.silver, [0, 0, .545], [0, 0, 1.05]);
add(output, 'Output hub face', cylinder(.211, .065), materials.cyan, [0, 0, .636], [0, 0, 1.08]);
add(output, 'Output socket', cylinder(.092, .006, 6), materials.dark, [0, 0, .674], [0, 0, 1.08]);
add(output, 'Hub retaining ring', band(.23, .012), materials.dark, [0, 0, .614], [0, 0, 1.05]);
for (let i = 0; i < 3; i++) {
  const angle = i * Math.PI * 2 / 3;
  add(output, `Hub screw ${i + 1}`, cylinder(.023, .012, 6), materials.silver, [Math.cos(angle) * .15, Math.sin(angle) * .15, .675], [0, 0, 1.08]);
}

for (let i = 0; i < 8; i++) {
  const angle = (i + .5) * Math.PI / 4;
  const x = Math.cos(angle) * 1.332;
  const y = Math.sin(angle) * 1.332;
  add(fasteners, `Flange washer ${String(i + 1).padStart(2, '0')}`, cylinder(.085, .018, 32), materials.dark, [x, y, .57], [0, 0, .9]);
  add(fasteners, `Flange bolt ${String(i + 1).padStart(2, '0')}`, cylinder(.061, .055, 6), materials.silver, [x, y, .605], [0, 0, .9]);
  add(fasteners, `Bolt socket ${String(i + 1).padStart(2, '0')}`, cylinder(.027, .005, 6), materials.dark, [x, y, .636], [0, 0, .9]);
}

// Compact machined base and twin supporting shoulders.
add(mount, 'Mounting bed', roundedBox(2.65, .19, 1.5, .10), materials.graphite, [0, -1.54, -.05], [0, -.55, 0]);
for (const side of [-1, 1]) {
  const suffix = side < 0 ? 'L' : 'R';
  add(mount, `Cradle shoulder ${suffix}`, roundedBox(.32, .75, .88, .07), materials.graphite, [side * .94, -1.15, -.08], [side * .32, -.4, 0]);
  add(mount, `Cradle inset ${suffix}`, roundedBox(.17, .32, .025, .03), materials.steel, [side * .94, -1.23, .38], [side * .32, -.4, 0]);
  add(mount, `Foot strip ${suffix}`, new BoxGeometry(.34, .075, 1.25), materials.black, [side * 1.0, -1.67, -.05], [0, -.64, 0]);
  for (const z of [-.54, .46]) {
    const bolt = add(mount, `Bed bolt ${suffix}${z < 0 ? ' rear' : ' front'}`, cylinder(.07, .045, 6), materials.silver, [side * 1.1, -1.414, z], [0, -.55, 0]);
    bolt.rotation.x = -Math.PI / 2;
  }
}
add(mount, 'Identification inset', roundedBox(.52, .075, .018, .012), materials.cyan, [0, -1.54, .719], [0, -.55, 0]);

model.updateMatrixWorld(true);
let meshCount = 0;
let triangles = 0;
const geometrySet = new Set();
model.traverse((object) => {
  if (!object.isMesh) return;
  meshCount++;
  triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
  geometrySet.add(object.geometry);
});
const size = new Box3().setFromObject(model).getSize(new Vector3());
const exporter = new GLTFExporter();
const binary = await exporter.parseAsync(model, { binary: true, onlyVisible: false });
if (!(binary instanceof ArrayBuffer)) throw new Error('Expected GLB ArrayBuffer');
await mkdir(new URL('../public/models/', import.meta.url), { recursive: true });
await writeFile(new URL('../public/models/orbital-drive.glb', import.meta.url), Buffer.from(binary));
console.log(JSON.stringify({
  file: 'public/models/orbital-drive.glb',
  bytes: binary.byteLength,
  meshes: meshCount,
  triangles,
  materials: Object.keys(materials).length,
  dimensions: size.toArray().map((v) => Number(v.toFixed(3))),
}, null, 2));
for (const geometry of geometrySet) geometry.dispose();
for (const material of Object.values(materials)) material.dispose();

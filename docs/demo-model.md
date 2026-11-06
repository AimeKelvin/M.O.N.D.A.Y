# Orbital drive OD–01

The bundled `public/models/orbital-drive.glb` is an original procedural planetary-drive study authored for MONDAY. It contains a housing, three planet gears and a sun gear, an output hub, flange fasteners, and a mounting cradle. The exposed front makes the separate components easy to inspect.

This is an illustrative mechanical assembly, **not** a manufacturing model, simulation, or verified gear train. Names, tooth counts, finish labels, and metadata were assigned by the model author. MONDAY does not infer their semantic meaning or material composition.

## Source and license

- Source: [`scripts/generate-demo.mjs`](../scripts/generate-demo.mjs), in this repository.
- Copyright: MONDAY contributors.
- License: [MIT](../LICENSE), covering the source generator and generated GLB.
- No third-party meshes, textures, fonts, or online model-library assets are included.
- Three.js, which generates and exports the geometry, is separately MIT licensed.

Regenerate using `node scripts/generate-demo.mjs` after installing dependencies. The generator uses `GLTFExporter` and a small Node `FileReader` compatibility shim. It exports actual binary glTF geometry and physically based materials; no screenshot or prerecorded rendering is used.

## Exploded view

Every mesh has `userData.explode`, a three-number displacement in its parent's local coordinates. For an explosion amount `t` between zero and one, set its local position to `originalPosition + t × explode`. Store the original position before changing it, and always calculate from that position rather than accumulating deltas. All mesh parents are identity transforms in the exported study. The viewer's normalization transform must enclose the entire scene so the displacements scale with the assembly.

Only the prepared demo has authored separation directions. The offsets are an inspection aid, not physical disassembly instructions. Do not infer offsets for arbitrary user models.

The model's source coordinates are illustrative units. Bounding-box dimensions should be labelled model units, not millimeters or meters.

## Generated asset

The checked-in GLB contains 80 named meshes, 26,100 triangles, and six materials in 2,090,824 bytes. Its source bounds are approximately 3.050 × 3.233 × 2.066 model units. These values were measured from the exported file using Three.js `GLTFLoader`, including verification that all 80 separation vectors survive export and import.

The exposed gear stage faces the positive Z axis. A camera with positive X, Y, and Z coordinates shows both the gear stage and the casing ribs.

import { MathUtils, PerspectiveCamera, Quaternion, Raycaster, Vector2, Vector3 } from 'three';
import type { OrbitControls } from 'three-stdlib';
import type { PreparedModel } from '../../features/model-import/model';
import type { GestureOutput } from '../../types/tracking';
const right = new Vector3(), up = new Vector3(), offset = new Vector3(), axis = new Vector3(), rotation = new Quaternion();
const pointer = new Vector2(); const raycaster = new Raycaster();
export const MIN_DISTANCE = 2.6, MAX_DISTANCE = 28;
export function applyInteraction(intent: GestureOutput, model: PreparedModel, camera: PerspectiveCamera, controls: OrbitControls): string | null | undefined {
  if (intent.gesture === 'rotate') {
    axis.set(0,1,0).applyQuaternion(camera.quaternion); rotation.setFromAxisAngle(axis, intent.dx * 5); model.root.quaternion.premultiply(rotation);
    axis.set(1,0,0).applyQuaternion(camera.quaternion); rotation.setFromAxisAngle(axis, intent.dy * 5); model.root.quaternion.premultiply(rotation);
  }
  if (intent.gesture === 'move') {
    const distance = camera.position.distanceTo(controls.target);
    const height = 2 * Math.tan(MathUtils.degToRad(camera.fov) / 2) * distance;
    right.set(1,0,0).applyQuaternion(camera.quaternion).multiplyScalar(intent.dx * height * camera.aspect);
    up.set(0,1,0).applyQuaternion(camera.quaternion).multiplyScalar(-intent.dy * height);
    model.root.position.add(right).add(up).clampLength(0, 6);
  }
  if (intent.gesture === 'zoom') {
    offset.copy(camera.position).sub(controls.target);
    const distance = MathUtils.clamp(offset.length() * Math.exp(-intent.zoom * 1.8), MIN_DISTANCE, MAX_DISTANCE);
    camera.position.copy(controls.target).add(offset.setLength(distance)); controls.update();
  }
  if (intent.gesture === 'inspect' && intent.pointer) {
    pointer.set(intent.pointer.x * 2 - 1, 1 - intent.pointer.y * 2); model.root.updateMatrixWorld(true);
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObject(model.scene, true).find(item => { let object: typeof item.object | null = item.object; while (object) { if (!object.visible) return false; object = object.parent; } return true; });
    return hit?.object.uuid ?? null;
  }
}

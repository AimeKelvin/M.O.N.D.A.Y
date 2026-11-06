import {describe,it,expect} from 'vitest';
import {BoxGeometry,Group,Mesh,MeshStandardMaterial,PerspectiveCamera,Vector3} from 'three';
import type {OrbitControls} from 'three-stdlib';
import {applyInteraction,MAX_DISTANCE,MIN_DISTANCE} from './controller';
import {prepareModel,disposeModel} from '../../features/model-import/model';
import {neutralOutput} from '../gestures/GestureRecognizer';
it('maps intent to rotation, camera-plane translation, and bounded zoom',()=>{
 const scene=new Group();scene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));const model=prepareModel(scene,'test',1);const camera=new PerspectiveCamera(45,1,0.1,100);camera.position.z=8;camera.updateMatrixWorld();const controls={target:new Vector3(),update:()=>{}} as unknown as OrbitControls;
 const intent=neutralOutput();applyInteraction({...intent,gesture:'rotate',dx:0.1},model,camera,controls);expect(model.root.quaternion.y).not.toBe(0);
 applyInteraction({...intent,gesture:'move',dx:0.1,dy:-0.1},model,camera,controls);expect(model.root.position.x).toBeGreaterThan(0);expect(model.root.position.y).toBeGreaterThan(0);
 for(let i=0;i<100;i++)applyInteraction({...intent,gesture:'zoom',zoom:0.1},model,camera,controls);expect(camera.position.length()).toBeCloseTo(MIN_DISTANCE);
 for(let i=0;i<100;i++)applyInteraction({...intent,gesture:'zoom',zoom:-0.1},model,camera,controls);expect(camera.position.length()).toBeCloseTo(MAX_DISTANCE);disposeModel(model.root);
});
describe('neutral interaction',()=>{it('cannot transform an object',()=>{const scene=new Group();scene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial()));const m=prepareModel(scene,'test',1);const camera=new PerspectiveCamera();const controls={target:new Vector3(),update:()=>{}} as unknown as OrbitControls;applyInteraction({...neutralOutput(),dx:1,dy:1,zoom:1},m,camera,controls);expect(m.root.position.length()).toBe(0);expect(m.root.quaternion.w).toBe(1);disposeModel(m.root);});});

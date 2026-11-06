import { describe,expect,it,vi } from 'vitest';
import { BoxGeometry, Group, Mesh, MeshStandardMaterial, Texture, Box3, Vector3 } from 'three';
import { prepareModel,resetTransform,disposeModel,applyExplode } from './model';
import { preflight,safePath,validateFiles } from './validation';
const json = (data:unknown) => new TextEncoder().encode(JSON.stringify(data)).buffer;
const base = {asset:{version:'2.0'},nodes:[],meshes:[]};
describe('untrusted file validation', () => {
  it('requires exactly one nonempty supported entry point', () => {expect(()=>validateFiles([])).toThrow();expect(()=>validateFiles([new File(['x'],'model.obj')])).toThrow('Unsupported');expect(()=>validateFiles([new File([],'model.glb')])).toThrow('empty');expect(()=>validateFiles([new File(['x'],'one.glb'),new File(['y'],'two.gltf')])).toThrow('one model');});
  it('accepts a dependency set', () => {const model=new File(['{}'],'model.gltf');expect(validateFiles([model,new File(['x'],'data.bin')])).toBe(model);});
  it('rejects invalid JSON, invalid GLB, and invalid asset versions', () => {expect(()=>preflight(new ArrayBuffer(8),true)).toThrow('valid');expect(()=>preflight(new TextEncoder().encode('oops').buffer,false)).toThrow('valid');expect(()=>preflight(json({asset:{version:'1.0'}}),false)).toThrow('2.0');});
  it('blocks URLs, traversal, and unsafe data images', () => {for(const path of ['https://example.com/a.bin','//example.com/a','../a','..%2Fa','file:///a','data:text/html;base64,eA==']) expect(()=>safePath(path)).toThrow();expect(()=>preflight(json({...base,images:[{uri:'data:image/svg+xml;base64,AAAA'}]}),false)).toThrow('Unsupported');});
  it('recognizes safe dependencies without requesting anything', () => {expect(preflight(json({...base,buffers:[{byteLength:12,uri:'mesh.bin'}],images:[{uri:'textures/albedo.png'}]}),false).uris).toEqual(['mesh.bin','textures/albedo.png']);});
  it('limits excessive geometry and unsupported compression before decoding', () => {expect(()=>preflight(json({...base,accessors:[{count:1e12}]}),false)).toThrow('excessive');expect(()=>preflight(json({...base,extensionsRequired:['KHR_draco_mesh_compression']}),false)).toThrow('Compressed');});
});
describe('model lifecycle', () => {
  it('centers and uniformly scales without changing aspect ratio', () => {const scene=new Group();const mesh=new Mesh(new BoxGeometry(4,2,1),new MeshStandardMaterial());mesh.position.set(10,12,-3);scene.add(mesh);const model=prepareModel(scene,'box',10);model.root.updateMatrixWorld(true);const box=new Box3().setFromObject(model.root);const size=box.getSize(new Vector3());expect(box.getCenter(new Vector3()).length()).toBeLessThan(1e-6);expect(size.x).toBeCloseTo(3.8);expect(size.x/size.y).toBeCloseTo(2);expect(model.dimensions).toEqual([4,2,1]);disposeModel(model.root);});
  it('resets transforms and returns exploded parts to their original positions', () => {const scene=new Group();const mesh=new Mesh(new BoxGeometry(),new MeshStandardMaterial());mesh.position.x=2;mesh.userData.explode=[1,0,0];scene.add(mesh);const model=prepareModel(scene,'demo',1,true);model.root.position.set(2,3,4);model.root.rotation.y=1;applyExplode(model,1);expect(mesh.position.x).toBe(3);applyExplode(model,0);resetTransform(model);expect(mesh.position.x).toBe(2);expect(model.root.position.length()).toBe(0);expect(model.root.quaternion.w).toBe(1);disposeModel(model.root);});
  it('disposes shared GPU resources once', () => {const texture=new Texture();const material=new MeshStandardMaterial({map:texture});const geometry=new BoxGeometry();const root=new Group();root.add(new Mesh(geometry,material),new Mesh(geometry,material));const t=vi.spyOn(texture,'dispose'),m=vi.spyOn(material,'dispose'),g=vi.spyOn(geometry,'dispose');disposeModel(root);expect(t).toHaveBeenCalledTimes(1);expect(m).toHaveBeenCalledTimes(1);expect(g).toHaveBeenCalledTimes(1);});
  it('rejects empty geometry and oversized textures', () => {expect(()=>prepareModel(new Group(),'empty',0)).toThrow('geometry');const scene=new Group();scene.add(new Mesh(new BoxGeometry(),new MeshStandardMaterial({map:new Texture({width:10000,height:20})})));expect(()=>prepareModel(scene,'big',1)).toThrow('8,192');disposeModel(scene);});
});
it('rejects cyclic, reused, and excessive-depth node trees',()=>{
 expect(()=>preflight(json({...base,nodes:[{children:[1]},{children:[0]}]}),false)).toThrow('cyclic');
 expect(()=>preflight(json({...base,nodes:[{children:[2]},{children:[2]},{}]}),false)).toThrow('invalid hierarchy');
 const nodes=Array.from({length:140},(_,i)=>i===0?{}:{children:[i-1]});
 expect(()=>preflight(json({...base,nodes}),false)).toThrow('too deep');
});

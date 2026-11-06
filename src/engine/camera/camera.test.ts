import {describe,expect,it,vi,afterEach} from 'vitest';
import {cameraError,requestCamera,stopStream} from './camera';
afterEach(()=>vi.unstubAllGlobals());
describe('camera access and cleanup',()=>{
  it('requests video only after an explicit request and never requests audio', async()=>{const getUserMedia=vi.fn().mockResolvedValue({});vi.stubGlobal('isSecureContext',true);vi.stubGlobal('navigator',{mediaDevices:{getUserMedia}});expect(getUserMedia).not.toHaveBeenCalled();await requestCamera();expect(getUserMedia).toHaveBeenCalledWith(expect.objectContaining({audio:false,video:expect.any(Object)}));});
  it('stops every track',()=>{const stop=vi.fn();stopStream({getTracks:()=>[{stop},{stop}]} as unknown as MediaStream);expect(stop).toHaveBeenCalledTimes(2);stopStream(null);});
  it('explains denied permissions, missing and busy cameras',()=>{expect(cameraError(new DOMException('','NotAllowedError'))).toContain('permission');expect(cameraError(new DOMException('','NotFoundError'))).toContain('No camera');expect(cameraError(new DOMException('','NotReadableError'))).toContain('in use');});
  it('rejects insecure contexts before requesting media',async()=>{vi.stubGlobal('isSecureContext',false);await expect(requestCamera()).rejects.toMatchObject({name:'SecurityError'});});
});

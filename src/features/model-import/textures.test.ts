import {expect,it} from 'vitest';
import {textureDimensions} from './textures';
const png=(w:number,h:number)=>{const b=new Uint8Array(32);const v=new DataView(b.buffer);v.setUint32(0,0x89504e47);v.setUint32(4,0x0d0a1a0a);v.setUint32(16,w);v.setUint32(20,h);return b;};
it('reads texture dimensions before decoding and rejects oversized PNG images',()=>{expect(textureDimensions(png(512,256))).toEqual([512,256]);expect(()=>textureDimensions(png(32000,32000))).toThrow('8,192');expect(()=>textureDimensions(png(0,512))).toThrow('invalid');});
it('rejects unsupported or malformed images',()=>{expect(()=>textureDimensions(new Uint8Array([1,2,3]))).toThrow('image header');});
it('reads JPEG and WebP dimensions',()=>{const jpeg=new Uint8Array([255,216,255,192,0,17,8,0,128,1,0,3,1,17,0,2,17,0,3,17,0]);expect(textureDimensions(jpeg)).toEqual([256,128]);const webp=new Uint8Array(30);webp.set(new TextEncoder().encode('RIFF'),0);webp.set(new TextEncoder().encode('WEBPVP8X'),8);webp[24]=255;webp[27]=127;expect(textureDimensions(webp)).toEqual([256,128]);});

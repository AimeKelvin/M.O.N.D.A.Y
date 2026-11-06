import { LIMITS, ModelError } from './validation';
/** Read dimensions before browser image decoding to reject decompression bombs. */
export function textureDimensions(bytes: Uint8Array): [number, number] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (a:number,b:number) => String.fromCharCode(...bytes.subarray(a,b));
  let size: [number,number] | null = null;
  if (bytes.length >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a) size = [view.getUint32(16), view.getUint32(20)];
  else if (bytes.length >= 30 && text(0,4) === 'RIFF' && text(8,12) === 'WEBP') {
    if (text(12,16) === 'VP8X') size = [1 + bytes[24] + (bytes[25]<<8) + (bytes[26]<<16), 1 + bytes[27] + (bytes[28]<<8) + (bytes[29]<<16)];
    if (text(12,16) === 'VP8 ' && bytes[23] === 0x9d && bytes[24] === 1 && bytes[25] === 0x2a) size = [view.getUint16(26,true)&0x3fff,view.getUint16(28,true)&0x3fff];
    if (text(12,16) === 'VP8L' && bytes[20] === 0x2f) size = [1 + bytes[21] + ((bytes[22]&0x3f)<<8), 1 + (bytes[22]>>6) + (bytes[23]<<2) + ((bytes[24]&0xf)<<10)];
  } else if (bytes[0] === 0xff && bytes[1] === 0xd8) {
    let offset = 2;
    while (offset + 8 < bytes.length) {
      if (bytes[offset++] !== 0xff) break;
      while (bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) break;
      if (marker === 1 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 7 > bytes.length) break;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) break;
      if ([0xc0,0xc1,0xc2,0xc3,0xc5,0xc6,0xc7,0xc9,0xca,0xcb,0xcd,0xce,0xcf].includes(marker)) { size = [view.getUint16(offset+5),view.getUint16(offset+3)]; break; }
      offset += length;
    }
  }
  if (!size || size.some(v=>v<=0)) throw new ModelError('A texture has an invalid or unsupported image header. Use PNG, JPEG, or WebP textures.');
  if (size.some(v=>v>LIMITS.textureSize)) throw new ModelError('A texture is larger than 8,192 pixels. Resize the model’s textures.');
  return size;
}
export async function validateTextures(json: Record<string,unknown>, modelData:ArrayBuffer, binary:boolean, resolve:(uri:string)=>File|undefined) {
  const images = (json.images ?? []) as Record<string,unknown>[];
  if (!images.length) return;
  const buffers = (json.buffers ?? []) as Record<string,unknown>[];
  const views = (json.bufferViews ?? []) as Record<string,unknown>[];
  const loaded = new Map<number,Uint8Array>();
  const decode = (uri:string) => Uint8Array.from(atob(uri.slice(uri.indexOf(',')+1)), c=>c.charCodeAt(0));
  const loadBuffer = async (index:number):Promise<Uint8Array> => {
    const cached = loaded.get(index); if (cached) return cached;
    const definition = buffers[index]; if (!definition) throw new ModelError('A texture references a missing model buffer.');
    let bytes:Uint8Array;
    if (typeof definition.uri === 'string') {
      if (definition.uri.startsWith('data:')) bytes = decode(definition.uri);
      else { const file=resolve(definition.uri);if(!file)throw new ModelError('A texture buffer is missing.');bytes=new Uint8Array(await file.arrayBuffer()); }
    } else {
      if (!binary || index !== 0) throw new ModelError('A texture buffer is missing.');
      const view = new DataView(modelData); const offset = 20 + view.getUint32(12,true);
      if (offset + 8 > modelData.byteLength || view.getUint32(offset+4,true) !== 0x004e4942 || offset+8+view.getUint32(offset,true)>modelData.byteLength) throw new ModelError('The model contains an invalid binary image buffer.');
      bytes = new Uint8Array(modelData,offset+8,view.getUint32(offset,true));
    }
    loaded.set(index,bytes); return bytes;
  };
  let pixels=0;
  for (const image of images) {
    let bytes:Uint8Array;
    if (typeof image.uri === 'string') {
      if (image.uri.startsWith('data:')) bytes=decode(image.uri);
      else { const file=resolve(image.uri);if(!file)throw new ModelError('A texture file is missing.');bytes=new Uint8Array(await file.arrayBuffer()); }
    } else {
      const view = views[Number(image.bufferView)]; if(!view)throw new ModelError('A texture references an invalid buffer view.');
      const buffer=await loadBuffer(Number(view.buffer)); const start=Number(view.byteOffset??0),length=Number(view.byteLength);
      if(!Number.isSafeInteger(start)||!Number.isSafeInteger(length)||start<0||length<1||start+length>buffer.length)throw new ModelError('A texture references an invalid buffer range.');
      bytes=buffer.subarray(start,start+length);
    }
    const [w,h]=textureDimensions(bytes);pixels+=w*h;
    if(pixels>LIMITS.texturePixels)throw new ModelError('Model textures exceed the 64 megapixel budget. Reduce texture resolution.');
  }
}

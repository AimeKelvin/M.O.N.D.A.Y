import type { TrackedHand, TrackingFrame } from '../types/tracking';
export function hand(pose:'open'|'pinch'|'point'|'neutral' = 'open', offset = 0, handedness:'Left'|'Right' = 'Right', pinch = 0.18): TrackedHand {
  const p = Array.from({length:21}, () => ({x:0.5+offset,y:0.7,z:0}));
  p[0]={x:0.5+offset,y:0.85,z:0};
  p[1]={x:0.43+offset,y:0.8,z:0}; p[2]={x:0.35+offset,y:0.73,z:0}; p[3]={x:0.29+offset,y:0.65,z:0}; p[4]={x:0.23+offset,y:0.58,z:0};
  [0.39,0.5,0.58,0.65].forEach((x,finger) => {
    const base=5+finger*4; const folded=pose==='neutral' || (pose==='point' && finger>0);
    [0.62,0.48,folded?0.59:0.37,folded?0.72:0.28].forEach((y,j) => {p[base+j]={x:x+offset,y,z:0};});
  });
  if (pose==='pinch') p[4]={...p[8],x:p[8].x+pinch*0.23};
  return {landmarks:p,handedness,handednessScore:0.95};
}
export function frame(timestamp:number,...hands:TrackedHand[]): TrackingFrame {return {hands,timestamp,inferenceMs:10};}

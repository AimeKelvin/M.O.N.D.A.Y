import { create } from 'zustand';
import type { Gesture, GestureSettings, TrackingStatus } from '../types/tracking';
import type { PreparedModel } from '../features/model-import/model';
export type Tool = Exclude<Gesture, 'neutral'>;
interface Workspace {
  model: PreparedModel | null;
  loading: string | null;
  error: string | null;
  selected: string | null;
  hidden: string[];
  tool: Tool;
  theme: 'dark' | 'light';
  wireframe: boolean;
  grid: boolean;
  exploded: number;
  resetVersion: number;
  cameraResetVersion: number;
  settings: GestureSettings;
  landmarks: boolean;
  preview: boolean;
  tracking: TrackingStatus;
  dialog: 'settings' | 'guide' | 'calibrate' | null;
  setModel: (model: PreparedModel) => void;
  select: (id: string | null) => void;
  toggleVisibility: (id: string) => void;
  reset: () => void;
  resetCamera: () => void;
  set: (patch: Partial<Workspace>) => void;
}
export const initialTracking: TrackingStatus = {
  camera: 'off',
  hands: 0,
  gesture: 'neutral',
  pending: 'neutral',
  inferenceMs: 0,
  fps: 0,
  backend: null,
  error: null,
};
function savedTheme(): 'dark' | 'light' {
  try {
    return localStorage.getItem('monday-theme') === 'light' ? 'light' : 'dark';
  } catch {
    return 'dark';
  }
}
export const useWorkspace = create<Workspace>((set) => ({
  theme: savedTheme(),
  model: null,
  loading: 'Opening demonstration model…',
  error: null,
  selected: null,
  hidden: [],
  tool: 'rotate',
  wireframe: false,
  grid: true,
  exploded: 0,
  resetVersion: 0,
  cameraResetVersion: 0,
  settings: { sensitivity: 1, smoothing: 0.4 },
  landmarks: true,
  preview: true,
  tracking: initialTracking,
  dialog: null,
  setModel: (model) =>
    set((s) => ({
      model,
      selected: null,
      hidden: [],
      error: null,
      loading: null,
      exploded: 0,
      wireframe: false,
      resetVersion: s.resetVersion + 1,
    })),
  select: (selected) => set({ selected }),
  toggleVisibility: (id) =>
    set((s) => ({
      hidden: s.hidden.includes(id) ? s.hidden.filter((v) => v !== id) : [...s.hidden, id],
    })),
  reset: () =>
    set((s) => ({
      resetVersion: s.resetVersion + 1,
      hidden: [],
      exploded: 0,
      selected: null,
      wireframe: false,
    })),
  resetCamera: () => set((s) => ({ cameraResetVersion: s.cameraResetVersion + 1 })),
  set: (patch) => set(patch),
}));

export function cameraError(error: unknown): string {
  const name = error instanceof Error || error instanceof DOMException ? error.name : '';
  switch (name) {
    case 'NotAllowedError':
    case 'PermissionDeniedError':
      return 'Camera permission was denied. Allow camera access in your browser’s site settings, then try again.';
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera found. Connect a webcam and try again. Mouse controls are always available.';
    case 'NotReadableError':
    case 'TrackStartError':
      return 'The camera is unavailable or in use. Close other camera apps and try again.';
    case 'OverconstrainedError':
      return 'This camera cannot provide a supported video stream. Try a different camera.';
    case 'SecurityError':
      return 'Camera access is blocked. Open MONDAY over HTTPS or on localhost.';
    default:
      return 'Could not start the camera. Check its connection and browser permissions, then try again.';
  }
}
export async function requestCamera(): Promise<MediaStream> {
  if (!window.isSecureContext) throw new DOMException('Secure context required', 'SecurityError');
  if (!navigator.mediaDevices?.getUserMedia)
    throw new Error(
      'Your browser does not support camera access. Try a current desktop Chrome, Edge, Firefox, or Safari.',
    );
  return navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      width: { ideal: 640 },
      height: { ideal: 480 },
      frameRate: { ideal: 30, max: 30 },
      facingMode: 'user',
    },
  });
}
export function stopStream(stream: MediaStream | null) {
  stream?.getTracks().forEach((track) => track.stop());
}

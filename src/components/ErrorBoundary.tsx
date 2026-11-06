import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';
export class ErrorBoundary extends Component<{children: ReactNode; message?: string}, {failed: boolean}> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  componentDidCatch(error: Error, info: ErrorInfo) { console.error('Workspace error', error, info.componentStack); }
  render() { return this.state.failed ? <div className="viewport-failure" role="alert"><strong>{this.props.message ?? 'The workspace encountered an error.'}</strong><p>Reload the workspace to recover. Your local files remain on your device.</p><button className="button" onClick={() => location.reload()}>Reload workspace</button></div> : this.props.children; }
}

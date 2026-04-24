import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // In production, send to an error tracking service (e.g. Sentry)
    if (import.meta.env.DEV) {
      console.error('ErrorBoundary caught:', error, info.componentStack);
    }
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'Inter, system-ui, sans-serif', padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 16 }}>⚠️</div>
          <h2 style={{ color: '#1a1a1a', margin: '0 0 8px' }}>Something went wrong</h2>
          <p style={{ color: '#666', margin: '0 0 24px', maxWidth: 400, lineHeight: 1.6 }}>
            An unexpected error occurred. Please refresh the page or go back to the home page.
          </p>
          {import.meta.env.DEV && this.state.error && (
            <pre style={{ background: '#f3f4f6', padding: '12px 16px', borderRadius: 8, fontSize: 12, textAlign: 'left', maxWidth: '100%', overflow: 'auto', color: '#dc2626', marginBottom: 24 }}>
              {this.state.error.message}
            </pre>
          )}
          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => window.location.reload()}
              style={{ padding: '10px 22px', background: '#ff6b35', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontWeight: 700, fontSize: 14 }}
            >
              Refresh Page
            </button>
            <button
              onClick={() => { this.setState({ hasError: false, error: null }); window.location.href = '/'; }}
              style={{ padding: '10px 22px', background: '#fff', color: '#555', border: '1px solid #ddd', borderRadius: 10, cursor: 'pointer', fontSize: 14 }}
            >
              Go Home
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;

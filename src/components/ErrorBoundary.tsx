import React from 'react';

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || 'An unexpected application error occurred.',
    };
  }

  render() {
    if (this.state.hasError) {
      let displayMessage = this.state.message;
      try {
        const parsed = JSON.parse(this.state.message);
        if (parsed && typeof parsed.error === 'string') {
          displayMessage = `${parsed.error} (${parsed.operationType || 'operation'} on ${parsed.path || 'workspace'})`;
        }
      } catch {
        // Not a JSON Firestore error
      }

      return (
        <div className="min-h-screen bg-[#fdfaf3] flex items-center justify-center p-6">
          <div className="max-w-lg w-full bg-white border-[1.5px] border-[#1a2e2a] rounded-xl p-8 shadow-[6px_6px_0_#1a2e2a]">
            <p className="font-mono text-xs uppercase tracking-widest text-[#d44c3c] mb-2">
              Workspace Error
            </p>
            <h1 className="font-display text-2xl font-extrabold uppercase text-[#1a2e2a] mb-3">
              Unable to complete operation
            </h1>
            <p className="text-sm text-[#1a2e2a]/80 leading-relaxed mb-6 break-words">
              {displayMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn-cta px-5 py-2.5 text-xs rounded-md"
            >
              Reload Workspace
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

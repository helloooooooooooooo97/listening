import { Component, type ReactNode } from 'react';
import { HiExclamationTriangle } from 'react-icons/hi2';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="h-screen flex items-center justify-center bg-[var(--bg-primary)]">
          <div className="text-center px-8 animate-scale-in">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4" style={{ background: 'linear-gradient(135deg, #ef4444, #dc2626)' }}>
              <HiExclamationTriangle size={32} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-primary mb-2">出了点问题</h1>
            <p className="text-tertiary text-sm mb-6 max-w-md">
              {this.state.error?.message || '应用遇到了意外错误'}
            </p>
            <button
              onClick={() => {
                this.setState({ hasError: false, error: null });
                window.location.reload();
              }}
              className="px-6 py-2.5 bg-[#fa2d48] hover:bg-[var(--accent-hover)] text-primary font-semibold rounded-full text-sm transition-colors cursor-pointer"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

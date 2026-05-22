import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private goHome = () => {
    window.location.href = '/dashboard';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[400px] w-full flex items-center justify-center p-6">
          <div className="max-w-md w-full bg-white dark:bg-slate-900 rounded-[2.5rem] p-8 sm:p-12 shadow-2xl border border-slate-100 dark:border-slate-800 text-center space-y-6 animate-in fade-in zoom-in-95 duration-300">
            <div className="inline-flex p-4 bg-red-50 dark:bg-red-500/10 rounded-3xl text-red-600 mb-2">
              <AlertTriangle size={40} />
            </div>
            
            <div className="space-y-2">
              <h2 className="text-2xl font-black text-slate-900 dark:text-slate-100 tracking-tight italic">
                System Glitch
              </h2>
              <p className="text-sm font-bold text-slate-500 dark:text-slate-400">
                Something went wrong while rendering this section. Our team has been notified.
              </p>
            </div>

            <div className="flex flex-col gap-3 pt-4">
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center gap-2 w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 font-black rounded-2xl shadow-xl transition-all hover:scale-[1.02] active:scale-[0.98]"
              >
                <RefreshCw size={18} />
                Refresh Page
              </button>
              <button
                onClick={this.goHome}
                className="flex items-center justify-center gap-2 w-full py-4 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black rounded-2xl transition-all hover:bg-slate-200 dark:hover:bg-slate-700"
              >
                <Home size={18} />
                Return to Safety
              </button>
            </div>

            {import.meta.env.DEV && (
              <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl text-left overflow-auto max-h-32">
                <p className="text-[10px] font-mono text-red-500 dark:text-red-400 break-all leading-tight">
                  {this.state.error?.toString()}
                </p>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;

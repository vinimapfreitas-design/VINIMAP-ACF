import React, { Component, ErrorInfo, ReactNode } from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ViniMap ErrorBoundary] Erro capturado na renderização:', error, errorInfo);
  }

  handleReset = () => {
    try {
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistrations().then(regs => {
          regs.forEach(r => r.unregister());
        });
      }
      if ('caches' in window) {
        caches.keys().then(names => {
          names.forEach(n => caches.delete(n));
        });
      }
      sessionStorage.clear();
    } catch (_) {}
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 text-slate-100 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-slate-800 border border-slate-700 rounded-3xl p-6 sm:p-8 shadow-2xl text-center space-y-5">
            <div className="w-16 h-16 mx-auto bg-amber-500/20 text-amber-400 rounded-2xl flex items-center justify-center border border-amber-500/30 text-2xl font-black">
              ⚠️
            </div>
            <div className="space-y-2">
              <h1 className="text-xl font-black tracking-tight text-white">
                Recuperação do Sistema ViniMap
              </h1>
              <p className="text-xs text-slate-300 leading-relaxed">
                Foi detectada uma atualização recente ou inconsistência transitória no carregamento dos módulos do sistema.
              </p>
            </div>

            {this.state.error && (
              <div className="text-left bg-slate-950/80 p-3 rounded-xl border border-slate-800 text-[11px] font-mono text-rose-300 max-h-32 overflow-auto">
                {this.state.error.message || String(this.state.error)}
              </div>
            )}

            <div className="pt-2 flex flex-col sm:flex-row gap-2.5">
              <button
                onClick={this.handleReset}
                className="flex-1 py-3 px-4 bg-blue-600 hover:bg-blue-500 text-white font-extrabold text-xs rounded-xl shadow-lg transition-all cursor-pointer"
              >
                Recarregar e Atualizar Sistema
              </button>
              <button
                onClick={() => {
                  window.location.href = '/';
                }}
                className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-slate-200 font-extrabold text-xs rounded-xl transition-all cursor-pointer"
              >
                Início
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);

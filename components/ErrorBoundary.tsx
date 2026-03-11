
import React from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('ErrorBoundary caught an error', error, errorInfo);
  }

  handleReset = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 font-sans">
          <div className="max-w-md w-full bg-white rounded-[2.5rem] shadow-2xl border border-slate-100 p-10 text-center">
            <div className="w-20 h-20 bg-rose-100 text-rose-500 rounded-3xl flex items-center justify-center mx-auto mb-8">
              <AlertTriangle size={40} />
            </div>
            
            <h1 className="text-2xl font-black text-slate-800 mb-4 tracking-tight">
              Oops! Terjadi kesalahan tak terduga.
            </h1>
            
            <p className="text-slate-500 mb-10 leading-relaxed">
              Aplikasi mengalami kendala teknis. Jangan khawatir, data Anda tetap aman. Silakan coba muat ulang halaman.
            </p>

            <div className="space-y-3">
              <button
                onClick={this.handleReset}
                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-200 hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
              >
                <RefreshCw size={20} />
                Coba Lagi
              </button>
              
              <button
                onClick={this.handleGoHome}
                className="w-full py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
              >
                <Home size={20} />
                Kembali ke Beranda
              </button>
            </div>

            {process.env.NODE_ENV === 'development' && this.state.error && (
              <div className="mt-8 p-4 bg-slate-100 rounded-xl text-left overflow-auto max-h-40">
                <p className="text-[10px] font-mono text-slate-500 whitespace-pre-wrap">
                  {this.state.error.toString()}
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

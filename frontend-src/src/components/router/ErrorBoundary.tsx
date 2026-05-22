import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertOctagon, RotateCcw, Home } from 'lucide-react';

interface Props { children?: ReactNode; }
interface State { hasError: boolean; errorMsg: string; }

export default class GlobalErrorBoundary extends Component<Props, State> {
  public state: State = { hasError: false, errorMsg: '' };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMsg: error.message };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught rendering error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-screen w-full flex-col items-center justify-center bg-[#050505] p-6 text-center">
          <AlertOctagon size={48} className="mb-4 text-red-500" />
          <h1 className="mb-2 text-2xl font-bold text-white">渲染组件时发生崩溃</h1>
          <p className="max-w-lg text-sm text-red-300/80 font-mono break-words bg-red-500/10 p-4 rounded-xl border border-red-500/20">
            {this.state.errorMsg}
          </p>
          <div className="mt-6 flex items-center gap-4">
            <button
              className="flex items-center gap-2 rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white hover:bg-white/20 transition-all border border-white/5"
              onClick={() => {
                this.setState({ hasError: false, errorMsg: '' });
                window.location.hash = '#/';
              }}
            >
              <Home size={16} /> 返回灵感枢纽
            </button>
            <button
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-500 transition-all shadow-[0_0_15px_rgba(99,102,241,0.2)]"
              onClick={() => window.location.reload()}
            >
              <RotateCcw size={16} /> 重新加载
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

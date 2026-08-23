import { Component, type ErrorInfo, type ReactNode } from 'react';

interface AppErrorBoundaryProps {
  children: ReactNode;
}

interface AppErrorBoundaryState {
  failed: boolean;
}

export class AppErrorBoundary extends Component<AppErrorBoundaryProps, AppErrorBoundaryState> {
  state: AppErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): AppErrorBoundaryState {
    return { failed: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unhandled React rendering error', {
      error: error.name,
      componentStack: info.componentStack,
    });
  }

  render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="grid min-h-screen place-items-center bg-slate-50 px-6 py-12 text-slate-950">
        <section className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/50">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-teal-700">Protocap</p>
          <h1 className="mt-3 text-2xl font-black tracking-tight">L’interface a rencontré une erreur.</h1>
          <p className="mt-3 text-sm font-medium leading-6 text-slate-600">
            Recharge la page pour reconstruire l’interface à partir de l’état disponible.
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-5 text-sm font-black text-white transition hover:bg-slate-800 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-teal-700/20"
          >
            Recharger l’application
          </button>
        </section>
      </main>
    );
  }
}

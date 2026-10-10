import { Component, type ErrorInfo, type ReactNode } from 'react';
import { IconAlert } from './icons';

type Props = {
  children: ReactNode;
  /** Render inside the console shell (compact) instead of full screen. */
  inline?: boolean;
};

type State = { error: Error | null };

/** Catches render errors so one broken page does not blank the whole console. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Console crashed', error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const panel = (
      <div className="w-full max-w-md bg-white border border-[var(--line)] rounded-xl p-6 shadow-[var(--shadow)] text-center">
        <span className="mx-auto mb-4 inline-flex size-11 items-center justify-center rounded-full bg-[#fef3f2] text-[var(--danger)]">
          <IconAlert className="size-5" />
        </span>
        <h1 className="text-lg font-semibold">Something went wrong</h1>
        <p className="mt-1 text-sm text-[var(--muted)]">
          This page hit an unexpected error. Your data is safe — try again, or reload the console.
        </p>
        {import.meta.env.DEV ? (
          <pre className="mt-4 max-h-40 overflow-auto rounded-lg bg-[#f8fafb] p-3 text-left text-xs text-[var(--danger)] whitespace-pre-wrap">
            {error.message}
          </pre>
        ) : null}
        <div className="mt-5 flex justify-center gap-2">
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            className="rounded-lg border border-[var(--line)] bg-white px-3.5 py-2 text-sm font-medium hover:bg-[var(--brand-soft)]"
          >
            Try again
          </button>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-lg bg-[var(--brand)] px-3.5 py-2 text-sm font-medium text-white hover:bg-[var(--brand-dark)]"
          >
            Reload
          </button>
        </div>
      </div>
    );

    if (this.props.inline) return <div className="grid place-items-center py-16">{panel}</div>;
    return <div className="min-h-screen grid place-items-center bg-[var(--surface)] px-4">{panel}</div>;
  }
}

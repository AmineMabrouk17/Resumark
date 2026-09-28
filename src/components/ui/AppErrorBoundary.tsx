"use client";

import { Component, type ErrorInfo, type ReactNode } from "react";

import { clearState } from "@/lib/storage";

/**
 * Last line of defence (PRD §36): unexpected failures show a friendly message
 * with a way out instead of a blank page or a raw stack trace.
 */
export class AppErrorBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  override state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo) {
    // Keep the technical detail in the console for developers, never in the UI.
    console.error("Resumark crashed:", error, info.componentStack);
  }

  override render() {
    if (!this.state.failed) return this.props.children;

    return (
      <main className="app-error">
        <h1>Something went wrong</h1>
        <p>
          The resume editor hit an unexpected problem and stopped rendering. Your
          Markdown is still stored in this browser — reloading usually recovers
          it, and resetting restores the example resume.
        </p>
        <div className="app-error__actions">
          <button
            type="button"
            className="button"
            onClick={() => window.location.reload()}
          >
            Reload Resumark
          </button>
          <button
            type="button"
            className="button button--danger"
            onClick={() => {
              clearState();
              window.location.reload();
            }}
          >
            Clear data &amp; reload
          </button>
        </div>
      </main>
    );
  }
}

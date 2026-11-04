'use client';

import { Component, type ErrorInfo, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';
import { commonStyles } from '@/styles';

interface Props {
  /** The panel's title, for the message. */
  title: string;
  children: ReactNode;
}

/** A panel that throws shows the error and a way to start it again; the others keep running. */
export default class PanelErrorBoundary extends Component<Props, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`Panel "${this.props.title}" failed:`, error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    return (
      <div role="alert" className="panel-notice is-error">
        <TriangleAlert size={24} aria-hidden="true" />
        <strong>This panel stopped working</strong>
        <code>{error.message || String(error)}</code>
        <button
          className={`${commonStyles.button.secondary} text-xs`}
          onClick={() => this.setState({ error: null })}
        >
          Reload panel
        </button>
      </div>
    );
  }
}

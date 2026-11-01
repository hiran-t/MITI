import * as React from 'react';
import * as ReactDOM from 'react-dom';
import * as jsxRuntime from 'react/jsx-runtime';
import * as sdk from './index';

/**
 * The modules a widget may import by name. Its build (`miti-widget build`, hiran-t/MITI-sdk)
 * turns each import of these into a read of `window.__MITI_MODULES__`, so widgets use the copies
 * MITI runs: one React, whose hooks and contexts work across MITI's panels and the widget's.
 */
export const WIDGET_MODULES = {
  react: React,
  'react-dom': ReactDOM,
  'react/jsx-runtime': jsxRuntime,
  '@miti/sdk': sdk,
} as const;

declare global {
  interface Window {
    __MITI_MODULES__?: Record<string, unknown>;
  }
}

/** Make the shared modules available before the first widget loads. */
export function exposeWidgetModules(): void {
  window.__MITI_MODULES__ ??= { ...WIDGET_MODULES };
}

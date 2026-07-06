/**
 * sync/network.ts — Named network utilities
 *
 * Wraps connectivity.ts with clearly named, testable functions.
 * This is the single import point for all network-state logic inside the sync engine.
 * Repositories and push/pull modules import from here — never from connectivity.ts directly.
 */
import { connectivity } from '../lib/connectivity';

/** True if the browser currently has network access. */
export function isOnline(): boolean {
  return connectivity.isOnline;
}

/**
 * Register a callback that fires when the browser reconnects.
 * Returns an unsubscribe function.
 */
export function onReconnect(fn: () => void): () => void {
  return connectivity.subscribe((online) => {
    if (online) fn();
  });
}

/**
 * Register a callback that fires when the browser loses connectivity.
 * Returns an unsubscribe function.
 */
export function onDisconnect(fn: () => void): () => void {
  return connectivity.subscribe((online) => {
    if (!online) fn();
  });
}

/**
 * Register a callback that fires on any connectivity state change.
 * Returns an unsubscribe function.
 */
export function onConnectivityChange(fn: (online: boolean) => void): () => void {
  return connectivity.subscribe(fn);
}

/**
 * Returns a promise that resolves the next time the browser goes online.
 * Useful for one-shot "wait until online" logic.
 */
export function waitUntilOnline(): Promise<void> {
  if (isOnline()) return Promise.resolve();
  return new Promise((resolve) => {
    const unsub = connectivity.subscribe((online) => {
      if (online) {
        unsub();
        resolve();
      }
    });
  });
}

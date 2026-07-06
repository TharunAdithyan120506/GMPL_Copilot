/**
 * GMPL Copilot — Connectivity Manager
 *
 * Central singleton that tracks online/offline state.
 * Components subscribe via the exported hook `useOnlineStatus()`.
 */

type ConnectivityListener = (online: boolean) => void;

class ConnectivityManager {
  private _online: boolean = navigator.onLine;
  private _listeners: Set<ConnectivityListener> = new Set();

  constructor() {
    window.addEventListener('online', () => this._update(true));
    window.addEventListener('offline', () => this._update(false));
  }

  private _update(online: boolean) {
    if (this._online === online) return;
    this._online = online;
    this._listeners.forEach(fn => fn(online));
  }

  get isOnline(): boolean {
    return this._online;
  }

  subscribe(fn: ConnectivityListener): () => void {
    this._listeners.add(fn);
    return () => this._listeners.delete(fn);
  }
}

export const connectivity = new ConnectivityManager();

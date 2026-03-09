type HeaderScrollListener = () => void;
const HEADER_RESELECT_WINDOW_MS = 340;

const listeners = new Map<string, Set<HeaderScrollListener>>();
const lastTapAtByRoute = new Map<string, number>();

export function subscribeHeaderScrollToTop(route: string, listener: HeaderScrollListener) {
  const routeListeners = listeners.get(route) ?? new Set<HeaderScrollListener>();
  routeListeners.add(listener);
  listeners.set(route, routeListeners);
  return () => {
    const current = listeners.get(route);
    if (!current) {
      return;
    }
    current.delete(listener);
    if (!current.size) {
      listeners.delete(route);
    }
  };
}

export function emitHeaderScrollToTop(route: string) {
  const routeListeners = listeners.get(route);
  if (!routeListeners) {
    return;
  }
  for (const listener of routeListeners) {
    listener();
  }
}

export function handleHeaderScrollTitlePress(route: string) {
  const now = Date.now();
  const lastTapAt = lastTapAtByRoute.get(route) ?? 0;

  if (now - lastTapAt <= HEADER_RESELECT_WINDOW_MS) {
    emitHeaderScrollToTop(route);
    lastTapAtByRoute.delete(route);
    return;
  }

  lastTapAtByRoute.set(route, now);
}

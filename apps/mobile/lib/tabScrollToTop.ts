type ScrollTopRoute = "worktime" | "status-tab";

type ScrollTopListener = () => void;

const listeners: Record<ScrollTopRoute, Set<ScrollTopListener>> = {
  worktime: new Set(),
  "status-tab": new Set(),
};

export function subscribeTabScrollToTop(route: ScrollTopRoute, listener: ScrollTopListener) {
  listeners[route].add(listener);
  return () => {
    listeners[route].delete(listener);
  };
}

export function emitTabScrollToTop(route: ScrollTopRoute) {
  for (const listener of listeners[route]) {
    listener();
  }
}

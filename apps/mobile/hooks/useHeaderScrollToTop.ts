import { useEffect, type RefObject } from "react";
import type { ScrollView } from "react-native";
import { subscribeHeaderScrollToTop } from "../lib/headerScrollToTop";

export function useHeaderScrollToTop(routeKeys: string[], scrollRef: RefObject<ScrollView | null>) {
  const routeSignature = routeKeys.join("|");

  useEffect(() => {
    const stableRouteKeys = routeSignature ? routeSignature.split("|") : [];
    const unsubs = stableRouteKeys.map((routeKey) =>
      subscribeHeaderScrollToTop(routeKey, () => {
        scrollRef.current?.scrollTo({ y: 0, animated: true });
      }),
    );

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [routeSignature, scrollRef]);
}

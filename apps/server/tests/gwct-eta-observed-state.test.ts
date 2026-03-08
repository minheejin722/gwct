import { describe, expect, it } from "vitest";
import type { ScheduleFocusItem } from "../src/services/scheduleFocus/latestStore.js";
import {
  buildTrackedScheduleFocusSignature,
  computeNextGwctEtaObservedState,
} from "../src/services/scheduleFocus/observedState.js";

function item(
  indexInWatchWindow: number,
  voyage: string,
  vesselName: string,
  etaNormalized: string | null,
  rowColor: ScheduleFocusItem["rowColor"] = "yellow",
): ScheduleFocusItem {
  return {
    indexInWatchWindow,
    voyage,
    vesselName,
    eta: etaNormalized,
    etaNormalized,
    rowColor,
    rowClass: null,
  };
}

describe("gwct eta observed state", () => {
  it("builds the tracked signature from only the configured top N rows", () => {
    const signature = buildTrackedScheduleFocusSignature(
      [
        item(1, "VOY1", "VESSEL1", "2026-03-08T10:00"),
        item(2, "VOY2", "VESSEL2", "2026-03-08T11:00"),
        item(3, "VOY3", "VESSEL3", "2026-03-08T12:00"),
      ],
      2,
    );

    expect(signature).toContain("VOY1");
    expect(signature).toContain("VOY2");
    expect(signature).not.toContain("VOY3");
  });

  it("updates lastChangedAt when any tracked row changes", () => {
    const previousSignature = buildTrackedScheduleFocusSignature(
      [item(1, "VOY1", "VESSEL1", "2026-03-08T10:00")],
      1,
    );

    const result = computeNextGwctEtaObservedState({
      items: [item(1, "VOY1", "VESSEL1", "2026-03-08T10:30")],
      trackingCount: 1,
      previousSignature,
      previousChangedAt: "2026-03-08T00:00:00.000Z",
      observedAt: "2026-03-08T00:10:00.000Z",
    });

    expect(result.changed).toBe(true);
    expect(result.lastChangedAt).toBe("2026-03-08T00:10:00.000Z");
  });

  it("preserves lastChangedAt when the tracked rows stay identical", () => {
    const previousSignature = buildTrackedScheduleFocusSignature(
      [item(1, "VOY1", "VESSEL1", "2026-03-08T10:00")],
      1,
    );

    const result = computeNextGwctEtaObservedState({
      items: [item(1, "VOY1", "VESSEL1", "2026-03-08T10:00")],
      trackingCount: 1,
      previousSignature,
      previousChangedAt: "2026-03-08T00:00:00.000Z",
      observedAt: "2026-03-08T00:20:00.000Z",
    });

    expect(result.changed).toBe(false);
    expect(result.lastChangedAt).toBe("2026-03-08T00:00:00.000Z");
  });
});

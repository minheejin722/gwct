import type { CraneStatus } from "@gwct/shared";
import { afterEach, describe, expect, it } from "vitest";
import {
  buildNextGcAssignmentState,
  clearGcAssignmentStateForTest,
  createDefaultGcAssignmentState,
  ensureGcAssignmentState,
  loadGcAssignmentState,
  saveGcAssignmentState,
} from "../src/services/gc/assignmentStore.js";

function craneRow(
  seenAt: string,
  craneId: string,
  vesselName: string | null,
  totalRemaining: number | null,
): CraneStatus {
  return {
    source: "gwct_work_status",
    craneId,
    vesselName,
    dischargeDone: null,
    loadDone: null,
    dischargeRemaining: totalRemaining,
    loadRemaining: 0,
    totalRemaining,
    progressPercent: null,
    signature: `${seenAt}:${craneId}:${vesselName || "-"}:${totalRemaining ?? "-"}`,
    seenAt,
  };
}

describe.sequential("gc assignment store", () => {
  afterEach(async () => {
    await clearGcAssignmentStateForTest();
  });

  it("assigns the only decreased vessel as active and keeps the others pending", () => {
    const next = buildNextGcAssignmentState(
      createDefaultGcAssignmentState(),
      [
        craneRow("2026-03-07T06:39:03.339Z", "GC184", "MAERSK SALTORO", 180),
        craneRow("2026-03-07T06:39:03.339Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      [
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "MAERSK SALTORO", 179),
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      "2026-03-07T06:40:10.743Z",
    );

    expect(next.items["184"]).toMatchObject({
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:40:10.743Z",
    });
  });

  it("keeps the previously active vessel when no new decrease is observed", () => {
    const previous = createDefaultGcAssignmentState();
    previous.items["184"] = {
      gc: 184,
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:40:10.743Z",
    };

    const next = buildNextGcAssignmentState(
      previous,
      [
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "MAERSK SALTORO", 179),
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      [
        craneRow("2026-03-07T06:40:40.743Z", "GC184", "MAERSK SALTORO", 179),
        craneRow("2026-03-07T06:40:40.743Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      "2026-03-07T06:40:40.743Z",
    );

    expect(next.items["184"]).toMatchObject({
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:40:40.743Z",
    });
  });

  it("keeps a sole remaining vessel pending after handoff until its own decrease appears", () => {
    const previous = createDefaultGcAssignmentState();
    previous.items["184"] = {
      gc: 184,
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:40:10.743Z",
    };

    const next = buildNextGcAssignmentState(
      previous,
      [
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "MAERSK SALTORO", 1),
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      [craneRow("2026-03-07T06:41:10.743Z", "GC184", "CMA CGM CORTE REAL", 167)],
      "2026-03-07T06:41:10.743Z",
    );

    expect(next.items["184"]).toMatchObject({
      activeVesselName: null,
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:41:10.743Z",
    });
  });

  it("keeps the prior active vessel when multiple vessels decrease at once", () => {
    const previous = createDefaultGcAssignmentState();
    previous.items["184"] = {
      gc: 184,
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:40:10.743Z",
    };

    const next = buildNextGcAssignmentState(
      previous,
      [
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "MAERSK SALTORO", 179),
        craneRow("2026-03-07T06:40:10.743Z", "GC184", "CMA CGM CORTE REAL", 167),
      ],
      [
        craneRow("2026-03-07T06:41:10.743Z", "GC184", "MAERSK SALTORO", 178),
        craneRow("2026-03-07T06:41:10.743Z", "GC184", "CMA CGM CORTE REAL", 166),
      ],
      "2026-03-07T06:41:10.743Z",
    );

    expect(next.items["184"]).toMatchObject({
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:40:10.743Z",
      lastSeenAt: "2026-03-07T06:41:10.743Z",
    });
  });

  it("backfills the store from recent work-status snapshot groups when empty", async () => {
    await clearGcAssignmentStateForTest();

    const seenAt = "2026-03-07T06:40:10.743Z";
    const backfilled = await ensureGcAssignmentState({
      async getLatestCraneStatusSnapshotGroups() {
        return [
          {
            seenAt,
            items: [
              craneRow(seenAt, "GC184", "MAERSK SALTORO", 179),
              craneRow(seenAt, "GC184", "CMA CGM CORTE REAL", 167),
            ],
          },
          {
            seenAt: "2026-03-07T06:39:36.522Z",
            items: [
              craneRow("2026-03-07T06:39:36.522Z", "GC184", "MAERSK SALTORO", 179),
              craneRow("2026-03-07T06:39:36.522Z", "GC184", "CMA CGM CORTE REAL", 167),
            ],
          },
          {
            seenAt: "2026-03-07T06:39:03.339Z",
            items: [
              craneRow("2026-03-07T06:39:03.339Z", "GC184", "MAERSK SALTORO", 180),
              craneRow("2026-03-07T06:39:03.339Z", "GC184", "CMA CGM CORTE REAL", 167),
            ],
          },
        ];
      },
    });

    expect(backfilled.items["184"]).toMatchObject({
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:39:36.522Z",
      lastSeenAt: seenAt,
    });

    const persisted = await loadGcAssignmentState();
    expect(persisted.items["184"]).toMatchObject({
      activeVesselName: "MAERSK SALTORO",
      pendingVesselNames: ["CMA CGM CORTE REAL"],
      lastEvidenceAt: "2026-03-07T06:39:36.522Z",
    });
  });

  it("does not overwrite a non-empty persisted store during ensure", async () => {
    const current = createDefaultGcAssignmentState();
    current.items["184"] = {
      gc: 184,
      activeVesselName: "CMA CGM CORTE REAL",
      pendingVesselNames: ["MAERSK SALTORO"],
      lastEvidenceAt: "2026-03-07T07:00:10.743Z",
      lastSeenAt: "2026-03-07T07:00:10.743Z",
    };
    await saveGcAssignmentState(current);

    const ensured = await ensureGcAssignmentState({
      async getLatestCraneStatusSnapshotGroups() {
        throw new Error("backfill should not run when store is already populated");
      },
    });

    expect(ensured.items["184"]).toMatchObject({
      activeVesselName: "CMA CGM CORTE REAL",
      pendingVesselNames: ["MAERSK SALTORO"],
    });
  });
});

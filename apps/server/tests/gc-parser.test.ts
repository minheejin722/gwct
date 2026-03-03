import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseGwctGcRemaining } from "../src/parsers/gwct.js";

const fixture = (setName: string) =>
  readFileSync(path.resolve(process.cwd(), "fixtures", setName, "gwct_gc_remaining.html"), "utf8");

describe("gwct gc remaining parser", () => {
  it("parses GC181~190 discharge/load remaining subtotals", () => {
    const bundle = parseGwctGcRemaining(
      fixture("step1"),
      "2026-03-01T12:00:00.000Z",
      "gwct_gc_remaining",
    );

    expect(bundle.cranes).toHaveLength(10);
    expect(bundle.diagnostics).toHaveLength(0);

    const gc188 = bundle.cranes.find((item) => item.craneId === "GC188");
    expect(gc188?.dischargeRemaining).toBe(11);
    expect(gc188?.loadRemaining).toBe(9);

    const ids = bundle.cranes.map((item) => item.craneId).sort();
    expect(ids).toEqual([
      "GC181",
      "GC182",
      "GC183",
      "GC184",
      "GC185",
      "GC186",
      "GC187",
      "GC188",
      "GC189",
      "GC190",
    ]);
  });

  it("handles changed values for next snapshot diff", () => {
    const bundle = parseGwctGcRemaining(
      fixture("step2"),
      "2026-03-01T12:01:00.000Z",
      "gwct_gc_remaining",
    );

    const gc188 = bundle.cranes.find((item) => item.craneId === "GC188");
    expect(gc188?.dischargeRemaining).toBe(3);
    expect(gc188?.loadRemaining).toBe(4);
  });

  it("does not report parser diagnostics for partial null subtotals", () => {
    const html = fixture("step1")
      .replace("<td>120</td><td>40</td>", "<td></td><td></td>")
      .replace("<td>90</td><td>20</td>", "<td></td><td></td>");

    const bundle = parseGwctGcRemaining(
      html,
      "2026-03-01T12:02:00.000Z",
      "gwct_gc_remaining",
    );

    expect(bundle.diagnostics).toHaveLength(0);
    const gc181 = bundle.cranes.find((item) => item.craneId === "GC181");
    expect(gc181?.dischargeRemaining).toBeNull();
    expect(gc181?.loadRemaining).toBeNull();
  });

  it("reports diagnostics when gc remaining table structure is missing", () => {
    const bundle = parseGwctGcRemaining(
      "<html><body><table class='AA_list'><tr><td>no gc table</td></tr></table></body></html>",
      "2026-03-01T12:03:00.000Z",
      "gwct_gc_remaining",
    );

    expect(bundle.diagnostics).toHaveLength(1);
    expect(bundle.diagnostics[0]?.reason).toBe("gc remaining candidate tables not found");
  });
});

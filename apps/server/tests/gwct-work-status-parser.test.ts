import { describe, expect, it } from "vitest";
import { parseGwctWorkStatus } from "../src/parsers/gwct.js";

const html = `
  <html>
    <body>
      <h3>SAWASDEE CAPELLA(SWCP-0003)</h3>
      <table class="AA_list">
        <tr>
          <th>Gantry Crane No.</th>
          <th colspan="2">G/C 181</th>
          <th colspan="2">G/C 182</th>
          <th colspan="2">G/C 183</th>
          <th colspan="2">G/C 184</th>
          <th colspan="2">G/C 185</th>
          <th colspan="2">G/C 186</th>
          <th colspan="2">G/C 187</th>
          <th colspan="2">G/C 188</th>
          <th colspan="2">G/C 189</th>
          <th colspan="2">G/C 190</th>
          <th>양하량</th>
          <th>적하량</th>
        </tr>
        <tr>
          <td>작업 구분</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
          <td>양하</td><td>적하</td>
        </tr>
        <tr>
          <td>합계</td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>84</td><td>1</td>
          <td>141</td><td>54</td>
          <td>141</td><td>146</td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>366</td><td>201</td>
        </tr>
        <tr>
          <td>완료</td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>11</td><td></td>
          <td>12</td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>23</td><td></td>
        </tr>
        <tr>
          <td>잔량</td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>84</td><td>1</td>
          <td>130</td><td>54</td>
          <td>129</td><td>146</td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td></td><td></td>
          <td>343</td><td>201</td>
        </tr>
      </table>
    </body>
  </html>
`;

describe("parseGwctWorkStatus", () => {
  it("keeps trailing blank GC columns empty instead of shifting earlier remaining values", () => {
    const bundle = parseGwctWorkStatus(html, "2026-03-07T00:43:41.000Z", "gwct_work_status");

    const gc184 = bundle.cranes.find((row) => row.craneId === "GC184");
    const gc185 = bundle.cranes.find((row) => row.craneId === "GC185");
    const gc186 = bundle.cranes.find((row) => row.craneId === "GC186");
    const gc189 = bundle.cranes.find((row) => row.craneId === "GC189");
    const gc190 = bundle.cranes.find((row) => row.craneId === "GC190");

    expect(gc184?.totalRemaining).toBe(85);
    expect(gc185?.totalRemaining).toBe(184);
    expect(gc186?.totalRemaining).toBe(275);
    expect(gc189?.dischargeRemaining).toBeNull();
    expect(gc189?.loadRemaining).toBeNull();
    expect(gc189?.totalRemaining).toBeNull();
    expect(gc190?.dischargeRemaining).toBeNull();
    expect(gc190?.loadRemaining).toBeNull();
    expect(gc190?.totalRemaining).toBeNull();
  });
});

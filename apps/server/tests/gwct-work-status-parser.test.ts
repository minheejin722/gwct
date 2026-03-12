import { describe, expect, it } from "vitest";
import { parseGwctWorkStatus } from "../src/parsers/gwct.js";

const LABELS = {
  discharge: "\uC591\uD558",
  load: "\uC801\uD558",
  dischargeTotal: "\uC591\uD558\uB7C9",
  loadTotal: "\uC801\uD558\uB7C9",
  workType: "\uC791\uC5C5 \uAD6C\uBD84",
  total: "\uD569\uACC4",
  completed: "\uC644\uB8CC",
  remaining: "\uC794\uB7C9",
  subtotal: "\uC794\uB7C9 \uC18C\uACC4",
};

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
          <th>${LABELS.dischargeTotal}</th>
          <th>${LABELS.loadTotal}</th>
        </tr>
        <tr>
          <td>${LABELS.workType}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
          <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
        </tr>
        <tr>
          <td>${LABELS.total}</td>
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
          <td>${LABELS.completed}</td>
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
          <td>${LABELS.remaining}</td>
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
    expect(gc185?.dischargeDone).toBe(11);
    expect(gc185?.loadDone).toBeNull();
    expect(gc185?.totalRemaining).toBe(184);
    expect(gc186?.dischargeDone).toBe(12);
    expect(gc186?.loadDone).toBeNull();
    expect(gc186?.totalRemaining).toBe(275);
    expect(gc189?.dischargeRemaining).toBeNull();
    expect(gc189?.loadRemaining).toBeNull();
    expect(gc189?.totalRemaining).toBeNull();
    expect(gc190?.dischargeRemaining).toBeNull();
    expect(gc190?.loadRemaining).toBeNull();
    expect(gc190?.totalRemaining).toBeNull();
  });

  it("prefers the subtotal row for totalRemaining and the completed row for done values", () => {
    const htmlWithSubtotal = `
      <html>
        <body>
          <h3>POS QINGDAO(SPCQ-0005)</h3>
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
              <th>${LABELS.dischargeTotal}</th>
              <th>${LABELS.loadTotal}</th>
            </tr>
            <tr>
              <td>${LABELS.workType}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
              <td>${LABELS.discharge}</td><td>${LABELS.load}</td>
            </tr>
            <tr>
              <td>${LABELS.total}</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td>57</td><td>43</td>
              <td>24</td><td>78</td>
              <td>15</td><td>75</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td>96</td><td>196</td>
            </tr>
            <tr>
              <td>${LABELS.completed}</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td>57</td><td>10</td>
              <td>24</td><td>44</td>
              <td>15</td><td>46</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td>96</td><td>100</td>
            </tr>
            <tr>
              <td>${LABELS.remaining}</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td>33</td>
              <td></td><td>34</td>
              <td></td><td>29</td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td></td>
              <td></td><td>96</td>
            </tr>
            <tr>
              <td>${LABELS.subtotal}</td>
              <td></td>
              <td></td>
              <td></td>
              <td></td>
              <td>33</td>
              <td>34</td>
              <td>29</td>
              <td></td>
              <td></td>
              <td></td>
              <td>96</td>
            </tr>
          </table>
        </body>
      </html>
    `;

    const bundle = parseGwctWorkStatus(htmlWithSubtotal, "2026-03-07T00:43:41.000Z", "gwct_work_status");

    expect(bundle.cranes.find((row) => row.craneId === "GC185")?.dischargeDone).toBe(57);
    expect(bundle.cranes.find((row) => row.craneId === "GC185")?.loadDone).toBe(10);
    expect(bundle.cranes.find((row) => row.craneId === "GC185")?.totalRemaining).toBe(33);
    expect(bundle.cranes.find((row) => row.craneId === "GC186")?.loadDone).toBe(44);
    expect(bundle.cranes.find((row) => row.craneId === "GC186")?.totalRemaining).toBe(34);
    expect(bundle.cranes.find((row) => row.craneId === "GC187")?.loadDone).toBe(46);
    expect(bundle.cranes.find((row) => row.craneId === "GC187")?.totalRemaining).toBe(29);
  });
});

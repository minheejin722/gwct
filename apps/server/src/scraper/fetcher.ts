import type { SourceId } from "@gwct/shared";
import { env } from "../config/env.js";
import { sha256 } from "../lib/hash.js";
import { wait } from "../lib/async.js";
import type { FetchResult } from "../parsers/types.js";
import { BrowserPool } from "./browser.js";
import { loadFixtureHtml, resolveMode } from "./fixtures.js";

export interface FetchOptions {
  mode?: "live" | "fixture";
  fixtureSet?: string;
  timeoutMs?: number;
}

export class HtmlFetcher {
  constructor(private readonly browserPool: BrowserPool) {}

  async fetch(source: SourceId, url: string, options: FetchOptions = {}): Promise<FetchResult> {
    const mode = resolveMode(options.mode);
    if (mode === "fixture") {
      const html = await loadFixtureHtml(source, options.fixtureSet);
      return {
        source,
        url,
        statusCode: 200,
        html,
        fetchedAt: new Date().toISOString(),
        metadata: {
          mode,
          fixtureSet: options.fixtureSet || "base",
          htmlHash: sha256(html),
        },
      };
    }

    const timeoutMs = options.timeoutMs ?? env.REQUEST_TIMEOUT_MS;
    let attempt = 0;
    const maxAttempts = Math.max(1, env.MAX_RETRIES + 1);
    let lastError: unknown;

    while (attempt < maxAttempts) {
      const startedAt = Date.now();
      let page;
      try {
        page = await this.browserPool.getPage();
        const response = await page.goto(url, {
          timeout: timeoutMs,
          waitUntil: "domcontentloaded",
        });
        let scheduleRowsMeta: Record<string, unknown> | null = null;
        if (source === "gwct_schedule_list") {
          await page.waitForSelector("table.AA_list tr td", { timeout: Math.min(timeoutMs, 15000) });
          await page.waitForFunction(
            () => {
              const table = Array.from(document.querySelectorAll("table.AA_list")).find((candidate) => {
                const header = Array.from(candidate.querySelectorAll("tr:first-child th"))
                  .map((th) => (th.textContent || "").replace(/\s+/g, " ").trim())
                  .join(" ");
                return header.includes("모선항차") && header.includes("선박명") && header.includes("입항");
              });
              return Boolean(table);
            },
            { timeout: Math.min(timeoutMs, 15000) },
          );

          scheduleRowsMeta = (await page.evaluate(`(() => {
            const references = {
              green: [109, 214, 109],
              yellow: [254, 220, 143],
              cyan: [167, 238, 255],
            };

            const parseColor = (input) => {
              if (!input) return null;
              const text = String(input).replace(/\\s+/g, "").toLowerCase();
              const hex = text.match(/^#([0-9a-f]{6})$/i);
              if (hex) {
                return [
                  Number.parseInt(hex[1].slice(0, 2), 16),
                  Number.parseInt(hex[1].slice(2, 4), 16),
                  Number.parseInt(hex[1].slice(4, 6), 16),
                ];
              }
              const rgb = text.match(/^rgba?\\((\\d+),(\\d+),(\\d+)/);
              if (rgb) {
                return [Number(rgb[1]), Number(rgb[2]), Number(rgb[3])];
              }
              return null;
            };

            const distance = (a, b) => {
              const dr = a[0] - b[0];
              const dg = a[1] - b[1];
              const db = a[2] - b[2];
              return Math.sqrt(dr * dr + dg * dg + db * db);
            };

            const classifyByDistance = (rgb) => {
              const entries = Object.entries(references);
              let nearest = "unknown";
              let nearestDistance = Number.POSITIVE_INFINITY;
              entries.forEach(([name, target]) => {
                const d = distance(rgb, target);
                if (d < nearestDistance) {
                  nearest = name;
                  nearestDistance = d;
                }
              });
              return nearestDistance <= 80 ? nearest : "unknown";
            };

            const classifyRow = (className, computedBackground, attrBackground) => {
              const cls = String(className || "").toLowerCase();
              if (cls.includes("bg_closed")) return "green";
              if (cls.includes("bg_on")) return "yellow";
              if (cls.includes("bg_yet")) return "cyan";
              const parsed = parseColor(computedBackground) || parseColor(attrBackground);
              if (!parsed) return "unknown";
              return classifyByDistance(parsed);
            };

            const table = Array.from(document.querySelectorAll("table.AA_list")).find((candidate) => {
              const header = Array.from(candidate.querySelectorAll("tr:first-child th"))
                .map((th) => (th.textContent || "").replace(/\\s+/g, " ").trim())
                .join(" ");
              return header.includes("모선항차") && header.includes("선박명") && header.includes("입항");
            }) || null;

            if (!table) return { rowCount: 0, sampledRows: [] };
            table.setAttribute("data-gwct-schedule-table", "1");

            const sampledRows = [];
            Array.from(table.querySelectorAll("tr")).forEach((row, index) => {
              if (!row.querySelector("td")) return;
              const className = row.className || "";
              const attrBackground = row.getAttribute("bgcolor") || row.getAttribute("style") || "";
              const computedBackground = getComputedStyle(row).backgroundColor || "";
              const color = classifyRow(className, computedBackground, attrBackground);
              row.setAttribute("data-gwct-row-color", color);
              row.setAttribute("data-gwct-row-bg", computedBackground || attrBackground);
              sampledRows.push({
                rowIndex: index,
                className,
                color,
                bg: computedBackground || attrBackground,
              });
            });

            return { rowCount: sampledRows.length, sampledRows: sampledRows.slice(0, 30) };
          })();`)) as Record<string, unknown>;
        }
        if (source === "gwct_gc_remaining") {
          await page.waitForSelector("table.AA_list", { timeout: Math.min(timeoutMs, 15000) });
          await page.waitForFunction(
            () => {
              const text = document.body?.innerText || "";
              return /G\/?C\s*18[1-9]|G\/?C\s*190/.test(text);
            },
            { timeout: Math.min(timeoutMs, 15000) },
          );
        }
        await page.waitForTimeout(150);
        const html = await page.content();
        const statusCode = response?.status() ?? null;
        await page.close();

        return {
          source,
          url,
          statusCode,
          html,
          fetchedAt: new Date().toISOString(),
          metadata: {
            mode,
            attempt,
            durationMs: Date.now() - startedAt,
            htmlHash: sha256(html),
            scheduleRowsMeta,
          },
        };
      } catch (error) {
        lastError = error;
        if (page) {
          await page.close().catch(() => undefined);
        }
        attempt += 1;
        if (attempt >= maxAttempts) {
          break;
        }
        const backoffMs = env.BACKOFF_BASE_MS * 2 ** (attempt - 1);
        await wait(backoffMs);
      }
    }

    throw new Error(`Fetch failed for ${source}: ${String((lastError as Error)?.message || lastError)}`);
  }
}

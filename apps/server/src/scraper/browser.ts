import { chromium, type Browser, type BrowserContext, type Page } from "playwright";
import { env } from "../config/env.js";

export class BrowserPool {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;

  async getPage(): Promise<Page> {
    if (!this.browser) {
      this.browser = await chromium.launch({ headless: env.playwrightHeadless });
    }
    if (!this.context) {
      this.context = await this.browser.newContext();
    }
    return this.context.newPage();
  }

  async close(): Promise<void> {
    if (this.context) {
      await this.context.close();
      this.context = null;
    }
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
    }
  }
}

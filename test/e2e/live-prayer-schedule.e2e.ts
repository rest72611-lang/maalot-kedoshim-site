/**
 * Browser tests for the live prayer schedule (P4.3). Builds a second copy
 * of the site into .cache/e2e-dist with PUBLIC_API_ORIGIN pointing at a
 * fake API on this machine, serves it, and drives the installed Chrome.
 *
 * Run after `npm run build` (it needs the compiled build script and client).
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import { chromium, type Browser, type Page } from "playwright-core";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const e2eDist = path.join(projectRoot, ".cache", "e2e-dist");

type ApiMode = "ok" | "error" | "slow" | "malformed" | "hostile";
let apiMode: ApiMode = "ok";

const liveSchedule = {
  generatedAt: "2027-01-12T08:00:00.000Z",
  weekday: [
    { name: "שחרית", time: "06:30" },
    { name: "מנחה", time: "13:45" },
  ],
  upcomingShabbat: {
    date: "2027-01-16",
    parashaLabel: "פרשת בא",
    services: [
      { name: "מנחה וקבלת שבת", time: "16:48" },
      { name: "קידוש", time: null },
    ],
  },
  specialDays: [
    {
      groupTitle: "פורים תשפ\"ז",
      title: "פורים",
      date: "2027-03-23",
      hebrewDateLabel: "יום שלישי י\"ד אדר ב'",
      note: null,
      services: [{ name: "קריאת המגילה", time: "07:00" }],
    },
  ],
};

let apiServer: Server;
let siteServer: Server;
let browser: Browser;
let siteOrigin: string;

before(async () => {
  apiServer = createServer((request, response) => {
    const send = (status: number, body: string) => {
      response.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
      response.end(body);
    };
    if (request.url !== "/v1/prayer-schedule") {
      return send(404, "{}");
    }
    switch (apiMode) {
      case "ok":
        return send(200, JSON.stringify(liveSchedule));
      case "error":
        return send(500, JSON.stringify({ error: { code: "internal_error", message: "x" } }));
      case "slow":
        setTimeout(() => send(200, JSON.stringify(liveSchedule)), 8000).unref();
        return;
      case "malformed":
        return send(200, JSON.stringify({ weekday: "not a list" }));
      case "hostile":
        return send(
          200,
          JSON.stringify({ ...liveSchedule, weekday: [{ name: '<img src=x onerror="window.pwned=1">', time: "06:30" }] }),
        );
    }
  });
  const apiOrigin = await listen(apiServer);

  await execFileAsync(process.execPath, [path.join(".cache", "build", "build", "build.js")], {
    cwd: projectRoot,
    env: { ...process.env, SITE_DIST_DIR: e2eDist, PUBLIC_API_ORIGIN: apiOrigin },
  });

  siteServer = createServer(async (request, response) => {
    const urlPath = decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname);
    let filePath = path.join(e2eDist, urlPath);
    if (!filePath.startsWith(e2eDist)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(filePath).catch(() => null))?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    try {
      const body = await readFile(filePath);
      const type = filePath.endsWith(".html") ? "text/html; charset=utf-8" : filePath.endsWith(".js") ? "text/javascript" : filePath.endsWith(".css") ? "text/css" : "application/octet-stream";
      response.writeHead(200, { "Content-Type": type }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  siteOrigin = await listen(siteServer);

  browser = await chromium.launch({ channel: "chrome", headless: true });
});

after(async () => {
  await browser?.close();
  apiServer?.close();
  siteServer?.close();
});

async function listen(server: Server): Promise<string> {
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
}

/** Opens /zmanim/ and waits until the client script has decided live vs snapshot. */
async function openZmanim(mode: ApiMode, options: { javaScriptEnabled?: boolean } = {}): Promise<Page> {
  apiMode = mode;
  const context = await browser.newContext({ javaScriptEnabled: options.javaScriptEnabled ?? true });
  const page = await context.newPage();
  await page.goto(`${siteOrigin}/zmanim/`);
  if (options.javaScriptEnabled !== false) {
    await page.waitForSelector("#prayer-schedule[data-source]", { timeout: 10_000 });
  }
  return page;
}

const scheduleText = (page: Page) => page.locator("#prayer-schedule").innerText();

describe("live prayer schedule in a real browser", () => {
  test("API 200: live times replace the snapshot", async () => {
    const page = await openZmanim("ok");
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), "live");
    const text = await scheduleText(page);
    assert.match(text, /שבת הקרובה, פרשת בא/);
    assert.match(text, /16:48/);
    assert.match(text, /06:30/, "live weekday time");
    assert.doesNotMatch(text, /06:15/, "snapshot weekday time is gone");
    assert.match(text, /פורים/);
    assert.equal(await page.locator(".schedule-status").count(), 0);
    await page.context().close();
  });

  test("API 500: the snapshot stays, with an out-of-date notice", async () => {
    const page = await openZmanim("error");
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), "snapshot");
    assert.match(await scheduleText(page), /06:15/);
    assert.match(await page.locator(".schedule-status").innerText(), /ייתכן שהזמנים אינם מעודכנים/);
    await page.context().close();
  });

  test("API timeout: the snapshot stays, with the notice", async () => {
    const page = await openZmanim("slow");
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), "snapshot");
    assert.match(await scheduleText(page), /06:15/);
    assert.equal(await page.locator(".schedule-status").count(), 1);
    await page.context().close();
  });

  test("malformed API response: the snapshot stays", async () => {
    const page = await openZmanim("malformed");
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), "snapshot");
    assert.match(await scheduleText(page), /06:15/);
    await page.context().close();
  });

  test("JavaScript off: the snapshot is shown, with no notice", async () => {
    const page = await openZmanim("error", { javaScriptEnabled: false });
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), null);
    assert.match(await scheduleText(page), /06:15/);
    assert.equal(await page.locator(".schedule-status").count(), 0);
    await page.context().close();
  });

  test("API text is shown as text, never parsed as HTML", async () => {
    const page = await openZmanim("hostile");
    assert.equal(await page.getAttribute("#prayer-schedule", "data-source"), "live");
    assert.equal(await page.locator("#prayer-schedule img").count(), 0);
    assert.match(await scheduleText(page), /<img src=x/);
    assert.equal(await page.evaluate(() => (globalThis as { pwned?: number }).pwned), undefined);
    await page.context().close();
  });
});

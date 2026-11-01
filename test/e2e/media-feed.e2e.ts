/**
 * Browser tests for merging new media into the home page (P6.4). Builds a
 * copy of the site with PUBLIC_API_ORIGIN pointing at a fake API on this
 * machine and drives the installed Chrome.
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
const e2eDist = path.join(projectRoot, ".cache", "e2e-dist-media");
const NEW_ID = "01JEXAMPLE0000000000000000";
const NOTICE_ID = "01JEXAMPLE0000000000000001";

type Mode = "ok" | "error" | "hostile";
let mode: Mode = "ok";
let hiddenLegacyId = "";
let png: Buffer;

let apiServer: Server;
let siteServer: Server;
let browser: Browser;
let siteOrigin: string;

function feed(): unknown {
  const caption = mode === "hostile" ? '<img src=x onerror="window.pwned=1">' : "ערב לימוד חדש";
  return {
    items: [
      { id: NEW_ID, kind: "image", placement: "gallery", width: 92, height: 92, caption, publishedAt: "2027-01-12T10:00:00Z", url: `/v1/media/${NEW_ID}` },
      { id: NOTICE_ID, kind: "image", placement: "notice", width: 92, height: 92, caption: null, publishedAt: "2027-01-11T10:00:00Z", url: `/v1/media/${NOTICE_ID}` },
    ],
    hiddenLegacyIds: hiddenLegacyId ? [hiddenLegacyId] : [],
  };
}

before(async () => {
  apiServer = createServer((request, response) => {
    const headers = { "Access-Control-Allow-Origin": "*" };
    if (mode === "error") {
      response.writeHead(500, headers).end("{}");
    } else if (request.url === "/v1/media-feed") {
      response.writeHead(200, { ...headers, "Content-Type": "application/json" }).end(JSON.stringify(feed()));
    } else if (request.url?.startsWith("/v1/media/")) {
      response.writeHead(200, { ...headers, "Content-Type": "image/png" }).end(png);
    } else {
      response.writeHead(404, headers).end();
    }
  });
  const apiOrigin = await listen(apiServer);

  await execFileAsync(process.execPath, [path.join(".cache", "build", "build", "build.js")], {
    cwd: projectRoot,
    env: { ...process.env, SITE_DIST_DIR: e2eDist, PUBLIC_API_ORIGIN: apiOrigin },
  });
  png = await readFile(path.join(e2eDist, "assets", "generated", "images", "logo.png"));

  siteServer = createServer(async (request, response) => {
    let filePath = path.join(e2eDist, decodeURIComponent(new URL(request.url ?? "/", "http://x").pathname));
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

async function openHome(options: { javaScriptEnabled?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext({ javaScriptEnabled: options.javaScriptEnabled ?? true });
  const page = await context.newPage();
  // The home page popup would cover the content; it is not under test here.
  await page.goto(`${siteOrigin}/`);
  if (options.javaScriptEnabled !== false) {
    await page.waitForSelector("#activity-gallery[data-source]", { timeout: 10_000 });
  }
  return page;
}

async function legacyIds(page: Page): Promise<string[]> {
  return page.$$eval("[data-legacy-id]", (nodes) => nodes.map((node) => node.getAttribute("data-legacy-id") ?? ""));
}

describe("new media merged into the home page", () => {
  test("API up: new photo and notice appear first, legacy items stay", async () => {
    mode = "ok";
    hiddenLegacyId = "";
    const page = await openHome();
    assert.equal(await page.getAttribute("#activity-gallery", "data-source"), "live");
    const firstImage = page.locator("#activity-gallery figure").first();
    assert.match((await firstImage.locator("img").getAttribute("src")) ?? "", new RegExp(`/v1/media/${NEW_ID}$`));
    assert.equal(await firstImage.locator("figcaption").innerText(), "ערב לימוד חדש");
    assert.match((await page.locator("#notices-list li").first().locator("img").getAttribute("src")) ?? "", new RegExp(NOTICE_ID));
    assert.ok((await legacyIds(page)).length >= 3, "legacy gallery photos and notice are still there");
    await page.context().close();
  });

  test("a legacy photo hidden by the admin is removed", async () => {
    mode = "ok";
    const all = await legacyIds(await openHome());
    hiddenLegacyId = all.find((id) => id.startsWith("activity:")) ?? "";
    assert.ok(hiddenLegacyId);
    const page = await openHome();
    assert.equal((await legacyIds(page)).includes(hiddenLegacyId), false);
    assert.equal((await legacyIds(page)).length, all.length - 1);
    await page.context().close();
    hiddenLegacyId = "";
  });

  test("API down: the page stays exactly as built", async () => {
    mode = "error";
    const page = await openHome();
    assert.equal(await page.getAttribute("#activity-gallery", "data-source"), "static");
    assert.equal(await page.locator(`img[src*="/v1/media/"]`).count(), 0);
    assert.ok((await legacyIds(page)).length >= 3);
    await page.context().close();
  });

  test("JavaScript off: the built page, nothing added", async () => {
    mode = "ok";
    const page = await openHome({ javaScriptEnabled: false });
    assert.equal(await page.locator(`img[src*="/v1/media/"]`).count(), 0);
    assert.ok((await legacyIds(page)).length >= 3);
    await page.context().close();
  });

  test("a caption with HTML is shown as text", async () => {
    mode = "hostile";
    const page = await openHome();
    assert.match(await page.locator("#activity-gallery figcaption").first().innerText(), /<img src=x/);
    assert.equal(await page.evaluate(() => (globalThis as { pwned?: number }).pwned), undefined);
    await page.context().close();
  });
});

/**
 * Browser tests for the image carousel (P7.3). Builds the site with no API
 * (as it ships by default), serves it, and drives the installed Chrome on
 * the real home page and on test pages with 0, 1, 3 and 50 slides that use
 * the built stylesheet and script.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import path from "node:path";
import { after, before, describe, test } from "node:test";
import { promisify } from "node:util";
import { chromium, type Browser, type Page } from "playwright-core";

const execFileAsync = promisify(execFile);
const projectRoot = process.cwd();
const dist = path.join(projectRoot, ".cache", "e2e-dist-carousel");
const axeSource = await readFile(createRequire(import.meta.url).resolve("axe-core/axe.min.js"), "utf8");

let server: Server;
let browser: Browser;
let origin: string;

function testPage(count: number, autoplayMs: number): string {
  const slides = Array.from(
    { length: count },
    (_, index) => `<figure class="activity-figure"><img class="activity-image" src="/assets/generated/images/logo.png?n=${index}" width="400" height="300" alt="תמונה ${index + 1}" loading="lazy"><figcaption class="activity-caption">תמונה ${index + 1}</figcaption></figure>`,
  ).join("");
  return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>בדיקת קרוסלה</title><link rel="stylesheet" href="/assets/styles/site.css"></head>
<body><main><section class="section band-primary"><div class="container"><h2 id="h">גלריה</h2>
<div class="carousel" data-carousel data-autoplay-ms="${autoplayMs}" aria-labelledby="h"><div class="activity-grid carousel-track">${slides}</div></div>
</div></section><div style="height:150vh"></div></main><script type="module" src="/assets/client/carousel.js"></script></body></html>`;
}

before(async () => {
  await execFileAsync(process.execPath, [path.join(".cache", "build", "build", "build.js")], {
    cwd: projectRoot,
    env: { ...process.env, SITE_DIST_DIR: dist, PUBLIC_API_ORIGIN: "" },
  });
  server = createServer(async (request, response) => {
    const url = new URL(request.url ?? "/", "http://x");
    if (url.pathname === "/__carousel") {
      response.writeHead(200, { "Content-Type": "text/html; charset=utf-8" }).end(testPage(Number(url.searchParams.get("n")), Number(url.searchParams.get("ms") ?? 6000)));
      return;
    }
    let filePath = path.join(dist, decodeURIComponent(url.pathname));
    if (!filePath.startsWith(dist)) {
      response.writeHead(403).end();
      return;
    }
    if ((await stat(filePath).catch(() => null))?.isDirectory()) {
      filePath = path.join(filePath, "index.html");
    }
    try {
      const body = await readFile(filePath);
      const type = filePath.endsWith(".html") ? "text/html; charset=utf-8" : filePath.endsWith(".js") ? "text/javascript" : filePath.endsWith(".css") ? "text/css" : filePath.endsWith(".png") ? "image/png" : filePath.endsWith(".woff2") ? "font/woff2" : "application/octet-stream";
      response.writeHead(200, { "Content-Type": type }).end(body);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  browser = await chromium.launch({ channel: "chrome", headless: true });
});

after(async () => {
  await browser?.close();
  server?.close();
});

async function open(count: number, options: { ms?: number; reducedMotion?: boolean; width?: number } = {}): Promise<Page> {
  const context = await browser.newContext({ viewport: { width: options.width ?? 1280, height: 900 }, reducedMotion: options.reducedMotion ? "reduce" : "no-preference" });
  const page = await context.newPage();
  await page.goto(`${origin}/__carousel?n=${count}&ms=${options.ms ?? 60_000}`);
  await page.waitForSelector("[data-carousel][data-count]");
  return page;
}

const index = (page: Page) => page.getAttribute("[data-carousel]", "data-index");

describe("carousel with 0, 1, 3 and 50 slides", () => {
  test("0 slides: no controls, no errors", async () => {
    const page = await open(0);
    assert.equal(await page.isVisible(".carousel-controls"), false);
    assert.equal(await page.getAttribute("[data-carousel]", "data-autoplay"), "off");
    await page.context().close();
  });

  test("1 slide: no controls and nothing moves", async () => {
    const page = await open(1, { ms: 200 });
    assert.equal(await page.isVisible(".carousel-controls"), false);
    assert.equal(await page.getAttribute("[data-carousel]", "data-autoplay"), "off");
    await page.context().close();
  });

  test("3 slides: next, previous and wrap-around, announced for screen readers", async () => {
    const page = await open(3);
    assert.equal(await page.isVisible(".carousel-controls"), true);
    await page.click(".carousel-next");
    await page.waitForTimeout(600);
    assert.equal(await index(page), "2");
    assert.equal(await page.locator("[data-carousel] [aria-live]").innerText(), "תמונה 2 מתוך 3");
    await page.click(".carousel-previous");
    await page.waitForTimeout(600);
    await page.click(".carousel-previous");
    await page.waitForTimeout(600);
    assert.equal(await index(page), "3", "previous from the first slide wraps to the last");
    assert.equal(await page.getAttribute(".activity-figure >> nth=1", "aria-label"), "2 מתוך 3");
    await page.context().close();
  });

  test("3 slides: arrow keys follow the reading direction (RTL: left = next)", async () => {
    const page = await open(3);
    await page.focus(".carousel-track");
    await page.keyboard.press("ArrowLeft");
    await page.waitForTimeout(600);
    assert.equal(await index(page), "2");
    await page.keyboard.press("End");
    await page.waitForTimeout(600);
    assert.equal(await index(page), "3");
    await page.keyboard.press("Home");
    await page.waitForTimeout(600);
    assert.equal(await index(page), "1");
    await page.context().close();
  });

  test("50 slides: only nearby images load, and the last one is reachable", async () => {
    const page = await open(50, { width: 360 });
    await page.waitForTimeout(800);
    const loaded = await page.$$eval("img.activity-image", (images) => images.filter((image) => (image as unknown as { complete: boolean; naturalWidth: number }).naturalWidth > 0).length);
    assert.ok(loaded < 50, `lazy loading: ${loaded} of 50 loaded up front`);
    await page.focus(".carousel-track");
    await page.keyboard.press("End");
    await page.waitForTimeout(1200);
    assert.equal(await index(page), "50");
    await page.context().close();
  });

  test("the track scrolls and snaps without the script (touch and trackpad)", async () => {
    const page = await open(3, { width: 360 });
    const style = await page.$eval(".carousel-track", (track) => {
      const computed = (globalThis as unknown as { getComputedStyle(node: unknown): { scrollSnapType: string; overflowX: string } }).getComputedStyle(track);
      const box = track as unknown as { scrollWidth: number; clientWidth: number };
      return { snap: computed.scrollSnapType, overflow: computed.overflowX, scrollable: box.scrollWidth > box.clientWidth };
    });
    assert.match(style.snap, /mandatory/);
    assert.equal(style.overflow, "auto");
    assert.equal(style.scrollable, true);
    await page.context().close();
  });
});

describe("auto-advance", () => {
  test("advances on its own, and the pause button stops it", async () => {
    const page = await open(3, { ms: 400 });
    await page.mouse.move(0, 0);
    await page.waitForTimeout(1300);
    assert.notEqual(await index(page), null, "moved by itself");
    await page.click(".carousel-pause");
    assert.equal(await page.getAttribute(".carousel-pause", "aria-pressed"), "true");
    await page.mouse.move(0, 0);
    const pausedAt = await index(page);
    await page.waitForTimeout(1300);
    assert.equal(await index(page), pausedAt);
    assert.equal(await page.getAttribute("[data-carousel]", "data-autoplay"), "off");
    await page.context().close();
  });

  test("with prefers-reduced-motion it never moves and has no pause button", async () => {
    const page = await open(3, { ms: 200, reducedMotion: true });
    await page.waitForTimeout(900);
    assert.equal(await index(page), null);
    assert.equal(await page.isVisible(".carousel-pause"), false);
    await page.context().close();
  });

  test("hovering the carousel holds it still", async () => {
    const page = await open(3, { ms: 300 });
    await page.hover(".carousel-track");
    assert.equal(await page.getAttribute("[data-carousel]", "data-autoplay"), "off");
    await page.context().close();
  });
});

describe("on the real home page", () => {
  test("the gallery is a carousel, with no layout shift and no serious accessibility issues", async () => {
    const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await page.addInitScript(() => {
      const scope = globalThis as unknown as { __cls: number; PerformanceObserver: new (cb: (list: { getEntries(): { value: number; hadRecentInput: boolean }[] }) => void) => { observe(o: object): void } };
      scope.__cls = 0;
      new scope.PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) scope.__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    await page.goto(`${origin}/`, { waitUntil: "networkidle" });
    await page.keyboard.press("Escape");
    await page.waitForSelector("[data-carousel][data-count]");
    assert.ok(Number(await page.getAttribute("[data-carousel]", "data-count")) >= 2);
    const cls = await page.evaluate(() => (globalThis as unknown as { __cls: number }).__cls);
    assert.ok(cls < 0.1, `CLS ${cls}`);

    await page.addScriptTag({ content: axeSource });
    const violations = await page.evaluate(async () => {
      const axe = (globalThis as unknown as { axe: { run(context: string, options: object): Promise<{ violations: { id: string; impact: string; nodes: unknown[] }[] }> } }).axe;
      const result = await axe.run("[data-carousel]", { resultTypes: ["violations"] });
      return result.violations.filter((violation) => violation.impact === "serious" || violation.impact === "critical").map((violation) => `${violation.id} (${violation.nodes.length})`);
    });
    assert.deepEqual(violations, []);
    await context.close();
  });
});

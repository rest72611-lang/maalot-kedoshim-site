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

const VIDEO_IDS = ["01JEXAMPLE0000000000000V01", "01JEXAMPLE0000000000000V02"];

type Mode = "ok" | "error" | "hostile";
let mode: Mode = "ok";
let withVideos = false;
type PopupMode = "missing" | "none" | "legacy" | "media" | "error";
let popupMode: PopupMode = "missing";
const POPUP_MEDIA_ID = "01JEXAMPLE00000000000POPUP";
let hiddenLegacyId = "";
let png: Buffer;
let mp4: Buffer;

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
      ...(withVideos
        ? VIDEO_IDS.map((id, index) => ({ id, kind: "video", placement: "video", width: 160, height: 90, caption: `סרטון ${index + 1}`, publishedAt: "2027-01-10T10:00:00Z", url: `/v1/media/${id}` }))
        : []),
    ],
    hiddenLegacyIds: hiddenLegacyId ? [hiddenLegacyId] : [],
  };
}

before(async () => {
  apiServer = createServer((request, response) => {
    const headers = { "Access-Control-Allow-Origin": "*" };
    if (mode === "error") {
      response.writeHead(500, headers).end("{}");
    } else if (request.url === "/v1/popup") {
      if (popupMode === "missing") {
        response.writeHead(404, headers).end();
      } else if (popupMode === "error") {
        response.writeHead(500, headers).end("{}");
      } else {
        const popup =
          popupMode === "legacy"
            ? { source: "legacy", legacyId: "popup:popup.pdf", changedAt: "2027-01-12T10:00:00Z" }
            : popupMode === "media"
              ? { source: "media", id: POPUP_MEDIA_ID, url: `/v1/media/${POPUP_MEDIA_ID}`, width: 92, height: 92, caption: "מודעה חדשה", changedAt: "2027-01-12T11:00:00Z" }
              : null;
        response.writeHead(200, { ...headers, "Content-Type": "application/json" }).end(JSON.stringify({ popup }));
      }
    } else if (request.url === "/v1/media-feed") {
      response.writeHead(200, { ...headers, "Content-Type": "application/json" }).end(JSON.stringify(feed()));
    } else if (request.url?.startsWith("/v1/media/01JEXAMPLE0000000000000V")) {
      response.writeHead(200, { ...headers, "Content-Type": "video/mp4" }).end(mp4);
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
  mp4 = await readFile(path.join(projectRoot, "test", "e2e", "fixtures", "sample.mp4"));

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

async function openHome(options: { javaScriptEnabled?: boolean; reducedMotion?: boolean; blockAutoplay?: boolean } = {}): Promise<Page> {
  const context = await browser.newContext({ javaScriptEnabled: options.javaScriptEnabled ?? true, reducedMotion: options.reducedMotion ? "reduce" : "no-preference" });
  if (options.blockAutoplay) {
    // What a browser that refuses autoplay does: play() rejects.
    await context.addInitScript(() => {
      const proto = (globalThis as unknown as { HTMLMediaElement: { prototype: { play: () => Promise<void> } } }).HTMLMediaElement.prototype;
      proto.play = () => Promise.reject(new Error("NotAllowedError"));
    });
  }
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

type VideoLike = { paused: boolean; muted: boolean; playsInline: boolean; play(): Promise<void> };

describe("video carousel (P7.4)", () => {
  async function openWithVideos(options: { reducedMotion?: boolean; blockAutoplay?: boolean } = {}): Promise<Page> {
    mode = "ok";
    withVideos = true;
    const page = await openHome(options);
    await page.locator("#videos-section").scrollIntoViewIfNeeded();
    return page;
  }

  test("without videos in the feed the section stays hidden", async () => {
    withVideos = false;
    const page = await openHome();
    assert.equal(await page.isVisible("#videos-section"), false);
    await page.context().close();
  });

  test("with videos: the section appears, with native controls, muted, nothing preloaded off screen", async () => {
    mode = "ok";
    withVideos = true;
    // The section is far below the fold on load: nothing should be fetched yet.
    const page = await openHome({ reducedMotion: true });
    await page.waitForSelector("#videos-section:not([hidden])", { state: "attached" });
    assert.deepEqual(await page.$$eval("#video-track video", (videos) => videos.map((video) => video.getAttribute("preload"))), ["none", "none"]);
    await page.locator("#videos-section").scrollIntoViewIfNeeded();
    assert.equal(await page.isVisible("#videos-section"), true);
    assert.equal(await page.locator("#video-track video").count(), 2);
    const attributes = await page.$eval("#video-track video", (video) => ({
      controls: video.hasAttribute("controls"),
      muted: (video as unknown as VideoLike).muted,
      playsinline: (video as unknown as VideoLike).playsInline,
    }));
    assert.deepEqual(attributes, { controls: true, muted: true, playsinline: true });
    // On screen it loads just the metadata (the observer fires asynchronously).
    await page.waitForSelector("#video-track video[preload='metadata']", { state: "attached", timeout: 5000 });
    await page.context().close();
  });

  test("on screen, a video is asked to play; when one plays, the others pause", async () => {
    // Whether a headless browser can actually decode the clip depends on the
    // platform's codecs, so this checks what our code does: it calls play()
    // on the visible video, and pauses the others when one starts playing.
    mode = "ok";
    withVideos = true;
    const context = await browser.newContext();
    await context.addInitScript(() => {
      const scope = globalThis as unknown as { __calls: string[]; HTMLMediaElement: { prototype: { play(): Promise<void>; pause(): void } } };
      scope.__calls = [];
      const proto = scope.HTMLMediaElement.prototype;
      const label = (element: unknown) => (element as { getAttribute(name: string): string | null }).getAttribute("aria-label") ?? "";
      proto.play = function (this: unknown) {
        scope.__calls.push(`play:${label(this)}`);
        return Promise.resolve();
      };
      proto.pause = function (this: unknown) {
        scope.__calls.push(`pause:${label(this)}`);
      };
    });
    const page = await context.newPage();
    await page.goto(`${siteOrigin}/`);
    await page.waitForSelector("#activity-gallery[data-source]");
    await page.locator("#videos-section").scrollIntoViewIfNeeded();
    const calls = () => page.evaluate(() => (globalThis as unknown as { __calls: string[] }).__calls);
    await page.waitForFunction(() => (globalThis as unknown as { __calls: string[] }).__calls.includes("play:סרטון 1"), undefined, { timeout: 5000 });

    // Pretend the first video is playing, then start the second one.
    await page.$eval("#video-track video", (video) => Object.defineProperty(video, "paused", { value: false, configurable: true }));
    await page.$eval("#video-track video >> nth=1", (video) => video.dispatchEvent(new Event("play")));
    assert.ok((await calls()).includes("pause:סרטון 1"), (await calls()).join(", "));
    await context.close();
  });

  test("when a video ends, the carousel moves to the next one", async () => {
    const page = await openWithVideos({ reducedMotion: true });
    const before = await page.$eval("#video-track", (track) => (track as unknown as { scrollLeft: number }).scrollLeft);
    await page.$eval("#video-track video", (video) => video.dispatchEvent(new Event("ended")));
    await page.waitForTimeout(500);
    const after = await page.$eval("#video-track", (track) => (track as unknown as { scrollLeft: number }).scrollLeft);
    assert.notEqual(after, before);
    await page.context().close();
  });

  test("if the browser blocks autoplay, the video waits for the play button", async () => {
    const page = await openWithVideos({ blockAutoplay: true });
    await page.waitForSelector("#video-track video[data-autoplay='blocked']", { timeout: 5000 });
    assert.equal(await page.$eval("#video-track video", (video) => (video as unknown as VideoLike).paused), true);
    assert.equal(await page.$eval("#video-track video", (video) => video.hasAttribute("controls")), true);
    await page.context().close();
  });

  test("with prefers-reduced-motion nothing plays by itself", async () => {
    const page = await openWithVideos({ reducedMotion: true });
    await page.waitForTimeout(800);
    assert.equal(await page.$eval("#video-track video", (video) => (video as unknown as VideoLike).paused), true);
    await page.context().close();
  });
});

describe("single popup from the API (P7.6)", () => {
  async function openWithPopup(mode: PopupMode, context?: Awaited<ReturnType<Browser["newContext"]>>): Promise<Page> {
    popupMode = mode;
    withVideos = false;
    const ctx = context ?? (await browser.newContext());
    const page = await ctx.newPage();
    await page.goto(`${siteOrigin}/`);
    await page.waitForSelector("#popup-dialog[data-state]", { state: "attached", timeout: 10_000 });
    return page;
  }

  test("a legacy popup: exactly one image, from the site's own manifest", async () => {
    const page = await openWithPopup("legacy");
    assert.equal(await page.getAttribute("#popup-dialog", "data-state"), "open");
    assert.equal(await page.locator("#popup-dialog img").count(), 1);
    assert.match((await page.getAttribute("#popup-dialog img", "src")) ?? "", /\/assets\/popup\/popup\.jpg/);
    await page.context().close();
  });

  test("a media popup: one image from the API", async () => {
    const page = await openWithPopup("media");
    assert.equal(await page.locator("#popup-dialog img").count(), 1);
    assert.match((await page.getAttribute("#popup-dialog img", "src")) ?? "", new RegExp(`/v1/media/${POPUP_MEDIA_ID}$`));
    assert.equal(await page.getAttribute("#popup-dialog img", "alt"), "מודעה חדשה");
    await page.context().close();
  });

  for (const mode of ["none", "error", "missing"] as const) {
    test(`popup ${mode}: nothing opens, and no built-in popup is used instead`, async () => {
      const page = await openWithPopup(mode);
      assert.equal(await page.getAttribute("#popup-dialog", "data-state"), "none");
      assert.equal(await page.$eval("#popup-dialog", (dialog) => dialog.hasAttribute("open")), false);
      assert.equal(await page.locator("#popup-dialog img").count(), 0);
      await page.context().close();
    });
  }

  test("each popup is shown once per visitor; Escape closes it and returns focus", async () => {
    const context = await browser.newContext();
    const first = await openWithPopup("legacy", context);
    await first.waitForFunction(() => (globalThis as unknown as { document: { querySelector(s: string): { open: boolean } } }).document.querySelector("#popup-dialog").open);
    await first.keyboard.press("Escape");
    await first.waitForFunction(() => !(globalThis as unknown as { document: { querySelector(s: string): { open: boolean } } }).document.querySelector("#popup-dialog").open);
    await first.close();
    const second = await openWithPopup("legacy", context);
    assert.equal(await second.getAttribute("#popup-dialog", "data-state"), "seen");
    await context.close();
  });

  test("the whole home page has no serious or critical accessibility violations", async () => {
    popupMode = "none";
    withVideos = true;
    const page = await openHome();
    await page.addScriptTag({ path: path.join(projectRoot, "node_modules", "axe-core", "axe.min.js") });
    const violations = await page.evaluate(async () => {
      const axe = (globalThis as unknown as { axe: { run(options: object): Promise<{ violations: { id: string; impact: string; nodes: { target: string[]; any: { message: string }[] }[] }[] }> } }).axe;
      const result = await axe.run({ resultTypes: ["violations"] });
      return result.violations
        .filter((v) => v.impact === "serious" || v.impact === "critical")
        .flatMap((v) => v.nodes.map((node) => `${v.id}: ${node.target.join(" ")}: ${node.any[0]?.message ?? ""}`));
    });
    assert.deepEqual(violations, []);
    await page.context().close();
  });
});

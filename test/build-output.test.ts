/**
 * Verifies the built site in `dist/` — the exact output that deploy.yml
 * publishes — rather than the source that produces it. Run `npm run build`
 * first; these tests read `dist/` and never rebuild it.
 *
 * Nothing here depends on the current date or on directory listing order.
 */
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { describe, test } from "node:test";
import { promisify } from "node:util";
import {
  getPrayerSchedule,
  validatePrayerSchedule,
  type PrayerSchedule,
} from "../src/data/prayer-times.ts";

const execFileAsync = promisify(execFile);

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");

// The public contract of the live site. Hard-coded on purpose: deriving it
// from src/data/site.ts would let a wrong config value pass the test.
const PRODUCTION_ORIGIN = "https://maalotkedoshim.co.il";
const PAGES = [
  { route: "/", file: "index.html" },
  { route: "/zmanim/", file: path.join("zmanim", "index.html") },
] as const;
const SEARCH_CONSOLE_FILE = "google9320aa7512ef0293.html";
const DONATION_PDF = path.join("assets", "donations", "salvation-story.pdf");

if (!existsSync(distDir)) {
  throw new Error(`dist/ not found at ${distDir}. Run "npm run build" before "npm test".`);
}

async function readDistText(relativePath: string): Promise<string> {
  return readFile(path.join(distDir, relativePath), "utf8");
}

async function assertDistFileExists(relativePath: string, context: string): Promise<void> {
  const fullPath = path.join(distDir, relativePath);
  const info = await stat(fullPath).catch(() => null);
  assert.ok(info?.isFile(), `${context}: expected file dist/${relativePath.replaceAll("\\", "/")} to exist`);
}

/** Maps a site URL path such as "/zmanim/" or "/assets/a%20b.png?v=1" to a dist-relative file. */
function urlPathToDistFile(urlPath: string): string {
  const withoutQuery = urlPath.split(/[?#]/, 1)[0] ?? "";
  const decoded = decodeURIComponent(withoutQuery).replace(/^\//, "");
  return decoded === "" || decoded.endsWith("/") ? `${decoded}index.html` : decoded;
}

/** Every root-relative `src`/`href` in the page, i.e. everything served from this site. */
function localReferences(html: string): string[] {
  const references = new Set<string>();
  for (const match of html.matchAll(/\s(?:src|href)="(\/[^"]*)"/g)) {
    const value = match[1];
    if (value !== undefined && !value.startsWith("//")) {
      references.add(value.replaceAll("&amp;", "&"));
    }
  }
  return [...references].sort();
}

function canonicalHrefs(html: string): string[] {
  return [...html.matchAll(/<link\s+rel="canonical"\s+href="([^"]*)"/g)].map((match) => match[1] ?? "");
}

function firstMatch(html: string, pattern: RegExp): string | undefined {
  return pattern.exec(html)?.[1]?.trim();
}

describe("HTML pages", () => {
  for (const page of PAGES) {
    describe(page.route, () => {
      test("is a complete Hebrew RTL document with a title and a single h1", async () => {
        await assertDistFileExists(page.file, page.route);
        const html = await readDistText(page.file);

        assert.match(html, /^<!doctype html>/i, "must start with a doctype");
        assert.match(html, /<html lang="he" dir="rtl">/, "must declare Hebrew and RTL");
        assert.match(html, /<\/html>\s*$/, "must be a complete document");
        assert.ok(firstMatch(html, /<title>([^<]*)<\/title>/), "must have a non-empty <title>");
        assert.ok(firstMatch(html, /<meta name="description" content="([^"]*)">/), "must have a meta description");
        assert.equal([...html.matchAll(/<h1[\s>]/g)].length, 1, "must have exactly one <h1>");
      });

      test("every local src/href points to a file that exists in dist", async () => {
        const html = await readDistText(page.file);
        const references = localReferences(html);
        assert.ok(references.length > 0, "page should reference at least its stylesheet");

        for (const reference of references) {
          await assertDistFileExists(urlPathToDistFile(reference), `${page.route} references ${reference}`);
        }
      });

      test("has exactly one canonical link pointing to its production URL", async () => {
        const html = await readDistText(page.file);
        assert.deepEqual(canonicalHrefs(html), [`${PRODUCTION_ORIGIN}${page.route}`]);
      });

      test("the meta description does not promise daily zmanim, which the site does not show", async () => {
        const html = await readDistText(page.file);
        const description = firstMatch(html, /<meta name="description" content="([^"]*)">/) ?? "";
        assert.doesNotMatch(description, /זמני היום/);
      });

      test("the footer has no phone number or tel: link", async () => {
        const html = await readDistText(page.file);
        const footer = firstMatch(html, /<footer class="site-footer">([\s\S]*?)<\/footer>/);
        assert.ok(footer, "must have a site footer");
        assert.doesNotMatch(footer, /tel:/);
        assert.doesNotMatch(footer, /\d{3}-?\d{3}-?\d{4}/);
      });
    });
  }

  test("the prayer-times page shows every regular weekday prayer with its time", async () => {
    const html = await readDistText(path.join("zmanim", "index.html"));
    const { regularWeekdays } = getPrayerSchedule();
    assert.ok(regularWeekdays.length > 0);

    for (const prayer of regularWeekdays) {
      const item = new RegExp(
        `<span class="schedule-name">${escapeRegExp(prayer.name)}</span>\\s*` +
          `<time class="schedule-time" dir="ltr" datetime="${prayer.time}">${prayer.time}</time>`,
      );
      assert.match(html, item, `missing "${prayer.name}" at ${prayer.time}`);
    }
  });

  test("the home page links to the donation PDF", async () => {
    const html = await readDistText("index.html");
    const pdfHref = `/${DONATION_PDF.split(path.sep).join("/")}`;
    assert.ok(localReferences(html).includes(pdfHref), `expected a link to ${pdfHref}`);
  });
});

describe("robots.txt", () => {
  test("allows crawling and declares the production sitemap", async () => {
    await assertDistFileExists("robots.txt", "robots.txt");
    const lines = (await readDistText("robots.txt")).split("\n").filter((line) => line.length > 0);

    assert.deepEqual(lines, ["User-agent: *", "Allow: /", `Sitemap: ${PRODUCTION_ORIGIN}/sitemap.xml`]);
  });
});

describe("sitemap.xml", () => {
  test("is a valid urlset listing exactly the site's pages, each of which exists", async () => {
    await assertDistFileExists("sitemap.xml", "sitemap.xml");
    const xml = await readDistText("sitemap.xml");

    assert.match(xml, /^<\?xml version="1\.0" encoding="UTF-8"\?>\n/);
    assert.match(xml, /<urlset xmlns="http:\/\/www\.sitemaps\.org\/schemas\/sitemap\/0\.9">/);
    assert.match(xml, /<\/urlset>\s*$/);

    const locations = [...xml.matchAll(/<url><loc>([^<]*)<\/loc><\/url>/g)].map((match) => match[1] ?? "");
    assert.deepEqual(
      [...locations].sort(),
      PAGES.map((page) => `${PRODUCTION_ORIGIN}${page.route}`).sort(),
    );

    for (const location of locations) {
      assert.ok(location.startsWith(`${PRODUCTION_ORIGIN}/`), `${location} must be on the production origin`);
      const route = location.slice(PRODUCTION_ORIGIN.length);
      await assertDistFileExists(urlPathToDistFile(route), `sitemap entry ${location}`);
    }
  });
});

describe("Google Search Console verification", () => {
  test("serves the exact verification file content", async () => {
    await assertDistFileExists(SEARCH_CONSOLE_FILE, "Search Console verification");
    assert.equal(
      await readDistText(SEARCH_CONSOLE_FILE),
      `google-site-verification: ${SEARCH_CONSOLE_FILE}\n`,
    );
  });
});

describe("donation PDF", () => {
  test("is a non-empty PDF, byte-identical to its source asset", async () => {
    await assertDistFileExists(DONATION_PDF, "donation PDF");
    const built = await readFile(path.join(distDir, DONATION_PDF));
    const source = await readFile(path.join(projectRoot, DONATION_PDF));

    assert.ok(built.length > 0, "must not be empty");
    assert.equal(built.subarray(0, 5).toString("latin1"), "%PDF-", "must start with the PDF header");
    assert.ok(built.subarray(-1024).toString("latin1").includes("%%EOF"), "must end with an EOF marker");
    assert.ok(built.equals(source), "must be byte-identical to assets/donations/salvation-story.pdf");
  });

  test("opens in pdfinfo and has at least one page", async () => {
    const { stdout } = await execFileAsync("pdfinfo", [path.join(distDir, DONATION_PDF)]);
    const pages = Number.parseInt(/^Pages:\s+(\d+)/m.exec(stdout)?.[1] ?? "", 10);
    assert.ok(pages >= 1, `expected at least one page, pdfinfo reported: ${stdout}`);
  });
});

describe("prayer schedule validation", () => {
  // Each case breaks one field of a copy of the real schedule, so the tests
  // track the actual data shape without depending on any particular date.
  function mutatedSchedule(mutate: (schedule: PrayerSchedule) => void): PrayerSchedule {
    const copy = structuredClone(getPrayerSchedule());
    mutate(copy);
    return copy;
  }

  function firstHolidayDay(schedule: PrayerSchedule) {
    const day = schedule.holidays[0]?.days[0];
    assert.ok(day, "the schedule needs at least one holiday day for these cases");
    return day;
  }

  function firstWeekdayPrayer(schedule: PrayerSchedule) {
    const prayer = schedule.regularWeekdays[0];
    assert.ok(prayer, "the schedule needs at least one weekday prayer for these cases");
    return prayer;
  }

  test("accepts the real schedule", () => {
    assert.doesNotThrow(() => validatePrayerSchedule(getPrayerSchedule()));
  });

  test("accepts a holiday event without a time", () => {
    const schedule = mutatedSchedule((s) => {
      const event = firstHolidayDay(s).events[0];
      assert.ok(event);
      event.time = null;
    });
    assert.doesNotThrow(() => validatePrayerSchedule(schedule));
  });

  const invalidCases: { name: string; mutate: (schedule: PrayerSchedule) => void; path: RegExp }[] = [
    { name: "hour out of range (25:00)", mutate: (s) => { firstWeekdayPrayer(s).time = "25:00"; }, path: /regularWeekdays\[0\]\.time/ },
    { name: "minute out of range (12:60)", mutate: (s) => { firstWeekdayPrayer(s).time = "12:60"; }, path: /regularWeekdays\[0\]\.time/ },
    { name: "unpadded hour (7:30)", mutate: (s) => { firstWeekdayPrayer(s).time = "7:30"; }, path: /regularWeekdays\[0\]\.time/ },
    { name: "12-hour format (06:15 PM)", mutate: (s) => { firstWeekdayPrayer(s).time = "06:15 PM"; }, path: /regularWeekdays\[0\]\.time/ },
    { name: "blank prayer name", mutate: (s) => { firstWeekdayPrayer(s).name = "   "; }, path: /regularWeekdays\[0\]\.name/ },
    { name: "blank holiday title", mutate: (s) => { const holiday = s.holidays[0]; assert.ok(holiday); holiday.title = ""; }, path: /holidays\[0\]\.title/ },
    { name: "blank Hebrew date", mutate: (s) => { firstHolidayDay(s).hebrewDate = ""; }, path: /holidays\[0\]\.days\[0\]\.hebrewDate/ },
    {
      name: "invalid holiday event time",
      mutate: (s) => {
        const event = firstHolidayDay(s).events[0];
        assert.ok(event);
        event.time = "9:00";
      },
      path: /holidays\[0\]\.days\[0\]\.events\[0\]\.time/,
    },
  ];

  for (const invalidCase of invalidCases) {
    test(`rejects ${invalidCase.name}`, () => {
      const schedule = mutatedSchedule(invalidCase.mutate);
      assert.throws(() => validatePrayerSchedule(schedule), (error: unknown) => {
        assert.ok(error instanceof Error);
        assert.match(error.message, /^Prayer schedule validation failed: /);
        assert.match(error.message, invalidCase.path, "error must name the offending field");
        return true;
      });
    });
  }
});

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

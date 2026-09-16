import { cp, mkdir, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { resolveSitePath } from "../paths.js";
import { site } from "../data/site.js";
import { getPrayerSchedule, validatePrayerSchedule } from "../data/prayer-times.js";
import { renderHomePage } from "../templates/home.js";
import { renderPrayerTimesPage } from "../templates/prayer-times.js";
import { buildFixedAssets } from "./fixed-assets.js";
import { processActivityImages } from "./activity.js";
import { processNotices } from "./notices.js";
import { buildPopups } from "./popup.js";

const projectRoot = process.cwd();
const distDir = path.join(projectRoot, "dist");
const assetsDir = path.join(projectRoot, "assets");

type BuildPaths = {
  projectRoot: string;
  distDir: string;
  assetsDir: string;
  basePath: string;
};

const requiredImageAssets = [
  "hero-sign.png",
  "logo.pdf",
  "donation-qr.png",
] as const;

const requiredDonationAssets = ["salvation-story.pdf"] as const;

async function build(): Promise<void> {
  const paths: BuildPaths = { projectRoot, distDir, assetsDir, basePath: site.basePath };

  await cleanDist(paths);
  await validateRequiredAssets(paths);
  await copyFixedAssets(paths);
  await copyDonationAssets(paths);
  await copyStyles(paths);

  const fixedAssets = await buildFixedAssets({
    distDir,
    assetsImagesDir: path.join(assetsDir, "images"),
    assetsDonationsDir: path.join(assetsDir, "donations"),
    basePath: site.basePath,
  });
  const notices = await processNotices(paths);
  const activityImages = await processActivityImages(paths);
  const popups = await buildPopups(paths);
  const prayerSchedule = getPrayerSchedule();
  validatePrayerSchedule(prayerSchedule);

  await writeHtml("index.html", renderHomePage({ site, notices, activityImages, fixedAssets, popups }));
  await writeHtml(
    "zmanim/index.html",
    renderPrayerTimesPage({ site, prayerSchedule, donationStoryCover: fixedAssets.donationStoryCover }),
  );

  await writeRobotsTxt(paths);
  await writeSitemap(paths);
  await writeSearchConsoleVerification(paths);
}

const GOOGLE_SITE_VERIFICATION_FILENAME = "google9320aa7512ef0293.html";
const GOOGLE_SITE_VERIFICATION_CONTENT = `google-site-verification: ${GOOGLE_SITE_VERIFICATION_FILENAME}\n`;

async function writeSearchConsoleVerification({ distDir }: BuildPaths): Promise<void> {
  await writeFile(
    path.join(distDir, GOOGLE_SITE_VERIFICATION_FILENAME),
    GOOGLE_SITE_VERIFICATION_CONTENT,
    "utf8",
  );
}

const SITE_PATHS = ["/", "/zmanim/"] as const;

async function writeRobotsTxt({ distDir }: BuildPaths): Promise<void> {
  const lines = ["User-agent: *", "Allow: /"];

  if (site.productionOrigin) {
    lines.push(`Sitemap: ${site.productionOrigin}${resolveSitePath(site.basePath, "/sitemap.xml")}`);
  }

  await writeFile(path.join(distDir, "robots.txt"), `${lines.join("\n")}\n`, "utf8");
}

async function writeSitemap({ distDir }: BuildPaths): Promise<void> {
  if (!site.productionOrigin) {
    return;
  }

  const origin = site.productionOrigin;
  const urls = SITE_PATHS.map(
    (routePath) => `  <url><loc>${origin}${resolveSitePath(site.basePath, routePath)}</loc></url>`,
  ).join("\n");
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;

  await writeFile(path.join(distDir, "sitemap.xml"), xml, "utf8");
}

async function cleanDist({ distDir }: BuildPaths): Promise<void> {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });
}

async function validateRequiredAssets({ assetsDir }: BuildPaths): Promise<void> {
  const missing: string[] = [];

  for (const fileName of requiredImageAssets) {
    const sourcePath = path.join(assetsDir, "images", fileName);
    if (!(await fileExists(sourcePath))) {
      missing.push(path.relative(projectRoot, sourcePath));
    }
  }

  for (const fileName of requiredDonationAssets) {
    const sourcePath = path.join(assetsDir, "donations", fileName);
    if (!(await fileExists(sourcePath))) {
      missing.push(path.relative(projectRoot, sourcePath));
    }
  }

  if (missing.length > 0) {
    throw new Error(`Missing required source assets: ${missing.join(", ")}`);
  }
}

async function copyFixedAssets({ assetsDir, distDir }: BuildPaths): Promise<void> {
  await cp(path.join(assetsDir, "images"), path.join(distDir, "assets", "images"), {
    recursive: true,
  });
}

async function copyDonationAssets({ assetsDir, distDir }: BuildPaths): Promise<void> {
  await cp(path.join(assetsDir, "donations"), path.join(distDir, "assets", "donations"), {
    recursive: true,
  });
}

async function copyStyles({ distDir }: BuildPaths): Promise<void> {
  await mkdir(path.join(distDir, "assets", "styles"), { recursive: true });
  await cp(
    path.join(projectRoot, "src", "styles", "site.css"),
    path.join(distDir, "assets", "styles", "site.css"),
  );
}

async function writeHtml(relativePath: string, html: string): Promise<void> {
  const outputPath = path.join(distDir, relativePath);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, html, "utf8");
}

async function fileExists(targetPath: string): Promise<boolean> {
  try {
    await stat(targetPath);
    return true;
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

build().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`Build failed: ${message}`);
  process.exitCode = 1;
});

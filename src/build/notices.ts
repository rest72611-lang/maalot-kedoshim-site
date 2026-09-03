import { createHash } from "node:crypto";
import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { toPublicHref } from "../paths.js";
import { readImageDimensions } from "./image-dimensions.js";
import { getPdfPageCount, renderPdfPageToPng } from "./poppler.js";

const NOTICE_RENDER_DPI = 180;

export type NoticePage = {
  index: number;
  width: number;
  height: number;
  src: string;
};

export type NoticeAsset = {
  title: string;
  sourceHref: string;
  pages: NoticePage[];
};

export type NoticePaths = {
  projectRoot: string;
  distDir: string;
  assetsDir: string;
  basePath: string;
};

export async function processNotices({ distDir, assetsDir, basePath }: NoticePaths): Promise<NoticeAsset[]> {
  const sourceDir = path.join(assetsDir, "notices");

  if (!(await pathExists(sourceDir))) {
    return [];
  }

  const originalsOutputDir = path.join(distDir, "assets", "notices");
  const generatedOutputDir = path.join(distDir, "assets", "generated", "notices");
  await mkdir(originalsOutputDir, { recursive: true });
  await mkdir(generatedOutputDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const pdfEntries = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf")
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const notices: NoticeAsset[] = [];

  for (const entry of pdfEntries) {
    const sourcePath = path.join(sourceDir, entry.name);
    await cp(sourcePath, path.join(originalsOutputDir, entry.name));

    const title = path.basename(entry.name, path.extname(entry.name));
    const slug = slugify(title);
    const pageCount = await getPdfPageCount(sourcePath, entry.name);
    const pages = await renderNoticePages({
      sourcePath,
      sourceLabel: entry.name,
      slug,
      pageCount,
      outputDir: generatedOutputDir,
      basePath,
    });

    notices.push({
      title,
      sourceHref: toPublicHref(basePath, ["assets", "notices", entry.name]),
      pages,
    });
  }

  return notices;
}

async function renderNoticePages(options: {
  sourcePath: string;
  sourceLabel: string;
  slug: string;
  pageCount: number;
  outputDir: string;
  basePath: string;
}): Promise<NoticePage[]> {
  const { sourcePath, sourceLabel, slug, pageCount, outputDir, basePath } = options;
  const padWidth = Math.max(2, String(pageCount).length);
  const pages: NoticePage[] = [];

  for (let pageNumber = 1; pageNumber <= pageCount; pageNumber += 1) {
    const paddedIndex = String(pageNumber).padStart(padWidth, "0");
    const fileBaseName = `${slug}-p${paddedIndex}`;
    const outputPrefix = path.join(outputDir, fileBaseName);

    const pngPath = await renderPdfPageToPng({
      sourcePath,
      sourceLabel,
      pageNumber,
      dpi: NOTICE_RENDER_DPI,
      outputPrefix,
    });

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(pngPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(
        `Rendered image for page ${pageNumber} of notice PDF "${sourceLabel}" is invalid: ${message}`,
      );
    }

    pages.push({
      index: pageNumber,
      width: dimensions.width,
      height: dimensions.height,
      src: toPublicHref(basePath, ["assets", "generated", "notices", `${fileBaseName}.png`]),
    });
  }

  return pages;
}

function slugify(value: string): string {
  const base = value
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  if (base.length > 0) {
    return base;
  }

  return `notice-${createHash("sha1").update(value, "utf8").digest("hex").slice(0, 8)}`;
}

async function pathExists(targetPath: string): Promise<boolean> {
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

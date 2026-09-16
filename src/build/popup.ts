import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { toPublicHref } from "../paths.js";
import { readImageDimensions } from "./image-dimensions.js";
import { renderPdfPageToPng } from "./poppler.js";

const POPUP_RENDER_DPI = 200;
const POPUP_IMAGE_ALT = "מודעה מבית הכנסת מעלות קדושים";

export type PopupAsset = {
  src: string;
  width: number;
  height: number;
  alt: string;
  sourceName: string;
};

export type PopupPaths = {
  distDir: string;
  assetsDir: string;
  basePath: string;
};

/**
 * Renders one homepage popup announcement per PDF found directly inside
 * `assets/popup/` (first page of each, sorted by filename). Adding or
 * removing a PDF there and rerunning the build is all that's needed —
 * nothing here is tied to a specific filename or count.
 */
export async function buildPopups({ distDir, assetsDir, basePath }: PopupPaths): Promise<PopupAsset[]> {
  const sourceDir = path.join(assetsDir, "popup");

  if (!(await pathExists(sourceDir))) {
    console.log("Popup skipped: no PDF files found in assets/popup.");
    return [];
  }

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const pdfEntries = entries
    .filter((entry) => entry.isFile() && path.extname(entry.name).toLowerCase() === ".pdf")
    .sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" }));

  if (pdfEntries.length === 0) {
    console.log("Popup skipped: no PDF files found in assets/popup.");
    return [];
  }

  const outputDir = path.join(distDir, "assets", "popup");
  await mkdir(outputDir, { recursive: true });

  const popups: PopupAsset[] = [];
  const usedOutputNames = new Set<string>();

  for (const entry of pdfEntries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputBaseName = deriveOutputBaseName(entry.name, usedOutputNames);
    const outputPrefix = path.join(outputDir, outputBaseName);

    let pngPath: string;
    try {
      pngPath = await renderPdfPageToPng({
        sourcePath,
        sourceLabel: entry.name,
        pageNumber: 1,
        dpi: POPUP_RENDER_DPI,
        outputPrefix,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to render popup PDF "${entry.name}": ${message}`);
    }

    let dimensions: { width: number; height: number };
    try {
      dimensions = await readImageDimensions(pngPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Rendered image for popup PDF "${entry.name}" is invalid: ${message}`);
    }

    const version = await hashFile(pngPath);

    popups.push({
      src: `${toPublicHref(basePath, ["assets", "popup", `${outputBaseName}.png`])}?v=${version}`,
      width: dimensions.width,
      height: dimensions.height,
      alt: POPUP_IMAGE_ALT,
      sourceName: entry.name,
    });
  }

  return popups;
}

/**
 * Turns a source PDF filename into a safe, unique output basename, so two
 * PDFs whose names collide after slugifying (or share a slug outright)
 * never overwrite each other's rendered PNG.
 */
function deriveOutputBaseName(fileName: string, usedOutputNames: Set<string>): string {
  const stem = path.basename(fileName, path.extname(fileName));
  const slug = slugify(stem);

  let candidate = slug;
  let suffix = 2;
  while (usedOutputNames.has(candidate)) {
    candidate = `${slug}-${suffix}`;
    suffix += 1;
  }

  usedOutputNames.add(candidate);
  return candidate;
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

  return `popup-${createHash("sha1").update(value, "utf8").digest("hex").slice(0, 8)}`;
}

async function hashFile(filePath: string): Promise<string> {
  const buffer = await readFile(filePath);
  return createHash("sha1").update(buffer).digest("hex").slice(0, 8);
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

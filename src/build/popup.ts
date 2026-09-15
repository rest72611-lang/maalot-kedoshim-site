import { createHash } from "node:crypto";
import { mkdir, readFile, stat } from "node:fs/promises";
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
};

export type PopupPaths = {
  distDir: string;
  assetsDir: string;
  basePath: string;
};

/**
 * Renders the single homepage popup notice from `assets/popup/popup.pdf`
 * (first page only). Returns null — without failing the build — when the
 * source PDF is absent, so replacing it is a drop-in, code-free operation.
 */
export async function buildPopup({ distDir, assetsDir, basePath }: PopupPaths): Promise<PopupAsset | null> {
  const sourcePath = path.join(assetsDir, "popup", "popup.pdf");

  if (!(await pathExists(sourcePath))) {
    console.log('Popup skipped: no source file found at "assets/popup/popup.pdf".');
    return null;
  }

  const outputDir = path.join(distDir, "assets", "popup");
  await mkdir(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "popup");
  const pngPath = await renderPdfPageToPng({
    sourcePath,
    sourceLabel: "popup.pdf",
    pageNumber: 1,
    dpi: POPUP_RENDER_DPI,
    outputPrefix,
  });

  const dimensions = await readImageDimensions(pngPath);
  const version = await hashFile(pngPath);

  return {
    src: `${toPublicHref(basePath, ["assets", "popup", "popup.png"])}?v=${version}`,
    width: dimensions.width,
    height: dimensions.height,
    alt: POPUP_IMAGE_ALT,
  };
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

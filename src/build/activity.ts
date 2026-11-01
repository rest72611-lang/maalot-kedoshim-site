import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { toPublicHref } from "../paths.js";
import { ACTIVITY_PHOTO_PRESET } from "./image-optimization.js";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export type ActivityImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string;
};

export type ActivityPaths = {
  distDir: string;
  assetsDir: string;
  basePath: string;
};

export async function processActivityImages({
  distDir,
  assetsDir,
  basePath,
}: ActivityPaths): Promise<ActivityImage[]> {
  const sourceDir = path.join(assetsDir, "activity");

  if (!(await pathExists(sourceDir))) {
    return [];
  }

  const outputDir = path.join(distDir, "assets", "activity");
  await mkdir(outputDir, { recursive: true });

  const entries = await readdir(sourceDir, { withFileTypes: true });
  const imageEntries = entries
    .filter((entry) => entry.isFile() && SUPPORTED_EXTENSIONS.has(path.extname(entry.name).toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "en"));

  const images: ActivityImage[] = [];

  for (const entry of imageEntries) {
    const sourcePath = path.join(sourceDir, entry.name);
    const outputName = `${path.basename(entry.name, path.extname(entry.name))}.jpg`;
    const dimensions = await optimizePhoto(sourcePath, path.join(outputDir, outputName), entry.name);
    const caption = deriveCaption(entry.name);

    images.push({
      src: toPublicHref(basePath, ["assets", "activity", outputName]),
      width: dimensions.width,
      height: dimensions.height,
      alt: caption.length > 0 ? caption : ACTIVITY_IMAGE_ALT,
      caption,
    });
  }

  return images;
}

/**
 * Re-encodes a photo as a bounded JPEG. EXIF orientation is applied to the
 * pixels and all metadata (including GPS) is dropped.
 */
async function optimizePhoto(
  sourcePath: string,
  outputPath: string,
  sourceLabel: string,
): Promise<{ width: number; height: number }> {
  const { longEdge, quality } = ACTIVITY_PHOTO_PRESET;

  try {
    const info = await sharp(sourcePath)
      .rotate()
      .resize({ width: longEdge, height: longEdge, fit: "inside", withoutEnlargement: true })
      .jpeg({ quality, mozjpeg: true })
      .toFile(outputPath);

    return { width: info.width, height: info.height };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`Failed to optimize activity photo "${sourceLabel}": ${message}`);
  }
}

const ACTIVITY_IMAGE_ALT = "מהנעשה בבית המדרש בבית הכנסת מעלות קדושים";

function deriveCaption(fileName: string): string {
  const base = path.basename(fileName, path.extname(fileName));
  return base.replace(/\s*\(\d+\)\s*$/, "").trim();
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

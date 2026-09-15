import { cp, mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { toPublicHref } from "../paths.js";
import { readImageDimensions } from "./image-dimensions.js";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png"]);

export type ActivityImage = {
  src: string;
  width: number;
  height: number;
  alt: string;
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
    await cp(sourcePath, path.join(outputDir, entry.name));

    const dimensions = await readImageDimensions(sourcePath);

    images.push({
      src: toPublicHref(basePath, ["assets", "activity", entry.name]),
      width: dimensions.width,
      height: dimensions.height,
      alt: ACTIVITY_IMAGE_ALT,
    });
  }

  return images;
}

const ACTIVITY_IMAGE_ALT = "מהנעשה בבית המדרש בבית הכנסת מעלות קדושים";

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

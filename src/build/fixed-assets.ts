import { mkdir } from "node:fs/promises";
import path from "node:path";
import { toPublicHref } from "../paths.js";
import { readImageDimensions } from "./image-dimensions.js";
import { getPdfPageCount, renderPdfPageToPng } from "./poppler.js";

const LOGO_RENDER_DPI = 300;
const DONATION_STORY_COVER_DPI = 96;

export type FixedAssetImage = {
  url: string;
  width: number;
  height: number;
};

export type FixedAssets = {
  heroSign: FixedAssetImage;
  donationQr: FixedAssetImage;
  logo: FixedAssetImage;
  donationStoryCover: FixedAssetImage;
};

export type FixedAssetPaths = {
  distDir: string;
  assetsImagesDir: string;
  assetsDonationsDir: string;
  basePath: string;
};

export async function buildFixedAssets({
  distDir,
  assetsImagesDir,
  assetsDonationsDir,
  basePath,
}: FixedAssetPaths): Promise<FixedAssets> {
  const [heroSign, donationQr, logo, donationStoryCover] = await Promise.all([
    describeCopiedImage(assetsImagesDir, "hero-sign.png", basePath),
    describeCopiedImage(assetsImagesDir, "donation-qr.png", basePath),
    renderLogoDerivative({ distDir, assetsImagesDir, assetsDonationsDir, basePath }),
    renderDonationStoryCover({ distDir, assetsImagesDir, assetsDonationsDir, basePath }),
  ]);

  return { heroSign, donationQr, logo, donationStoryCover };
}

async function describeCopiedImage(
  assetsImagesDir: string,
  fileName: string,
  basePath: string,
): Promise<FixedAssetImage> {
  const dimensions = await readImageDimensions(path.join(assetsImagesDir, fileName));

  return {
    url: toPublicHref(basePath, ["assets", "images", fileName]),
    width: dimensions.width,
    height: dimensions.height,
  };
}

async function renderLogoDerivative({ distDir, assetsImagesDir, basePath }: FixedAssetPaths): Promise<FixedAssetImage> {
  const sourcePath = path.join(assetsImagesDir, "logo.pdf");
  const sourceLabel = "logo.pdf";

  const pageCount = await getPdfPageCount(sourcePath, sourceLabel);
  if (pageCount !== 1) {
    throw new Error(
      `Official logo PDF "${sourceLabel}" was expected to contain exactly 1 page but has ${pageCount}. ` +
        "Refusing to silently pick a page — update the source asset or the logo rendering step.",
    );
  }

  const outputDir = path.join(distDir, "assets", "generated", "images");
  await mkdir(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "logo");
  const pngPath = await renderPdfPageToPng({
    sourcePath,
    sourceLabel,
    pageNumber: 1,
    dpi: LOGO_RENDER_DPI,
    outputPrefix,
  });

  const dimensions = await readImageDimensions(pngPath);

  return {
    url: toPublicHref(basePath, ["assets", "generated", "images", "logo.png"]),
    width: dimensions.width,
    height: dimensions.height,
  };
}

/**
 * Renders page 1 of the donation salvation-story PDF as a small cover
 * thumbnail for the header's donations preview panel. Always page 1
 * regardless of the document's total page count (unlike the logo, this
 * source PDF legitimately has multiple pages).
 */
async function renderDonationStoryCover({
  distDir,
  assetsDonationsDir,
  basePath,
}: FixedAssetPaths): Promise<FixedAssetImage> {
  const sourcePath = path.join(assetsDonationsDir, "salvation-story.pdf");
  const sourceLabel = "salvation-story.pdf";

  const outputDir = path.join(distDir, "assets", "generated", "images");
  await mkdir(outputDir, { recursive: true });

  const outputPrefix = path.join(outputDir, "donation-story-cover");
  const pngPath = await renderPdfPageToPng({
    sourcePath,
    sourceLabel,
    pageNumber: 1,
    dpi: DONATION_STORY_COVER_DPI,
    outputPrefix,
  });

  const dimensions = await readImageDimensions(pngPath);

  return {
    url: toPublicHref(basePath, ["assets", "generated", "images", "donation-story-cover.png"]),
    width: dimensions.width,
    height: dimensions.height,
  };
}

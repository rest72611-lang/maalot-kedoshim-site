import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import type { ActivityImage } from "./activity.js";
import type { NoticeAsset } from "./notices.js";
import type { PopupAsset } from "./popup.js";

type ImageRef = { src: string; width: number; height: number };

/**
 * One entry per media item that lives in this repository. `legacyId` is
 * stable across builds (placement + source file name), so the admin can
 * hide an item by id without a deploy (plan §3.2, P6.1).
 */
export type LegacyMediaItem =
  | ({ legacyId: string; placement: "gallery"; kind: "image"; caption: string } & ImageRef)
  | { legacyId: string; placement: "notice"; kind: "image"; title: string; sourceHref: string; pages: ImageRef[] }
  | ({ legacyId: string; placement: "popup"; kind: "image" } & ImageRef);

export type LegacyMediaManifest = { version: 1; items: LegacyMediaItem[] };

export function buildLegacyMediaManifest(input: {
  activityImages: ActivityImage[];
  notices: NoticeAsset[];
  popups: PopupAsset[];
}): LegacyMediaManifest {
  const items: LegacyMediaItem[] = [
    ...input.activityImages.map((image) => ({
      legacyId: `activity:${image.sourceName}`,
      placement: "gallery" as const,
      kind: "image" as const,
      caption: image.caption,
      src: image.src,
      width: image.width,
      height: image.height,
    })),
    ...input.notices.map((notice) => ({
      legacyId: `notice:${notice.sourceName}`,
      placement: "notice" as const,
      kind: "image" as const,
      title: notice.title,
      sourceHref: notice.sourceHref,
      pages: notice.pages.map(({ src, width, height }) => ({ src, width, height })),
    })),
    ...input.popups.map((popup) => ({
      legacyId: `popup:${popup.sourceName}`,
      placement: "popup" as const,
      kind: "image" as const,
      src: popup.src,
      width: popup.width,
      height: popup.height,
    })),
  ];

  // Code-unit order, not locale order, so every machine writes the same file.
  items.sort((a, b) => (a.legacyId < b.legacyId ? -1 : a.legacyId > b.legacyId ? 1 : 0));
  return { version: 1, items };
}

export async function writeLegacyMediaManifest(distDir: string, manifest: LegacyMediaManifest): Promise<void> {
  await mkdir(path.join(distDir, "data"), { recursive: true });
  await writeFile(path.join(distDir, "data", "legacy-media.json"), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

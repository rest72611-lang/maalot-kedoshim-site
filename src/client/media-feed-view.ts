/**
 * Merges new media from the platform's public API into the home page
 * (P6.4): hides legacy items the admin hid, and adds published gallery
 * photos and notices. If the API is slow, down or returns something
 * unexpected, the page stays exactly as built. Videos and the popup join
 * with the carousels (P7).
 *
 * Runs only when the build sets PUBLIC_API_ORIGIN.
 */

type FeedItem = {
  id: string;
  kind: "image" | "video";
  placement: "gallery" | "notice" | "video" | "popup";
  width: number | null;
  height: number | null;
  caption: string | null;
  url: string;
};
type Feed = { items: FeedItem[]; hiddenLegacyIds: string[] };

const TIMEOUT_MS = 4000;
const DEFAULT_ALT = "מהנעשה בבית המדרש בבית הכנסת מעלות קדושים";

const gallery = document.getElementById("activity-gallery");
if (gallery) {
  void mergeFeed(gallery);
}

async function mergeFeed(galleryElement: HTMLElement): Promise<void> {
  const origin = galleryElement.dataset["apiOrigin"] ?? "";
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(`${origin}/v1/media-feed`, { signal: controller.signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const feed: unknown = await response.json();
    if (!isFeed(feed)) {
      throw new Error("Unexpected feed shape");
    }

    const hidden = new Set(feed.hiddenLegacyIds);
    for (const element of document.querySelectorAll<HTMLElement>("[data-legacy-id]")) {
      if (hidden.has(element.dataset["legacyId"] ?? "")) {
        element.remove();
      }
    }

    const notices = document.getElementById("notices-list");
    const newGallery: HTMLElement[] = [];
    const newNotices: HTMLElement[] = [];
    for (const item of feed.items) {
      if (item.kind !== "image") {
        continue;
      }
      const image = mediaImage(origin, item);
      if (item.placement === "gallery") {
        const figure = element("figure", "activity-figure", [image]);
        if (item.caption) {
          figure.append(element("figcaption", "activity-caption", [item.caption]));
        }
        newGallery.push(figure);
      } else if (item.placement === "notice") {
        image.className = "notice-image";
        newNotices.push(element("li", null, [element("article", "notice-card", [element("figure", "notice-figure", [image])])]));
      }
    }
    // Newest first, ahead of the legacy items.
    galleryElement.prepend(...newGallery);
    notices?.prepend(...newNotices);
    galleryElement.dataset["source"] = "live";
  } catch {
    galleryElement.dataset["source"] = "static";
  } finally {
    window.clearTimeout(timer);
  }
}

function mediaImage(origin: string, item: FeedItem): HTMLImageElement {
  const image = document.createElement("img");
  image.className = "activity-image";
  image.src = `${origin}${item.url}`;
  image.alt = item.caption ?? DEFAULT_ALT;
  image.loading = "lazy";
  image.decoding = "async";
  if (item.width && item.height) {
    image.width = item.width;
    image.height = item.height;
  }
  return image;
}

/** Text and child nodes only: API text is never parsed as HTML. */
function element(tag: string, className: string | null, children: (Node | string)[]): HTMLElement {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  node.append(...children);
  return node;
}

function isFeed(value: unknown): value is Feed {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    Array.isArray(record["hiddenLegacyIds"]) &&
    record["hiddenLegacyIds"].every((id) => typeof id === "string") &&
    Array.isArray(record["items"]) &&
    record["items"].every((item) => {
      if (typeof item !== "object" || item === null) {
        return false;
      }
      const entry = item as Record<string, unknown>;
      return (
        typeof entry["id"] === "string" &&
        /^\/v1\/media\/[0-9A-Z]{26}$/.test(String(entry["url"])) &&
        (entry["kind"] === "image" || entry["kind"] === "video") &&
        typeof entry["placement"] === "string" &&
        (entry["caption"] === null || typeof entry["caption"] === "string")
      );
    })
  );
}

// A module, so each script keeps its own scope (they load as type="module").
export {};

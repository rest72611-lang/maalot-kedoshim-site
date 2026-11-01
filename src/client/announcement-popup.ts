/**
 * The single home-page popup from the platform API (P7.6, decision Q6):
 * one image, or none. If the API is slow, down or returns nothing usable,
 * no popup is shown: never an old one that the admin already removed.
 * Each popup is shown once per visitor (until the admin changes it).
 *
 * Runs only when the build sets PUBLIC_API_ORIGIN; otherwise the page keeps
 * its built-in popup.
 */

type Popup =
  | { source: "legacy"; legacyId: string; changedAt: string | null }
  | { source: "media"; id: string; url: string; width: number | null; height: number | null; caption: string | null; changedAt: string | null };
type ManifestItem = { legacyId: string; src?: string; width?: number; height?: number };

const TIMEOUT_MS = 4000;
const OPEN_DELAY_MS = 400;
const DEFAULT_ALT = "מודעה מבית הכנסת מעלות קדושים";

const dialog = document.getElementById("popup-dialog") as HTMLDialogElement | null;
if (dialog && typeof dialog.showModal === "function") {
  void showAnnouncement(dialog);
}

async function showAnnouncement(popupDialog: HTMLDialogElement): Promise<void> {
  const origin = popupDialog.dataset["apiOrigin"] ?? "";
  try {
    const { popup } = (await getJson(`${origin}/v1/popup`)) as { popup: unknown };
    const image = isPopup(popup) ? await imageFor(origin, popup) : null;
    if (!image || !isPopup(popup)) {
      popupDialog.dataset["state"] = "none";
      return;
    }
    const seenKey = `popup-seen:${popup.source === "legacy" ? popup.legacyId : popup.id}:${popup.changedAt ?? ""}`;
    if (readFlag(seenKey)) {
      popupDialog.dataset["state"] = "seen";
      return;
    }
    popupDialog.querySelector(".popup-grid")?.replaceChildren(image);
    wireClose(popupDialog);
    window.setTimeout(() => {
      open(popupDialog);
      writeFlag(seenKey);
      popupDialog.dataset["state"] = "open";
    }, OPEN_DELAY_MS);
  } catch {
    popupDialog.dataset["state"] = "none";
  }
}

async function imageFor(origin: string, popup: Popup): Promise<HTMLElement | null> {
  let src: string;
  let width: number | null | undefined;
  let height: number | null | undefined;
  let alt = DEFAULT_ALT;
  if (popup.source === "media") {
    if (!/^\/v1\/media\/[0-9A-Z]{26}$/.test(popup.url)) {
      return null;
    }
    src = `${origin}${popup.url}`;
    ({ width, height } = popup);
    alt = popup.caption ?? DEFAULT_ALT;
  } else {
    // Legacy popups are images this site already publishes; their address
    // comes from the build's own manifest, never from the API.
    const manifest = (await getJson(new URL("data/legacy-media.json", document.baseURI).href)) as { items?: ManifestItem[] };
    const item = manifest.items?.find((candidate) => candidate.legacyId === popup.legacyId);
    if (!item?.src) {
      return null;
    }
    ({ src, width, height } = item);
  }
  const image = document.createElement("img");
  image.className = "popup-image";
  image.src = src;
  image.alt = alt;
  if (width && height) {
    image.width = width;
    image.height = height;
  }
  const figure = document.createElement("figure");
  figure.className = "popup-item";
  figure.append(image);
  return figure;
}

let lastFocused: Element | null = null;
const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

function open(popupDialog: HTMLDialogElement): void {
  lastFocused = document.activeElement;
  document.body.classList.add("popup-open");
  popupDialog.showModal();
  popupDialog.querySelector<HTMLElement>(".popup-close")?.focus();
  if (!reducedMotion()) {
    window.requestAnimationFrame(() => popupDialog.classList.add("popup-visible"));
  }
}

function wireClose(popupDialog: HTMLDialogElement): void {
  const requestClose = () => {
    if (reducedMotion()) {
      popupDialog.close();
      return;
    }
    popupDialog.classList.add("popup-closing");
    popupDialog.classList.remove("popup-visible");
    window.setTimeout(() => popupDialog.close(), 200);
  };
  popupDialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    requestClose();
  });
  popupDialog.addEventListener("close", () => {
    popupDialog.classList.remove("popup-closing", "popup-visible");
    document.body.classList.remove("popup-open");
    if (lastFocused instanceof HTMLElement) {
      lastFocused.focus();
    }
  });
  popupDialog.addEventListener("click", (event) => {
    if (event.target === popupDialog) {
      requestClose();
    }
  });
  popupDialog.querySelector(".popup-close")?.addEventListener("click", requestClose);
}

async function getJson(url: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit", headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return await response.json();
  } finally {
    window.clearTimeout(timer);
  }
}

function isPopup(value: unknown): value is Popup {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  return (
    (record["source"] === "legacy" && typeof record["legacyId"] === "string") ||
    (record["source"] === "media" && typeof record["id"] === "string" && typeof record["url"] === "string")
  );
}

// Storage can be unavailable (private mode, blocked site data): then the
// popup simply shows again next time.
function readFlag(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    window.localStorage.setItem(key, "1");
  } catch {
    // ignore
  }
}

export {};

export type SiteInfo = {
  name: string;
  lang: "he";
  dir: "rtl";
  description: string;
  /**
   * Path the site is served under, e.g. "/" at a domain root or
   * "/REPOSITORY/" for a GitHub Pages project site. Always starts and ends
   * with "/". Configurable via the SITE_BASE_PATH env var at build time
   * (the GitHub Pages workflow sets it from the actual repository name);
   * defaults to "/" for local development.
   */
  basePath: string;
  /**
   * Absolute production origin (e.g. "https://example.org"), no trailing slash.
   * Left unset until a real production domain is approved — canonical links
   * and the sitemap are only emitted once this is set, so no invented or
   * placeholder domain (localhost, example.com, ...) ever reaches output.
   */
  productionOrigin?: string;
  /**
   * Origin of the platform's public API (e.g. "https://maalot-public-api.example.workers.dev"),
   * no trailing slash. Empty = off: the site renders only its static prayer
   * schedule, exactly as before, and ships no client script. Set at build
   * time via the PUBLIC_API_ORIGIN env var.
   */
  publicApiOrigin: string;
};

export const site: SiteInfo = {
  name: "מעלות קדושים",
  lang: "he",
  dir: "rtl",
  description: "אתר רשמי לבית הכנסת מעלות קדושים ברמת גן.",
  basePath: resolveBasePath(),
  productionOrigin: "https://maalotkedoshim.co.il",
  publicApiOrigin: resolvePublicApiOrigin(),
};

function resolvePublicApiOrigin(): string {
  const raw = process.env.PUBLIC_API_ORIGIN?.trim() ?? "";
  if (raw === "") {
    return "";
  }

  // Only https, or plain http to this machine for local testing.
  const url = new URL(raw);
  const isLocal = url.protocol === "http:" && (url.hostname === "localhost" || url.hostname === "127.0.0.1");
  if ((url.protocol !== "https:" && !isLocal) || url.pathname !== "/" || url.search || url.hash) {
    throw new Error(`PUBLIC_API_ORIGIN must be a bare https origin, got "${raw}".`);
  }
  return url.origin;
}

function resolveBasePath(): string {
  const raw = process.env.SITE_BASE_PATH?.trim();

  if (!raw || raw === "/") {
    return "/";
  }

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

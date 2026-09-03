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
};

export const site: SiteInfo = {
  name: "מעלות קדושים",
  lang: "he",
  dir: "rtl",
  description: "אתר רשמי לבית הכנסת מעלות קדושים ברמת גן.",
  basePath: resolveBasePath(),
};

function resolveBasePath(): string {
  const raw = process.env.SITE_BASE_PATH?.trim();

  if (!raw || raw === "/") {
    return "/";
  }

  const withLeadingSlash = raw.startsWith("/") ? raw : `/${raw}`;
  return withLeadingSlash.endsWith("/") ? withLeadingSlash : `${withLeadingSlash}/`;
}

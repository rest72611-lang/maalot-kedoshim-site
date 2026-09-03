/**
 * Joins a route path (e.g. "/", "/zmanim/", "/sitemap.xml") onto the site's
 * configured base path (e.g. "/" for root, "/REPOSITORY/" for a GitHub
 * Pages project site). `basePath` is expected to already start and end
 * with "/"; the route's own leading slash is stripped before joining so
 * the two never collide into a double slash.
 */
export function resolveSitePath(basePath: string, routePath: string): string {
  return `${basePath}${routePath.replace(/^\//, "")}`;
}

/**
 * Builds a public, base-path-aware href/src for a generated or copied
 * asset from its dist-relative path segments (each URI-encoded).
 */
export function toPublicHref(basePath: string, segments: string[]): string {
  const relative = segments.map((segment) => encodeURIComponent(segment)).join("/");
  return resolveSitePath(basePath, relative);
}

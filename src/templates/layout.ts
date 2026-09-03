import type { SiteInfo } from "../data/site.js";
import { resolveSitePath } from "../paths.js";
import { escapeHtml } from "./utils.js";

export type LayoutOptions = {
  site: SiteInfo;
  title: string;
  description?: string;
  currentPath: "/" | "/zmanim/";
  body: string;
};

export function renderLayout(options: LayoutOptions): string {
  const { site, currentPath } = options;
  const description = options.description ?? site.description;
  const homeHref = resolveSitePath(site.basePath, "/");
  const zmanimHref = resolveSitePath(site.basePath, "/zmanim/");
  const styleHref = resolveSitePath(site.basePath, "assets/styles/site.css");

  return `<!doctype html>
<html lang="${escapeHtml(site.lang)}" dir="${escapeHtml(site.dir)}">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <title>${escapeHtml(options.title)}</title>
    <meta name="description" content="${escapeHtml(description)}">
${canonicalTag(site, currentPath)}    <link rel="stylesheet" href="${escapeHtml(styleHref)}">
  </head>
  <body>
    <a class="skip-link" href="#main">דלגו לתוכן המרכזי</a>
    <header class="site-header">
      <div class="container">
        <a class="site-name" href="${escapeHtml(homeHref)}">${escapeHtml(site.name)}</a>
        <nav aria-label="ניווט ראשי">
          <a href="${escapeHtml(homeHref)}"${ariaCurrent(currentPath, "/")}>דף הבית</a>
          <a href="${escapeHtml(zmanimHref)}"${ariaCurrent(currentPath, "/zmanim/")}>זמני תפילות</a>
        </nav>
      </div>
    </header>
    <main id="main">
${options.body}
    </main>
    <footer class="site-footer">
      <div class="container">
        <p>כל הזכויות שמורות © אריה שטינברג | <a href="tel:0533105968" dir="ltr">053-310-5968</a></p>
      </div>
    </footer>
  </body>
</html>
`;
}

function ariaCurrent(currentPath: LayoutOptions["currentPath"], linkPath: LayoutOptions["currentPath"]): string {
  return currentPath === linkPath ? ' aria-current="page"' : "";
}

/**
 * Emits a canonical <link> only once a real production origin is approved
 * and set on `site.productionOrigin`. Until then this renders nothing —
 * no placeholder/localhost/example.com URL is ever emitted.
 */
function canonicalTag(site: SiteInfo, currentPath: LayoutOptions["currentPath"]): string {
  if (!site.productionOrigin) {
    return "";
  }

  const href = `${site.productionOrigin}${resolveSitePath(site.basePath, currentPath)}`;

  return `    <link rel="canonical" href="${escapeHtml(href)}">\n`;
}

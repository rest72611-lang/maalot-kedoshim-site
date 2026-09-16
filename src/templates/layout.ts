import type { FixedAssetImage } from "../build/fixed-assets.js";
import type { SiteInfo } from "../data/site.js";
import { resolveSitePath, toPublicHref } from "../paths.js";
import { escapeHtml } from "./utils.js";

export type LayoutOptions = {
  site: SiteInfo;
  title: string;
  description?: string;
  currentPath: "/" | "/zmanim/";
  donationStoryCover: FixedAssetImage;
  body: string;
};

const DONATION_STORY_TITLE = "ישועות בזכות החזקת התורה";
const DONATION_STORY_DESCRIPTION = "שני סיפורים אישיים של רפואה ופרנסה";

export function renderLayout(options: LayoutOptions): string {
  const { site, currentPath } = options;
  const description = options.description ?? site.description;
  const homeHref = resolveSitePath(site.basePath, "/");
  const zmanimHref = resolveSitePath(site.basePath, "/zmanim/");
  const styleHref = resolveSitePath(site.basePath, "assets/styles/site.css");
  // On the home page the anchor scrolls in place; elsewhere it must first
  // navigate back to the home document before the browser can jump to it.
  const donationsHref = currentPath === "/" ? "#donations" : `${homeHref}#donations`;
  const donationStoryHref = toPublicHref(site.basePath, ["assets", "donations", "salvation-story.pdf"]);
  const { donationStoryCover } = options;

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
        <button type="button" class="nav-toggle" id="nav-toggle" aria-expanded="false" aria-controls="site-nav" aria-label="פתיחת תפריט ניווט">
          <span class="nav-toggle-icon" aria-hidden="true"></span>
        </button>
        <nav class="site-nav" id="site-nav" aria-label="ניווט ראשי">
          <a class="nav-link" href="${escapeHtml(homeHref)}"${ariaCurrent(currentPath, "/")}>דף הבית</a>
          <div class="nav-donations" id="nav-donations">
            <a class="nav-donations-link" href="${escapeHtml(donationsHref)}">
              <svg class="nav-donations-arrow nav-donations-arrow--right" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
                <path d="M10 4L6 8L10 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
              <span>תרומות</span>
              <svg class="nav-donations-arrow nav-donations-arrow--left" viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
                <path d="M6 4L10 8L6 12" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </a>
            <button type="button" class="nav-donations-toggle" id="nav-donations-toggle" aria-expanded="false" aria-controls="nav-donations-menu" aria-label="פרטים על סיפור ישועה בזכות תרומה">
              <svg class="nav-donations-chevron" viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
                <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
              </svg>
            </button>
            <div class="nav-donations-menu" id="nav-donations-menu">
              <div class="nav-donations-preview">
                <img class="nav-donations-cover" src="${escapeHtml(donationStoryCover.url)}" width="${donationStoryCover.width}" height="${donationStoryCover.height}" alt="" loading="lazy">
                <div class="nav-donations-preview-text">
                  <p class="nav-donations-preview-title">${escapeHtml(DONATION_STORY_TITLE)}</p>
                  <p class="nav-donations-preview-desc">${escapeHtml(DONATION_STORY_DESCRIPTION)}</p>
                </div>
              </div>
              <a class="nav-donations-cta" href="${escapeHtml(donationStoryHref)}" target="_blank" rel="noopener noreferrer">לקריאת הסיפורים המלאים</a>
            </div>
          </div>
          <a class="nav-link" href="${escapeHtml(zmanimHref)}"${ariaCurrent(currentPath, "/zmanim/")}>זמני תפילות</a>
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
    <script>
      (function () {
        var navToggle = document.getElementById("nav-toggle");
        var siteNav = document.getElementById("site-nav");
        var donationsWrap = document.getElementById("nav-donations");
        var donationsToggle = document.getElementById("nav-donations-toggle");
        var donationsMenu = document.getElementById("nav-donations-menu");
        var hoverCapable = window.matchMedia("(hover: hover) and (pointer: fine)");
        var desktopQuery = window.matchMedia("(min-width: 48rem)");
        var closeTimer = null;
        // Three independent reasons the submenu might be open: a pointer
        // hovering it, focus resting inside it, or the arrow having been
        // explicitly clicked ("pinned"). Visibility is the OR of all three,
        // computed in one place, so aria-expanded can never drift from what
        // is actually on screen — e.g. clicking the arrow while it is
        // already hover-open must pin it open, not fight the hover state.
        var donationsPinned = false;
        var donationsHovered = false;
        var donationsFocused = false;

        function clearCloseTimer() {
          if (closeTimer) {
            window.clearTimeout(closeTimer);
            closeTimer = null;
          }
        }

        function syncDonationsState() {
          if (!donationsWrap) {
            return;
          }
          var shouldBeOpen = donationsPinned || donationsHovered || donationsFocused;
          donationsWrap.classList.toggle("is-open", shouldBeOpen);
          if (donationsToggle) {
            donationsToggle.setAttribute("aria-expanded", shouldBeOpen ? "true" : "false");
          }
        }

        function closeDonations() {
          clearCloseTimer();
          donationsPinned = false;
          donationsHovered = false;
          donationsFocused = false;
          syncDonationsState();
        }

        function scheduleHoverClose() {
          clearCloseTimer();
          closeTimer = window.setTimeout(function () {
            donationsHovered = false;
            syncDonationsState();
          }, 220);
        }

        if (donationsWrap && donationsToggle && donationsMenu) {
          donationsToggle.addEventListener("click", function () {
            clearCloseTimer();
            donationsPinned = !donationsPinned;
            syncDonationsState();
          });

          donationsWrap.addEventListener("mouseenter", function () {
            if (hoverCapable.matches) {
              clearCloseTimer();
              donationsHovered = true;
              syncDonationsState();
            }
          });

          donationsWrap.addEventListener("mouseleave", function () {
            if (hoverCapable.matches) {
              scheduleHoverClose();
            }
          });

          donationsWrap.addEventListener("focusin", function () {
            clearCloseTimer();
            donationsFocused = true;
            syncDonationsState();
          });

          donationsWrap.addEventListener("focusout", function (event) {
            if (donationsWrap.contains(event.relatedTarget)) {
              return;
            }
            donationsFocused = false;
            donationsPinned = false;
            syncDonationsState();
          });

          document.addEventListener("click", function (event) {
            if (!donationsWrap.classList.contains("is-open")) {
              return;
            }
            if (donationsWrap.contains(event.target)) {
              return;
            }
            closeDonations();
          });

          document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && donationsWrap.classList.contains("is-open")) {
              closeDonations();
              donationsToggle.focus();
            }
          });
        }

        if (navToggle && siteNav) {
          function closeNav() {
            siteNav.classList.remove("is-open");
            navToggle.setAttribute("aria-expanded", "false");
          }

          function openNav() {
            siteNav.classList.add("is-open");
            navToggle.setAttribute("aria-expanded", "true");
          }

          navToggle.addEventListener("click", function () {
            if (siteNav.classList.contains("is-open")) {
              closeNav();
            } else {
              openNav();
            }
          });

          var navLinks = siteNav.querySelectorAll("a");
          for (var i = 0; i < navLinks.length; i++) {
            navLinks[i].addEventListener("click", function () {
              closeNav();
            });
          }

          document.addEventListener("click", function (event) {
            if (!siteNav.classList.contains("is-open")) {
              return;
            }
            if (siteNav.contains(event.target) || navToggle.contains(event.target)) {
              return;
            }
            closeNav();
          });

          document.addEventListener("keydown", function (event) {
            if (event.key === "Escape" && siteNav.classList.contains("is-open")) {
              closeNav();
              navToggle.focus();
            }
          });

          desktopQuery.addEventListener("change", function (event) {
            if (event.matches) {
              closeNav();
              closeDonations();
            }
          });
        }
      })();
    </script>
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

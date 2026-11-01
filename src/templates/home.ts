import type { ActivityImage } from "../build/activity.js";
import type { FixedAssets } from "../build/fixed-assets.js";
import type { NoticeAsset, NoticePage } from "../build/notices.js";
import type { PopupAsset } from "../build/popup.js";
import type { SiteInfo } from "../data/site.js";
import { renderLayout } from "./layout.js";
import { renderLivePopupShell, renderPopup } from "./popup.js";
import { resolveSitePath } from "../paths.js";
import { escapeHtml } from "./utils.js";

const HOME_INTRO_LEAD = "מחפש מקום לתפילה, לשיעור או פשוט שעה טובה של תורה באמצע היום?";
const HOME_INTRO_REST =
  'במעלות קדושים תמיד קורה משהו. תפילות ושיעורים לאורך כל היום, באווירה חמה, ביתית ונגישה ברמת גן. לא צריך להכיר אף אחד ולא צריך להיות "מהקבועים" — פשוט נכנסים, מצטרפים ומרגישים בבית.';
const DONATION_URL = "https://www.matara.pro/nedarimplus/online/?mosad=7013570";
const HOME_PAGE_DESCRIPTION =
  "האתר הרשמי של בית הכנסת מעלות קדושים: זמני תפילות, מודעות, עדכונים ופעילות קהילתית בתקופת חרבות ברזל.";

export function renderHomePage({
  site,
  notices,
  activityImages,
  fixedAssets,
  popups,
}: {
  site: SiteInfo;
  notices: NoticeAsset[];
  activityImages: ActivityImage[];
  fixedAssets: FixedAssets;
  popups: PopupAsset[];
}): string {
  // With a public API configured, legacy items carry their manifest id so the
  // client can hide them, and the lists get ids so it can add new media.
  // Without one, the markup is exactly the static page.
  const live = site.publicApiOrigin !== "";
  const noticeItems =
    notices.length > 0
      ? notices.map((notice) => renderNoticeItem(notice, live)).join("\n")
      : "          <li>אין מודעות להצגה כרגע.</li>";
  const activityItems =
    activityImages.length > 0
      ? activityImages.map((image) => renderActivityItem(image, live)).join("\n")
      : "            <p>אין תמונות להצגה כרגע.</p>";

  return renderLayout({
    site,
    title: site.name,
    description: HOME_PAGE_DESCRIPTION,
    currentPath: "/",
    donationStoryCover: fixedAssets.donationStoryCover,
    logo: fixedAssets.logo,
    body: `      <section class="hero" aria-labelledby="home-hero-title">
        <div class="container hero-identity">
          <img class="hero-logo" src="${escapeHtml(fixedAssets.logo.url)}" width="${fixedAssets.logo.width}" height="${fixedAssets.logo.height}" alt="לוגו בית הכנסת מעלות קדושים">
          <div class="hero-text">
            <h1 id="home-hero-title" class="hero-title">בית הכנסת מעלות קדושים לזכר קדושי מלחמת חרבות ברזל</h1>
            <p class="hero-actions">
              <a class="hero-action hero-action--primary" href="${escapeHtml(resolveSitePath(site.basePath, "/zmanim/"))}">זמני תפילות</a>
              <a class="hero-action" href="#donations">לתרומה לבית המדרש</a>
            </p>
          </div>
        </div>
        <img class="hero-sign" src="${escapeHtml(fixedAssets.heroSign.url)}" width="${fixedAssets.heroSign.width}" height="${fixedAssets.heroSign.height}" alt="שלט הכניסה לבית הכנסת מעלות קדושים" fetchpriority="high">
      </section>
      <section class="section home-intro">
        <div class="container home-intro-content">
          <p class="home-intro-text"><span class="home-intro-lead">${HOME_INTRO_LEAD}</span> <span class="home-intro-rest">${HOME_INTRO_REST}</span></p>
        </div>
      </section>
      <section class="section notices-section">
        <div class="container">
          <h2 class="notices-heading">לוח מודעות</h2>
          <ul class="notices-grid"${live ? ' id="notices-list"' : ""}>
${noticeItems}
          </ul>
        </div>
      </section>
      <section class="section band-primary">
        <div class="container">
          <h2 id="activity-heading" class="activity-heading">מהנעשה בבית המדרש</h2>
          <div class="carousel" data-carousel aria-labelledby="activity-heading">
            <div class="activity-grid carousel-track"${live ? ` id="activity-gallery" data-api-origin="${escapeHtml(site.publicApiOrigin)}"` : ""}>
${activityItems}
            </div>
          </div>
        </div>
      </section>
${live ? renderVideoSection() : ""}      <section id="donations" class="section band-tint" aria-labelledby="donations-heading">
        <div class="container">
          <h2 id="donations-heading" class="donations-heading">תרומות לבית המדרש</h2>
          <div class="donation-cta-wrap">
            <a class="donation-cta" href="${escapeHtml(DONATION_URL)}" target="_blank" rel="noopener noreferrer">
              <svg class="donation-cta-icon" viewBox="0 0 24 24" width="20" height="20" aria-hidden="true" focusable="false">
                <rect x="5" y="11" width="14" height="10" rx="2" fill="none" stroke="currentColor" stroke-width="2" />
                <path d="M8 11V8a4 4 0 0 1 8 0v3" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
              </svg>
              <span>לתרומה מאובטחת</span>
              <span class="visually-hidden">(נפתח בחלון חדש)</span>
            </a>
          </div>
        </div>
      </section>
${live ? renderLivePopupShell(site.publicApiOrigin) : popups.length > 0 ? renderPopup(popups) : ""}
      <script type="module" src="${escapeHtml(resolveSitePath(site.basePath, "assets/client/carousel.js"))}"></script>${live ? `\n      <script type="module" src="${escapeHtml(resolveSitePath(site.basePath, "assets/client/media-feed-view.js"))}"></script>\n      <script type="module" src="${escapeHtml(resolveSitePath(site.basePath, "assets/client/announcement-popup.js"))}"></script>` : ""}`,
  });
}

/**
 * Videos only come from the platform API, so the section ships empty and
 * hidden; media-feed-view.js fills it and shows it when there are videos.
 */
function renderVideoSection(): string {
  return `      <section id="videos-section" class="section videos-section" aria-labelledby="videos-heading" hidden>
        <div class="container">
          <h2 id="videos-heading" class="activity-heading">סרטונים</h2>
          <div class="carousel" data-carousel data-autoplay-ms="0" aria-labelledby="videos-heading">
            <div id="video-track" class="carousel-track video-track"></div>
          </div>
        </div>
      </section>
`;
}

function legacyIdAttribute(live: boolean, legacyId: string): string {
  return live ? ` data-legacy-id="${escapeHtml(legacyId)}"` : "";
}

function renderActivityItem(image: ActivityImage, live: boolean): string {
  const caption =
    image.caption.length > 0
      ? `\n              <figcaption class="activity-caption">${escapeHtml(image.caption)}</figcaption>`
      : "";

  return `            <figure class="activity-figure"${legacyIdAttribute(live, `activity:${image.sourceName}`)}>
              <img class="activity-image" src="${escapeHtml(image.src)}" width="${image.width}" height="${image.height}" alt="${escapeHtml(image.alt)}" loading="lazy">${caption}
            </figure>`;
}

function renderNoticeItem(notice: NoticeAsset, live: boolean): string {
  const pageImages = notice.pages
    .map((page) => renderNoticePageImage(page, notice.pages.length))
    .join("\n");

  return `          <li${legacyIdAttribute(live, `notice:${notice.sourceName}`)}>
            <article class="notice-card">
              <figure class="notice-figure">
${pageImages}
              </figure>
              <a class="notice-link" href="${escapeHtml(notice.sourceHref)}">פתיחת המודעה בקובץ PDF</a>
            </article>
          </li>`;
}

function renderNoticePageImage(page: NoticePage, pageCount: number): string {
  const alt = pageCount > 1 ? `מודעה מלוח המודעות, עמוד ${page.index}` : "מודעה מלוח המודעות";

  return `                <img class="notice-image" src="${escapeHtml(page.src)}" width="${page.width}" height="${page.height}" alt="${escapeHtml(alt)}" loading="lazy">`;
}

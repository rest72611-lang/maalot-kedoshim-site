import type { ActivityImage } from "../build/activity.js";
import type { FixedAssets } from "../build/fixed-assets.js";
import type { NoticeAsset, NoticePage } from "../build/notices.js";
import type { SiteInfo } from "../data/site.js";
import { renderLayout } from "./layout.js";
import { escapeHtml } from "./utils.js";

const HOME_INTRO_LEAD = "מחפש מקום לתפילה, לשיעור או פשוט שעה טובה של תורה באמצע היום?";
const HOME_INTRO_REST =
  'במעלות קדושים תמיד קורה משהו. תפילות ושיעורים לאורך כל היום, באווירה חמה, ביתית ונגישה ברמת גן. לא צריך להכיר אף אחד ולא צריך להיות "מהקבועים" — פשוט נכנסים, מצטרפים ומרגישים בבית.';

export function renderHomePage({
  site,
  notices,
  activityImages,
  fixedAssets,
}: {
  site: SiteInfo;
  notices: NoticeAsset[];
  activityImages: ActivityImage[];
  fixedAssets: FixedAssets;
}): string {
  const noticeItems =
    notices.length > 0
      ? notices.map(renderNoticeItem).join("\n")
      : "          <li>אין מודעות להצגה כרגע.</li>";
  const activityItems =
    activityImages.length > 0
      ? activityImages.map(renderActivityItem).join("\n")
      : "            <p>אין תמונות להצגה כרגע.</p>";

  return renderLayout({
    site,
    title: site.name,
    currentPath: "/",
    body: `      <section class="hero" aria-labelledby="home-hero-title">
        <div class="container hero-identity">
          <img class="hero-logo" src="${escapeHtml(fixedAssets.logo.url)}" width="${fixedAssets.logo.width}" height="${fixedAssets.logo.height}" alt="לוגו בית הכנסת מעלות קדושים">
          <h1 id="home-hero-title" class="hero-title">בית הכנסת מעלות קדושים</h1>
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
          <ul class="notices-grid">
${noticeItems}
          </ul>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <h2 class="activity-heading">מהנעשה בבית המדרש</h2>
          <div class="activity-grid">
${activityItems}
          </div>
        </div>
      </section>
      <section class="section">
        <div class="container">
          <h2 class="donations-heading">תרומות לבית המדרש</h2>
          <div class="donation-qr-wrap">
            <img class="donation-qr-image" src="${escapeHtml(fixedAssets.donationQr.url)}" width="${fixedAssets.donationQr.width}" height="${fixedAssets.donationQr.height}" alt="קוד QR לתרומות לבית המדרש מעלות קדושים" loading="lazy">
          </div>
        </div>
      </section>`,
  });
}

function renderActivityItem(image: ActivityImage): string {
  return `            <figure class="activity-figure">
              <img class="activity-image" src="${escapeHtml(image.src)}" width="${image.width}" height="${image.height}" alt="${escapeHtml(image.alt)}" loading="lazy">
            </figure>`;
}

function renderNoticeItem(notice: NoticeAsset): string {
  const pageImages = notice.pages
    .map((page) => renderNoticePageImage(page, notice.pages.length))
    .join("\n");

  return `          <li>
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

import type {
  HolidayDay,
  HolidayEvent,
  HolidaySchedule,
  PrayerSchedule,
  TimedItem,
} from "../data/prayer-times.js";
import type { FixedAssetImage } from "../build/fixed-assets.js";
import type { SiteInfo } from "../data/site.js";
import { renderLayout } from "./layout.js";
import { escapeHtml } from "./utils.js";

const PAGE_TITLE = "זמני תפילות | בית הכנסת מעלות קדושים רמת גן";
const PAGE_DESCRIPTION =
  "זמני תפילות בבית הכנסת מעלות קדושים ברמת גן, כולל תפילות לימים רגילים וזמני תפילות לראש השנה וליום הכיפורים.";

export function renderPrayerTimesPage({
  site,
  prayerSchedule,
  donationStoryCover,
}: {
  site: SiteInfo;
  prayerSchedule: PrayerSchedule;
  donationStoryCover: FixedAssetImage;
}): string {
  return renderLayout({
    site,
    title: PAGE_TITLE,
    description: PAGE_DESCRIPTION,
    currentPath: "/zmanim/",
    donationStoryCover,
    body: `      <section class="section prayer-page">
        <div class="container">
          <h1>זמני תפילות בבית המדרש</h1>
          ${renderRegularSchedule(prayerSchedule.regularWeekdays)}
          ${renderHolidays(prayerSchedule.holidays)}
        </div>
      </section>`,
  });
}

function renderRegularSchedule(items: TimedItem[]): string {
  const rows = items.map(renderScheduleItem).join("\n");

  return `<section class="schedule-section" aria-labelledby="regular-schedule-heading">
            <h2 id="regular-schedule-heading">זמני תפילות לימים רגילים</h2>
            <ul class="schedule-list">
${rows}
            </ul>
          </section>`;
}

function renderHolidays(holidays: HolidaySchedule[]): string {
  const groups = holidays.map(renderHoliday).join("\n");

  return `<section class="schedule-section" aria-labelledby="holidays-heading">
            <h2 id="holidays-heading">זמני תפילות ימים נוראים</h2>
${groups}
          </section>`;
}

function renderHoliday(holiday: HolidaySchedule): string {
  const days = holiday.days.map(renderHolidayDay).join("\n");

  return `            <section class="holiday">
              <h3>${escapeHtml(holiday.title)}</h3>
${days}
            </section>`;
}

function renderHolidayDay(day: HolidayDay): string {
  const events = day.events.map(renderScheduleItem).join("\n");
  const note = day.note
    ? `                <p class="schedule-note">${escapeHtml(day.note)}</p>\n`
    : "";

  return `              <article class="holiday-day">
                <header class="holiday-day-header">
                  <h4>${escapeHtml(day.title)}</h4>
                  <p class="day-dates">
                    <span class="hebrew-date">${escapeHtml(day.hebrewDate)}</span>
                    <span class="gregorian-date" dir="ltr">${escapeHtml(day.gregorianDate)}</span>
                  </p>
                </header>
                <ul class="schedule-list">
${events}
                </ul>
${note}              </article>`;
}

function renderScheduleItem(item: TimedItem | HolidayEvent): string {
  if (item.time === undefined || item.time === null) {
    return `                  <li class="schedule-item schedule-item--no-time">
                    <span class="schedule-name">${escapeHtml(item.name)}</span>
                  </li>`;
  }

  return `                  <li class="schedule-item">
                    <span class="schedule-name">${escapeHtml(item.name)}</span>
                    <time class="schedule-time" dir="ltr" datetime="${escapeHtml(item.time)}">${escapeHtml(item.time)}</time>
                  </li>`;
}

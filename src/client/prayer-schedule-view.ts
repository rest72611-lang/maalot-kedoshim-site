/**
 * Replaces the static prayer schedule on /zmanim/ with live times from the
 * platform's public API. The static HTML is the snapshot: if this script
 * never runs (JS off) the snapshot stays as it is, and if the API is slow,
 * down or returns something unexpected, the snapshot stays and a short
 * notice says the times may be out of date.
 *
 * Runs only when the build sets PUBLIC_API_ORIGIN; otherwise the page has
 * no script at all.
 */

type Service = { name: string; time: string | null; note?: string };
type SpecialDay = {
  groupTitle: string | null;
  title: string;
  date: string;
  hebrewDateLabel: string | null;
  note: string | null;
  services: Service[];
};
type Schedule = {
  weekday: Service[];
  upcomingShabbat: { date: string; parashaLabel: string | null; services: Service[] };
  specialDays: SpecialDay[];
};

const DEFAULT_TIMEOUT_MS = 4000;
const STALE_NOTICE = "ייתכן שהזמנים אינם מעודכנים.";

const root = document.getElementById("prayer-schedule");
if (root) {
  void loadLiveSchedule(root);
}

async function loadLiveSchedule(container: HTMLElement): Promise<void> {
  const origin = container.dataset["apiOrigin"];
  const timeoutMs = Number(container.dataset["apiTimeoutMs"] ?? DEFAULT_TIMEOUT_MS);
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${origin}/v1/prayer-schedule`, {
      signal: controller.signal,
      headers: { Accept: "application/json" },
      credentials: "omit",
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    const data: unknown = await response.json();
    if (!isSchedule(data)) {
      throw new Error("Unexpected response shape");
    }
    container.replaceChildren(...renderSchedule(data));
    container.dataset["source"] = "live";
  } catch {
    showStaleNotice(container);
    container.dataset["source"] = "snapshot";
  } finally {
    window.clearTimeout(timer);
  }
}

function renderSchedule(schedule: Schedule): HTMLElement[] {
  const sections = [section("זמני תפילות לימים רגילים", [serviceList(schedule.weekday)])];

  const shabbat = schedule.upcomingShabbat;
  if (shabbat.services.length > 0) {
    const heading = shabbat.parashaLabel ? `שבת הקרובה, ${shabbat.parashaLabel}` : "שבת הקרובה";
    sections.push(section(heading, [dates(null, shabbat.date), serviceList(shabbat.services)]));
  }

  if (schedule.specialDays.length > 0) {
    const groups: HTMLElement[] = [];
    let currentTitle: string | null | undefined;
    let currentGroup: HTMLElement | undefined;
    for (const day of schedule.specialDays) {
      const groupTitle = day.groupTitle ?? day.title;
      if (!currentGroup || groupTitle !== currentTitle) {
        currentTitle = groupTitle;
        currentGroup = element("section", "holiday", [element("h3", null, [groupTitle])]);
        groups.push(currentGroup);
      }
      currentGroup.append(specialDay(day));
    }
    sections.push(section("ימים מיוחדים", groups));
  }

  return sections;
}

function specialDay(day: SpecialDay): HTMLElement {
  const header = element("header", "holiday-day-header", [element("h4", null, [day.title]), dates(day.hebrewDateLabel, day.date)]);
  const children: (HTMLElement | string)[] = [header, serviceList(day.services)];
  if (day.note) {
    children.push(element("p", "schedule-note", [day.note]));
  }
  return element("article", "holiday-day", children);
}

function dates(hebrew: string | null, isoDate: string): HTMLElement {
  const [year, month, day] = isoDate.split("-");
  const gregorian = element("span", "gregorian-date", [`${day}/${month}/${year}`]);
  gregorian.dir = "ltr";
  const children: HTMLElement[] = [];
  if (hebrew) {
    children.push(element("span", "hebrew-date", [hebrew]));
  }
  children.push(gregorian);
  return element("p", "day-dates", children);
}

function serviceList(services: Service[]): HTMLElement {
  return element(
    "ul",
    "schedule-list",
    services.map((service) => {
      const item = element("li", service.time ? "schedule-item" : "schedule-item schedule-item--no-time", [
        element("span", "schedule-name", [service.name]),
      ]);
      if (service.time) {
        const time = element("time", "schedule-time", [service.time]);
        time.dir = "ltr";
        time.dateTime = service.time;
        item.append(time);
      }
      return item;
    }),
  );
}

function section(title: string, children: HTMLElement[]): HTMLElement {
  return element("section", "schedule-section", [element("h2", null, [title]), ...children]);
}

function showStaleNotice(container: HTMLElement): void {
  if (container.querySelector(".schedule-status")) {
    return;
  }
  const notice = element("p", "schedule-status", [STALE_NOTICE]);
  notice.setAttribute("role", "status");
  container.prepend(notice);
}

/** Builds an element from text and child nodes only: never parses HTML. */
function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className: string | null,
  children: (HTMLElement | string)[],
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) {
    node.className = className;
  }
  node.append(...children);
  return node;
}

function isSchedule(value: unknown): value is Schedule {
  if (!isRecord(value) || !Array.isArray(value["weekday"]) || !Array.isArray(value["specialDays"])) {
    return false;
  }
  const shabbat = value["upcomingShabbat"];
  return (
    value["weekday"].every(isService) &&
    isRecord(shabbat) &&
    isIsoDate(shabbat["date"]) &&
    (shabbat["parashaLabel"] === null || typeof shabbat["parashaLabel"] === "string") &&
    Array.isArray(shabbat["services"]) &&
    shabbat["services"].every(isService) &&
    value["specialDays"].every(
      (day) =>
        isRecord(day) &&
        typeof day["title"] === "string" &&
        isIsoDate(day["date"]) &&
        Array.isArray(day["services"]) &&
        day["services"].every(isService),
    )
  );
}

function isService(value: unknown): value is Service {
  return (
    isRecord(value) &&
    typeof value["name"] === "string" &&
    (value["time"] === null || (typeof value["time"] === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(value["time"])))
  );
}

function isIsoDate(value: unknown): value is string {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

// A module, so each script keeps its own scope (they load as type="module").
export {};

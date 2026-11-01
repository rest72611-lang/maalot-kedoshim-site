/**
 * Image carousel (P7.3), progressive enhancement over a CSS scroll-snap
 * track: without this script the track still scrolls and snaps by touch,
 * trackpad or scrollbar. The script adds previous/next buttons, arrow-key
 * navigation, slide labels and gentle auto-advance with a pause button.
 *
 * Auto-advance never runs when the visitor prefers reduced motion, stops
 * while the pointer or keyboard focus is inside, and only runs while the
 * carousel is on screen. Slides added later (new media from the API) are
 * picked up automatically.
 *
 * Markup: <div data-carousel aria-label="…"><div class="carousel-track">slides…</div></div>
 */

const DEFAULT_AUTOPLAY_MS = 6000;
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

for (const root of document.querySelectorAll<HTMLElement>("[data-carousel]")) {
  setUpCarousel(root);
}

function setUpCarousel(root: HTMLElement): void {
  const track = root.querySelector<HTMLElement>(".carousel-track");
  if (!track) {
    return;
  }
  const rtl = getComputedStyle(track).direction === "rtl";
  const autoplayMs = Number(root.dataset["autoplayMs"] ?? DEFAULT_AUTOPLAY_MS);

  const controls = element("div", "carousel-controls");
  const previous = button("carousel-button carousel-previous", "התמונה הקודמת", rtl ? "›" : "‹");
  const pause = button("carousel-button carousel-pause", "עצירת ההחלפה האוטומטית", "❚❚");
  const next = button("carousel-button carousel-next", "התמונה הבאה", rtl ? "‹" : "›");
  const status = element("p", "visually-hidden");
  status.setAttribute("aria-live", "polite");
  controls.append(previous, pause, next);
  root.append(controls, status);

  track.tabIndex = 0;
  root.setAttribute("role", "region");
  root.setAttribute("aria-roledescription", "קרוסלה");

  let userPaused = false;
  let interacting = false;
  let visible = true;
  let timer: number | undefined;

  const slides = () => Array.from(track.children).filter((child): child is HTMLElement => child instanceof HTMLElement);

  /** The slide whose leading edge is nearest the track's leading edge. */
  function currentIndex(): number {
    const trackRect = track!.getBoundingClientRect();
    let best = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    slides().forEach((slide, index) => {
      const rect = slide.getBoundingClientRect();
      const distance = Math.abs(rtl ? rect.right - trackRect.right : rect.left - trackRect.left);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = index;
      }
    });
    return best;
  }

  /** Scrolls only the track (never the page) so slide `index` is at the leading edge. */
  function goTo(index: number, announce: boolean): void {
    const all = slides();
    if (all.length === 0) {
      return;
    }
    const target = all[((index % all.length) + all.length) % all.length]!;
    const trackRect = track!.getBoundingClientRect();
    const rect = target.getBoundingClientRect();
    track!.scrollBy({
      left: rtl ? rect.right - trackRect.right : rect.left - trackRect.left,
      behavior: reducedMotion.matches ? "auto" : "smooth",
    });
    const position = all.indexOf(target) + 1;
    root.dataset["index"] = String(position);
    if (announce) {
      status.textContent = `תמונה ${position} מתוך ${all.length}`;
    }
  }

  function refresh(): void {
    const all = slides();
    all.forEach((slide, index) => {
      slide.setAttribute("role", "group");
      slide.setAttribute("aria-roledescription", "שקופית");
      slide.setAttribute("aria-label", `${index + 1} מתוך ${all.length}`);
    });
    controls.hidden = all.length < 2;
    pause.hidden = reducedMotion.matches;
    root.dataset["count"] = String(all.length);
    schedule();
  }

  function schedule(): void {
    window.clearInterval(timer);
    timer = undefined;
    const running = !userPaused && !interacting && visible && !reducedMotion.matches && !document.hidden && slides().length > 1;
    root.dataset["autoplay"] = running ? "on" : "off";
    if (running) {
      timer = window.setInterval(() => goTo(currentIndex() + 1, false), autoplayMs);
    }
  }

  previous.addEventListener("click", () => goTo(currentIndex() - 1, true));
  next.addEventListener("click", () => goTo(currentIndex() + 1, true));
  pause.addEventListener("click", () => {
    userPaused = !userPaused;
    pause.setAttribute("aria-pressed", String(userPaused));
    pause.setAttribute("aria-label", userPaused ? "הפעלת ההחלפה האוטומטית" : "עצירת ההחלפה האוטומטית");
    pause.textContent = userPaused ? "▶" : "❚❚";
    schedule();
  });
  pause.setAttribute("aria-pressed", "false");

  track.addEventListener("keydown", (event) => {
    const forward = rtl ? "ArrowLeft" : "ArrowRight";
    const backward = rtl ? "ArrowRight" : "ArrowLeft";
    if (event.key === forward || event.key === backward || event.key === "Home" || event.key === "End") {
      event.preventDefault();
      const last = slides().length - 1;
      const index = event.key === "Home" ? 0 : event.key === "End" ? last : currentIndex() + (event.key === forward ? 1 : -1);
      goTo(Math.max(0, Math.min(last, index)), true);
    }
  });

  for (const [type, value] of [["pointerenter", true], ["pointerleave", false], ["focusin", true], ["focusout", false]] as const) {
    root.addEventListener(type, () => {
      interacting = value;
      schedule();
    });
  }
  document.addEventListener("visibilitychange", schedule);
  reducedMotion.addEventListener("change", refresh);
  new IntersectionObserver((entries) => {
    visible = entries.some((entry) => entry.isIntersecting);
    schedule();
  }).observe(root);
  new MutationObserver(refresh).observe(track, { childList: true });

  refresh();
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag);
  node.className = className;
  return node;
}

function button(className: string, label: string, symbol: string): HTMLButtonElement {
  const node = document.createElement("button");
  node.type = "button";
  node.className = className;
  node.setAttribute("aria-label", label);
  node.textContent = symbol;
  return node;
}

export {};

import type { PopupAsset } from "../build/popup.js";
import { escapeHtml } from "./utils.js";

/**
 * Renders the homepage-only announcement popup: a single native <dialog>
 * (giving us focus trapping, Escape-to-cancel and ::backdrop for free)
 * holding one `.popup-item` per announcement, plus the small script that
 * opens it shortly after load and manages the animated, reduced-motion-aware
 * close. Kept out of `layout.ts` so no other page ever gets this markup.
 */
export function renderPopup(popups: PopupAsset[]): string {
  const isSingle = popups.length === 1;
  const dialogLabel = isSingle ? "מודעה מבית הכנסת מעלות קדושים" : "מודעות מבית הכנסת מעלות קדושים";
  const closeLabel = isSingle ? "סגירת המודעה" : "סגירת המודעות";
  const items = popups.map(renderPopupItem).join("\n");

  return `      <dialog id="popup-dialog" class="popup-dialog" aria-label="${escapeHtml(dialogLabel)}">
        <button type="button" id="popup-close" class="popup-close" aria-label="${escapeHtml(closeLabel)}">×</button>
        <div class="popup-grid">
${items}
        </div>
      </dialog>
      <script>
        (function () {
          var dialog = document.getElementById("popup-dialog");
          if (!dialog || typeof dialog.showModal !== "function") {
            return;
          }
          var closeButton = document.getElementById("popup-close");
          var lastFocused = null;

          function prefersReducedMotion() {
            return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          }

          function openPopup() {
            lastFocused = document.activeElement;
            document.body.classList.add("popup-open");
            dialog.showModal();
            if (closeButton) {
              closeButton.focus();
            }
            if (!prefersReducedMotion()) {
              window.requestAnimationFrame(function () {
                dialog.classList.add("popup-visible");
              });
            }
          }

          function requestClose() {
            if (dialog.classList.contains("popup-closing")) {
              return;
            }
            if (prefersReducedMotion()) {
              dialog.close();
              return;
            }
            dialog.classList.add("popup-closing");
            dialog.classList.remove("popup-visible");
            window.setTimeout(function () {
              dialog.close();
            }, 200);
          }

          dialog.addEventListener("cancel", function (event) {
            event.preventDefault();
            requestClose();
          });

          dialog.addEventListener("close", function () {
            dialog.classList.remove("popup-closing", "popup-visible");
            document.body.classList.remove("popup-open");
            if (lastFocused && typeof lastFocused.focus === "function") {
              lastFocused.focus();
            }
          });

          dialog.addEventListener("click", function (event) {
            if (event.target === dialog) {
              requestClose();
            }
          });

          if (closeButton) {
            closeButton.addEventListener("click", requestClose);
          }

          window.setTimeout(openPopup, 400);
        })();
      </script>`;
}

/**
 * With the platform API on, the popup comes from the API (one image, or
 * none): this is the empty dialog that announcement-popup.js fills and
 * opens. It never shows a built-in popup, so one the admin removed can't
 * reappear when the API is down.
 */
export function renderLivePopupShell(apiOrigin: string): string {
  return `      <dialog id="popup-dialog" class="popup-dialog" aria-label="מודעה מבית הכנסת מעלות קדושים" data-api-origin="${escapeHtml(apiOrigin)}">
        <button type="button" class="popup-close" aria-label="סגירת המודעה">×</button>
        <div class="popup-grid"></div>
      </dialog>`;
}

function renderPopupItem(popup: PopupAsset): string {
  return `          <figure class="popup-item">
            <img class="popup-image" src="${escapeHtml(popup.src)}" width="${popup.width}" height="${popup.height}" alt="${escapeHtml(popup.alt)}">
          </figure>`;
}

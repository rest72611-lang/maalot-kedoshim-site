import type { PopupAsset } from "../build/popup.js";
import { escapeHtml } from "./utils.js";

/**
 * Renders the homepage-only announcement popup: a native <dialog> (giving
 * us focus trapping, Escape-to-cancel and ::backdrop for free) plus the
 * small script that opens it shortly after load and manages the animated,
 * reduced-motion-aware close. Kept out of `layout.ts` so no other page ever
 * gets this markup.
 */
export function renderPopup(popup: PopupAsset): string {
  return `      <dialog id="popup-dialog" class="popup-dialog" aria-label="מודעה מבית הכנסת מעלות קדושים">
        <button type="button" id="popup-close" class="popup-close" aria-label="סגירת המודעה">×</button>
        <div class="popup-image-wrap">
          <img class="popup-image" src="${escapeHtml(popup.src)}" width="${popup.width}" height="${popup.height}" alt="${escapeHtml(popup.alt)}">
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

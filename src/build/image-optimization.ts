/**
 * Output settings for images rendered from PDFs (notices and popups).
 *
 * These are photographic posters with text, so JPEG at a bounded size
 * keeps them readable at a fraction of a full-resolution PNG's weight.
 * 2000px on the long edge still covers a full-screen popup on a 3x phone.
 * The source PDFs are always published unchanged next to the images.
 */
export type PdfRenderPreset = {
  /** Longest edge of the rendered image, in pixels. */
  longEdge: number;
  /** JPEG quality, 1–100. */
  quality: number;
};

export const NOTICE_RENDER_PRESET: PdfRenderPreset = { longEdge: 2000, quality: 82 };

export const POPUP_RENDER_PRESET: PdfRenderPreset = { longEdge: 2000, quality: 82 };

/**
 * Activity photos come straight from phones (often 4000px+, several MB).
 * They are shown in a grid, so 1600px on the long edge is plenty.
 */
export const ACTIVITY_PHOTO_PRESET = { longEdge: 1600, quality: 80 } as const;

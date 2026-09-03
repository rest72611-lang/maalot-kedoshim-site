# CODEX ASSET MAP — מעלות קדושים

This folder is prepared intentionally. Do not guess the role of the files.

## Fixed image assets

- `assets/images/hero-sign.png`
  - Role: Main Hero / synagogue entrance sign image.
  - Preserve aspect ratio.
  - Do not crop away the sign text.

- `assets/images/logo.pdf`
  - Role: Official "מעלות קדושים" logo.
  - Source is PDF.
  - During implementation, create a web-friendly derivative if needed, but keep this original source file.
  - Do not redesign or recreate the logo.

- `assets/images/benizri.jpg`
  - Role: Photo for the activity section.
  - Caption must be exactly:
    `הרב שלמה בניזרי במעלות קדושים`

- `assets/images/donation-qr.png`
  - Role: Donation QR graphic.
  - Do not crop, distort, blur, recolor, or aggressively compress it.
  - It must remain easy to scan.

## Notice PDFs

- `assets/notices/bar-mitzvah.pdf`
  - Role: Notice-board PDF.
  - Preserve the original visual design.
  - Do not OCR/rebuild the notice as HTML.
  - Render it to a web image at build time.
  - Keep the original PDF available.

## Future notices

Any additional notice PDF added to `assets/notices/` must be discovered automatically by the build process.
Do not require a manually maintained list of notice filenames.

## Important

The project should use relative paths only.
Do not hard-code Windows paths or absolute local paths.

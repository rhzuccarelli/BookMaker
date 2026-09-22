# 📖 BookMaker

Impose a PDF into **pliegos (signatures)** — a print-ready booklet you fold,
stack and bind into a book.

Everything runs **in your browser**; the PDF never leaves your device. There is
**no build step** — just open `index.html`.

## Use it

- **Locally:** double-click `index.html` (or open it in any browser). It works
  straight from the file system.
- **Hosted:** drop the whole folder on any static host (GitHub Pages, Netlify,
  your own server). No build, no backend.

Then: choose a PDF → pick the pliego size and options → **generate** → download.

## What it does

Given any PDF, BookMaker performs **saddle-stitch imposition**:

1. Pads the document with blank pages up to a multiple of the pliego size.
2. Splits it into **pliegos (signatures)** of **8, 12, or 16 pages** each.
3. Imposes the pages 2-up on each side of every sheet so that when you print
   double-sided, fold each pliego, stack the pliegos in order, and bind, the
   pages read `1 → N`.

A pliego is `pages ÷ 4` folded sheets (8 → 2 sheets, 12 → 3, 16 → 4).

### Options

- **Pages per pliego** — `8`, `12`, or `16`.
- **Sheet size**
  - **Keep page size** — output sheet is double-width (e.g. A4 → A3 landscape);
    pages keep their original size.
  - **Fit same paper** — the sheet is one source page turned landscape with two
    pages scaled to fit (e.g. A4 → two A5 pages on one A4 sheet).
- **Fold line & crop marks** — a faint centre fold guide and corner crop ticks.

## How to print and bind

1. Print the generated PDF **double-sided** (flip on the short edge).
2. Keep the sheets in order — every `pages ÷ 4` sheets make one pliego.
3. Fold each pliego in half.
4. Stack the pliegos in order and bind the spine (staple, sew, or glue).

## Files

- `index.html` — the page.
- `style.css` — design (ported from zuccarelli.xyz: warm paper, signal-cobalt
  accent, Hanken Grotesk + JetBrains Mono).
- `imposition.js` — the imposition engine (`signatureOrder`, `buildSheetPlan`,
  `imposePdf`).
- `app.js` — the UI (file input, drag & drop, options, download).
- `vendor/pdf-lib.min.js` — vendored [pdf-lib](https://pdflib.js.org/), loaded
  locally (no CDN needed).

Fonts load from Google Fonts when online; if offline, the page falls back to
system monospace/sans and stays fully functional.

### Optional: run a local server

Not required, but if you prefer serving over HTTP:

```bash
python3 -m http.server 8000
# then open http://localhost:8000
```

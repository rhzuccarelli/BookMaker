# 📖 BookMaker

Upload a PDF and download a **print-ready PDF imposed into pliegos (signatures)**,
ready to fold, stack, and bind into a book.

Everything runs **in your browser** — the PDF never leaves your device, so there's
no server and nothing to upload.

## What it does

Given any PDF, BookMaker performs **saddle-stitch imposition**:

1. Pads the document with blank pages up to a multiple of the chosen pliego size.
2. Splits it into **pliegos (signatures)** of **8, 12, or 16 pages** each.
3. Arranges (imposes) the pages 2-up on each side of every physical sheet so that
   when you print double-sided, fold each pliego, stack the pliegos in order, and
   bind them, the pages read `1 → N`.

A pliego is made of `pages ÷ 4` folded sheets (8 → 2 sheets, 12 → 3, 16 → 4).

### Options

- **Pages per pliego** — `8`, `12`, or `16`.
- **Sheet size**
  - **Keep page size** — the output sheet is double-width (e.g. A4 → A3 landscape);
    pages keep their original size.
  - **Fit same paper** — the sheet is one source page turned landscape with two
    pages scaled to fit (e.g. A4 → two A5 pages on one A4 sheet).
- **Fold line & crop marks** — a faint centre fold guide and corner crop ticks.

## How to print and bind

1. Print the generated PDF **double-sided** (flip on the short edge).
2. Keep the sheets in order — every `pages ÷ 4` sheets make one pliego.
3. Fold each pliego in half.
4. Stack the pliegos in order and bind the spine (staple, sew, or glue).

## Develop

```bash
npm install
npm run dev        # start the dev server
npm run build      # typecheck + production build into dist/
npm run preview    # serve the production build
npm run typecheck  # type-check only
```

The site is a static bundle (`dist/`) and can be hosted on any static host
(GitHub Pages, Netlify, etc.). `vite.config.ts` uses a relative `base` so it works
from a subpath.

## How it works

- **`src/imposition.ts`** — the imposition engine (pure logic + `pdf-lib` layout).
  - `signatureOrder(n)` returns the sheet ordering for one signature.
  - `buildSheetPlan(total, size)` builds the duplex-ready plan for the whole doc.
  - `imposePdf(bytes, options)` renders the final print-ready PDF.
- **`src/main.ts`** — UI wiring (file input, drag & drop, options, download).

Built with [pdf-lib](https://pdflib.js.org/) and [Vite](https://vitejs.dev/).

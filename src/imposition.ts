import { PDFDocument, PDFPage, PDFEmbeddedPage, rgb } from 'pdf-lib';

export type SignatureSize = 8 | 12 | 16;

/** How the imposed sheet relates to the source page size. */
export type LayoutMode =
  /** Sheet = twice the source width (e.g. A4 -> A3). Pages stay full size. */
  | 'spread'
  /** Sheet = one source page rotated to landscape. Two pages scaled to fit (A4 -> 2x A5). */
  | 'fit';

export interface ImposeOptions {
  signatureSize: SignatureSize;
  layout: LayoutMode;
  /** Draw a faint vertical line at the fold + light crop ticks. */
  foldGuides: boolean;
}

export interface ImposeResult {
  bytes: Uint8Array;
  /** Number of source pages in the original document. */
  sourcePages: number;
  /** Total book pages after padding to a multiple of the signature size. */
  paddedPages: number;
  /** Number of pliegos (signatures) produced. */
  signatures: number;
  /** Number of physical sheets (each printed on both sides). */
  sheets: number;
  /** Blank pages added as padding. */
  blanksAdded: number;
}

/** One side of a physical sheet: the (1-indexed, signature-local) page in each slot. */
interface SheetSide {
  left: number;
  right: number;
}
interface Sheet {
  front: SheetSide;
  back: SheetSide;
}

/**
 * Saddle-stitch imposition order for a single signature of `n` pages
 * (n must be a multiple of 4). Page numbers are 1-indexed *within* the
 * signature. When the sheets are printed duplex, stacked in order, and
 * folded in half together, the pages read 1..n.
 */
export function signatureOrder(n: number): Sheet[] {
  if (n % 4 !== 0) {
    throw new Error(`Signature size must be a multiple of 4, got ${n}`);
  }
  const sheets: Sheet[] = [];
  const sheetCount = n / 4;
  for (let i = 0; i < sheetCount; i++) {
    sheets.push({
      front: { left: n - 2 * i, right: 1 + 2 * i },
      back: { left: 2 + 2 * i, right: n - 1 - 2 * i },
    });
  }
  return sheets;
}

/**
 * Build the full ordered list of book-page numbers (1-indexed across the whole
 * document, 0 meaning "blank") for every side of every sheet, across all
 * signatures. Output order is duplex-ready: front, back, front, back, ...
 */
export function buildSheetPlan(
  totalPages: number,
  signatureSize: SignatureSize,
): { sides: SheetSide[]; padded: number; signatures: number } {
  const padded = Math.ceil(totalPages / signatureSize) * signatureSize;
  const signatures = padded / signatureSize;
  const sides: SheetSide[] = [];

  for (let s = 0; s < signatures; s++) {
    const base = s * signatureSize; // 0-indexed offset of this signature
    const order = signatureOrder(signatureSize);
    for (const sheet of order) {
      // Map signature-local page numbers to global page numbers (or 0 = blank).
      const map = (local: number): number => {
        const global = base + local; // local is 1-indexed within signature
        return global <= totalPages ? global : 0;
      };
      sides.push({ left: map(sheet.front.left), right: map(sheet.front.right) });
      sides.push({ left: map(sheet.back.left), right: map(sheet.back.right) });
    }
  }

  return { sides, padded, signatures };
}

interface Slot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Draw an embedded source page scaled to fit (and centered) inside a slot. */
function drawInSlot(page: PDFPage, embedded: PDFEmbeddedPage, slot: Slot): void {
  const scale = Math.min(slot.w / embedded.width, slot.h / embedded.height);
  const w = embedded.width * scale;
  const h = embedded.height * scale;
  const x = slot.x + (slot.w - w) / 2;
  const y = slot.y + (slot.h - h) / 2;
  page.drawPage(embedded, { x, y, width: w, height: h });
}

/**
 * Impose a source PDF into a print-ready booklet PDF divided into signatures.
 */
export async function imposePdf(
  input: ArrayBuffer | Uint8Array,
  options: ImposeOptions,
): Promise<ImposeResult> {
  const src = await PDFDocument.load(input);
  const sourcePages = src.getPageCount();
  if (sourcePages === 0) {
    throw new Error('The PDF has no pages.');
  }

  // Determine a uniform slot size from the largest source page so nothing clips.
  let maxW = 0;
  let maxH = 0;
  for (let i = 0; i < sourcePages; i++) {
    const { width, height } = src.getPage(i).getSize();
    maxW = Math.max(maxW, width);
    maxH = Math.max(maxH, height);
  }

  const out = await PDFDocument.create();

  // Embed every source page once, keyed by global 1-indexed page number.
  const embeddedByPage = new Map<number, PDFEmbeddedPage>();
  const srcPages = src.getPages();
  const embedded = await out.embedPages(srcPages);
  for (let i = 0; i < embedded.length; i++) {
    embeddedByPage.set(i + 1, embedded[i]);
  }

  const { sides, padded, signatures } = buildSheetPlan(sourcePages, options.signatureSize);

  // Slot + sheet geometry.
  let slotW: number;
  let slotH: number;
  let sheetW: number;
  let sheetH: number;

  if (options.layout === 'spread') {
    // Two full-size pages side by side -> sheet is double width.
    slotW = maxW;
    slotH = maxH;
    sheetW = maxW * 2;
    sheetH = maxH;
  } else {
    // Sheet is one source page turned landscape; two pages scaled to fit.
    sheetW = maxH; // landscape
    sheetH = maxW;
    slotW = sheetW / 2;
    slotH = sheetH;
  }

  for (const side of sides) {
    const page = out.addPage([sheetW, sheetH]);
    const leftSlot: Slot = { x: 0, y: 0, w: slotW, h: slotH };
    const rightSlot: Slot = { x: slotW, y: 0, w: slotW, h: slotH };

    if (side.left !== 0) {
      const e = embeddedByPage.get(side.left);
      if (e) drawInSlot(page, e, leftSlot);
    }
    if (side.right !== 0) {
      const e = embeddedByPage.get(side.right);
      if (e) drawInSlot(page, e, rightSlot);
    }

    if (options.foldGuides) {
      const gray = rgb(0.7, 0.7, 0.7);
      // Center fold line (dashed).
      page.drawLine({
        start: { x: slotW, y: 0 },
        end: { x: slotW, y: sheetH },
        thickness: 0.5,
        color: gray,
        dashArray: [4, 4],
      });
      // Corner crop ticks.
      const t = 10;
      const corners = [
        { x: 0, y: 0 },
        { x: sheetW, y: 0 },
        { x: 0, y: sheetH },
        { x: sheetW, y: sheetH },
      ];
      for (const c of corners) {
        const dx = c.x === 0 ? t : -t;
        const dy = c.y === 0 ? t : -t;
        page.drawLine({ start: c, end: { x: c.x + dx, y: c.y }, thickness: 0.5, color: gray });
        page.drawLine({ start: c, end: { x: c.x, y: c.y + dy }, thickness: 0.5, color: gray });
      }
    }
  }

  const bytes = await out.save();
  return {
    bytes,
    sourcePages,
    paddedPages: padded,
    signatures,
    sheets: sides.length / 2,
    blanksAdded: padded - sourcePages,
  };
}

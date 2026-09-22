/*
 * BookMaker imposition engine (plain browser script — no build step).
 * Uses the global `PDFLib` exposed by vendor/pdf-lib.min.js.
 *
 * Exposes on window: signatureOrder, buildSheetPlan, imposePdf.
 */
(function () {
  'use strict';

  var PDFDocument = PDFLib.PDFDocument;
  var rgb = PDFLib.rgb;

  /**
   * Saddle-stitch imposition order for a single signature of `n` pages
   * (n must be a multiple of 4). Page numbers are 1-indexed within the
   * signature. When printed duplex, stacked in order, and folded together,
   * the pages read 1..n.
   */
  function signatureOrder(n) {
    if (n % 4 !== 0) {
      throw new Error('Signature size must be a multiple of 4, got ' + n);
    }
    var sheets = [];
    var sheetCount = n / 4;
    for (var i = 0; i < sheetCount; i++) {
      sheets.push({
        front: { left: n - 2 * i, right: 1 + 2 * i },
        back: { left: 2 + 2 * i, right: n - 1 - 2 * i },
      });
    }
    return sheets;
  }

  /**
   * Build the duplex-ready list of sheet sides for the whole document.
   * Page numbers are global 1-indexed; 0 means a blank (padding) slot.
   */
  function buildSheetPlan(totalPages, signatureSize) {
    var padded = Math.ceil(totalPages / signatureSize) * signatureSize;
    var signatures = padded / signatureSize;
    var sides = [];

    for (var s = 0; s < signatures; s++) {
      var base = s * signatureSize;
      var order = signatureOrder(signatureSize);
      for (var k = 0; k < order.length; k++) {
        var sheet = order[k];
        var map = function (local) {
          var global = base + local;
          return global <= totalPages ? global : 0;
        };
        sides.push({ left: map(sheet.front.left), right: map(sheet.front.right) });
        sides.push({ left: map(sheet.back.left), right: map(sheet.back.right) });
      }
    }

    return { sides: sides, padded: padded, signatures: signatures };
  }

  /** Draw an embedded page scaled to fit (and centered) inside a slot. */
  function drawInSlot(page, embedded, slot) {
    var scale = Math.min(slot.w / embedded.width, slot.h / embedded.height);
    var w = embedded.width * scale;
    var h = embedded.height * scale;
    var x = slot.x + (slot.w - w) / 2;
    var y = slot.y + (slot.h - h) / 2;
    page.drawPage(embedded, { x: x, y: y, width: w, height: h });
  }

  /**
   * Impose a source PDF into a print-ready booklet PDF divided into signatures.
   * options: { signatureSize: 8|12|16, layout: 'spread'|'fit', foldGuides: bool }
   * Returns { bytes, sourcePages, paddedPages, signatures, sheets, blanksAdded }.
   */
  async function imposePdf(input, options) {
    var src = await PDFDocument.load(input);
    var sourcePages = src.getPageCount();
    if (sourcePages === 0) {
      throw new Error('The PDF has no pages.');
    }

    // Uniform slot size from the largest page so nothing clips.
    var maxW = 0;
    var maxH = 0;
    for (var i = 0; i < sourcePages; i++) {
      var size = src.getPage(i).getSize();
      maxW = Math.max(maxW, size.width);
      maxH = Math.max(maxH, size.height);
    }

    var out = await PDFDocument.create();

    var srcPages = src.getPages();
    var embedded = await out.embedPages(srcPages);
    var embeddedByPage = {};
    for (var e = 0; e < embedded.length; e++) {
      embeddedByPage[e + 1] = embedded[e];
    }

    var plan = buildSheetPlan(sourcePages, options.signatureSize);

    var slotW, slotH, sheetW, sheetH;
    if (options.layout === 'spread') {
      slotW = maxW;
      slotH = maxH;
      sheetW = maxW * 2;
      sheetH = maxH;
    } else {
      sheetW = maxH; // landscape
      sheetH = maxW;
      slotW = sheetW / 2;
      slotH = sheetH;
    }

    for (var si = 0; si < plan.sides.length; si++) {
      var side = plan.sides[si];
      var page = out.addPage([sheetW, sheetH]);
      var leftSlot = { x: 0, y: 0, w: slotW, h: slotH };
      var rightSlot = { x: slotW, y: 0, w: slotW, h: slotH };

      if (side.left !== 0 && embeddedByPage[side.left]) {
        drawInSlot(page, embeddedByPage[side.left], leftSlot);
      }
      if (side.right !== 0 && embeddedByPage[side.right]) {
        drawInSlot(page, embeddedByPage[side.right], rightSlot);
      }

      if (options.foldGuides) {
        var gray = rgb(0.7, 0.7, 0.7);
        page.drawLine({
          start: { x: slotW, y: 0 },
          end: { x: slotW, y: sheetH },
          thickness: 0.5,
          color: gray,
          dashArray: [4, 4],
        });
        var t = 10;
        var corners = [
          { x: 0, y: 0 },
          { x: sheetW, y: 0 },
          { x: 0, y: sheetH },
          { x: sheetW, y: sheetH },
        ];
        for (var c = 0; c < corners.length; c++) {
          var corner = corners[c];
          var dx = corner.x === 0 ? t : -t;
          var dy = corner.y === 0 ? t : -t;
          page.drawLine({ start: corner, end: { x: corner.x + dx, y: corner.y }, thickness: 0.5, color: gray });
          page.drawLine({ start: corner, end: { x: corner.x, y: corner.y + dy }, thickness: 0.5, color: gray });
        }
      }
    }

    var bytes = await out.save();
    return {
      bytes: bytes,
      sourcePages: sourcePages,
      paddedPages: plan.padded,
      signatures: plan.signatures,
      sheets: plan.sides.length / 2,
      blanksAdded: plan.padded - sourcePages,
    };
  }

  window.signatureOrder = signatureOrder;
  window.buildSheetPlan = buildSheetPlan;
  window.imposePdf = imposePdf;
})();

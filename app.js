/* BookMaker UI (plain browser script — no build step). */
(function () {
  'use strict';

  function $(sel) {
    var el = document.querySelector(sel);
    if (!el) throw new Error('Missing element: ' + sel);
    return el;
  }

  var fileInput = $('#file');
  var drop = $('#drop');
  var chooseBtn = $('#chooseBtn');
  var fileInfo = $('#fileInfo');
  var generateBtn = $('#generate');
  var statusEl = $('#status');
  var resultCard = $('#result');
  var summary = $('#summary');
  var downloadLink = $('#download');
  var foldGuides = $('#foldGuides');
  var layoutHint = $('#layoutHint');
  var sheetsPerSig = $('#sheetsPerSig');
  var sheetsPerSig2 = $('#sheetsPerSig2');

  var selectedFile = null;
  var signatureSize = 16;
  var layout = 'spread';
  var lastUrl = null;

  // --- Segmented controls ---------------------------------------------------
  function wireSegmented(id, onChange) {
    var group = $(id);
    var buttons = group.querySelectorAll('button');
    buttons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        buttons.forEach(function (b) {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        onChange(btn.dataset.value);
      });
    });
  }

  wireSegmented('#sigSize', function (v) {
    signatureSize = Number(v);
    var perSig = String(signatureSize / 4);
    sheetsPerSig.textContent = perSig;
    sheetsPerSig2.textContent = perSig;
  });

  wireSegmented('#layout', function (v) {
    layout = v;
    layoutHint.textContent =
      layout === 'spread'
        ? 'double-width sheet (A4 → A3 landscape); pages stay full size'
        : 'same paper turned landscape with two scaled pages (A4 → 2× A5)';
  });

  // --- File selection -------------------------------------------------------
  function setFile(file) {
    if (file && file.type !== 'application/pdf' && !/\.pdf$/i.test(file.name)) {
      setStatus('Please choose a PDF file.', 'error');
      return;
    }
    selectedFile = file;
    if (file) {
      var kb = file.size / 1024;
      var size = kb > 1024 ? (kb / 1024).toFixed(1) + ' MB' : kb.toFixed(0) + ' KB';
      fileInfo.textContent = file.name + ' · ' + size;
      generateBtn.disabled = false;
      setStatus('');
    } else {
      fileInfo.textContent = 'no file selected';
      generateBtn.disabled = true;
    }
  }

  fileInput.addEventListener('change', function () {
    setFile(fileInput.files && fileInput.files[0] ? fileInput.files[0] : null);
  });

  // Explicit upload button.
  chooseBtn.addEventListener('click', function (e) {
    e.stopPropagation();
    fileInput.click();
  });

  // The whole dropzone is also clickable (button clicks stop propagation).
  drop.addEventListener('click', function () {
    fileInput.click();
  });

  ['dragenter', 'dragover'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) {
      e.preventDefault();
      drop.classList.add('over');
    });
  });
  ['dragleave', 'drop'].forEach(function (evt) {
    drop.addEventListener(evt, function (e) {
      e.preventDefault();
      drop.classList.remove('over');
    });
  });
  drop.addEventListener('drop', function (e) {
    if (e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files.length) {
      setFile(e.dataTransfer.files[0]);
    }
  });

  // --- Status ---------------------------------------------------------------
  function setStatus(msg, kind) {
    statusEl.textContent = msg;
    statusEl.className = 'status' + (msg ? ' ' + (kind || 'info') : '');
  }

  // --- Generate -------------------------------------------------------------
  generateBtn.addEventListener('click', async function () {
    if (!selectedFile) return;
    generateBtn.disabled = true;
    setStatus('Reading and imposing your PDF…', 'busy');
    resultCard.hidden = true;

    try {
      var buffer = await selectedFile.arrayBuffer();
      var result = await window.imposePdf(buffer, {
        signatureSize: signatureSize,
        layout: layout,
        foldGuides: foldGuides.checked,
      });
      showResult(result, selectedFile.name);
      setStatus('');
    } catch (err) {
      console.error(err);
      var message = err && err.message ? err.message : 'Something went wrong.';
      setStatus('Could not process this PDF: ' + message, 'error');
    } finally {
      generateBtn.disabled = false;
    }
  });

  function showResult(result, originalName) {
    if (lastUrl) URL.revokeObjectURL(lastUrl);
    var blob = new Blob([result.bytes], { type: 'application/pdf' });
    lastUrl = URL.createObjectURL(blob);

    var outName = originalName.replace(/\.pdf$/i, '') + '-booklet.pdf';
    downloadLink.href = lastUrl;
    downloadLink.download = outName;

    summary.innerHTML = '';
    var rows = [
      ['Original pages', String(result.sourcePages)],
      ['Pages per pliego', String(signatureSize)],
      ['Pliegos (signatures)', String(result.signatures)],
      ['Sheets (printed both sides)', String(result.sheets)],
      ['Blank pages added', String(result.blanksAdded)],
    ];
    rows.forEach(function (pair) {
      var rowEl = document.createElement('div');
      rowEl.className = 'm-row';
      rowEl.innerHTML = '<dt>' + pair[0] + '</dt><dd>' + pair[1] + '</dd>';
      summary.appendChild(rowEl);
    });

    resultCard.hidden = false;
    resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }
})();

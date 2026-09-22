import '@fontsource/jetbrains-mono/400.css';
import '@fontsource/jetbrains-mono/500.css';
import '@fontsource/jetbrains-mono/700.css';
import './style.css';
import { imposePdf, type SignatureSize, type LayoutMode, type ImposeResult } from './imposition';

const $ = <T extends HTMLElement>(sel: string): T => {
  const el = document.querySelector<T>(sel);
  if (!el) throw new Error(`Missing element: ${sel}`);
  return el;
};

const fileInput = $<HTMLInputElement>('#file');
const drop = $<HTMLDivElement>('#drop');
const chooseBtn = $<HTMLButtonElement>('#chooseBtn');
const fileInfo = $<HTMLParagraphElement>('#fileInfo');
const generateBtn = $<HTMLButtonElement>('#generate');
const statusEl = $<HTMLDivElement>('#status');
const resultCard = $<HTMLElement>('#result');
const summary = $<HTMLUListElement>('#summary');
const downloadLink = $<HTMLAnchorElement>('#download');
const foldGuides = $<HTMLInputElement>('#foldGuides');
const layoutHint = $<HTMLParagraphElement>('#layoutHint');
const sheetsPerSig = $<HTMLSpanElement>('#sheetsPerSig');
const sheetsPerSig2 = $<HTMLSpanElement>('#sheetsPerSig2');

let selectedFile: File | null = null;
let signatureSize: SignatureSize = 16;
let layout: LayoutMode = 'spread';
let lastUrl: string | null = null;

// --- Segmented controls -----------------------------------------------------
function wireSegmented(id: string, onChange: (value: string) => void) {
  const group = $<HTMLDivElement>(id);
  group.querySelectorAll<HTMLButtonElement>('button').forEach((btn) => {
    btn.addEventListener('click', () => {
      group.querySelectorAll<HTMLButtonElement>('button').forEach((b) => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      onChange(btn.dataset.value!);
    });
  });
}

wireSegmented('#sigSize', (v) => {
  signatureSize = Number(v) as SignatureSize;
  const perSig = String(signatureSize / 4);
  sheetsPerSig.textContent = perSig;
  sheetsPerSig2.textContent = perSig;
});

wireSegmented('#layout', (v) => {
  layout = v as LayoutMode;
  layoutHint.textContent =
    layout === 'spread'
      ? 'Double-width sheet (e.g. A4 → A3 landscape). Pages stay full size.'
      : 'Same paper turned landscape with two scaled pages (e.g. A4 → 2× A5).';
});

// --- File selection ---------------------------------------------------------
function setFile(file: File | null) {
  if (file && file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
    setStatus('Please choose a PDF file.', 'error');
    return;
  }
  selectedFile = file;
  if (file) {
    const kb = file.size / 1024;
    const size = kb > 1024 ? `${(kb / 1024).toFixed(1)} MB` : `${kb.toFixed(0)} KB`;
    fileInfo.textContent = `${file.name} · ${size}`;
    generateBtn.disabled = false;
    setStatus('');
  } else {
    fileInfo.textContent = 'No file selected';
    generateBtn.disabled = true;
  }
}

fileInput.addEventListener('change', () => setFile(fileInput.files?.[0] ?? null));

// Explicit upload button.
chooseBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  fileInput.click();
});

// The whole dropzone is also clickable (button clicks stop propagation above,
// so they don't trigger this twice).
drop.addEventListener('click', () => fileInput.click());

['dragenter', 'dragover'].forEach((evt) =>
  drop.addEventListener(evt, (e) => {
    e.preventDefault();
    drop.classList.add('over');
  }),
);
['dragleave', 'drop'].forEach((evt) =>
  drop.addEventListener(evt, (e) => {
    e.preventDefault();
    drop.classList.remove('over');
  }),
);
drop.addEventListener('drop', (e) => {
  const dt = (e as DragEvent).dataTransfer;
  if (dt?.files?.length) setFile(dt.files[0]);
});

// --- Status helpers ---------------------------------------------------------
function setStatus(msg: string, kind: 'info' | 'error' | 'busy' = 'info') {
  statusEl.textContent = msg;
  statusEl.className = `status ${msg ? kind : ''}`.trim();
}

// --- Generate ---------------------------------------------------------------
generateBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  generateBtn.disabled = true;
  setStatus('Reading and imposing your PDF…', 'busy');
  resultCard.hidden = true;

  try {
    const buffer = await selectedFile.arrayBuffer();
    const result = await imposePdf(buffer, {
      signatureSize,
      layout,
      foldGuides: foldGuides.checked,
    });
    showResult(result, selectedFile.name);
    setStatus('');
  } catch (err) {
    console.error(err);
    const message = err instanceof Error ? err.message : 'Something went wrong.';
    setStatus(`Could not process this PDF: ${message}`, 'error');
  } finally {
    generateBtn.disabled = false;
  }
});

function showResult(result: ImposeResult, originalName: string) {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  const blob = new Blob([result.bytes as BlobPart], { type: 'application/pdf' });
  lastUrl = URL.createObjectURL(blob);

  const outName = originalName.replace(/\.pdf$/i, '') + '-booklet.pdf';
  downloadLink.href = lastUrl;
  downloadLink.download = outName;

  summary.innerHTML = '';
  const rows: [string, string][] = [
    ['Original pages', String(result.sourcePages)],
    ['Pages per pliego', String(signatureSize)],
    ['Pliegos (signatures)', String(result.signatures)],
    ['Sheets (printed both sides)', String(result.sheets)],
    ['Blank pages added', String(result.blanksAdded)],
  ];
  for (const [label, value] of rows) {
    const li = document.createElement('li');
    li.innerHTML = `<span>${label}</span><strong>${value}</strong>`;
    summary.appendChild(li);
  }

  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

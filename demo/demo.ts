import { MuseScoreDisplay } from "../src/index";
import { jsPDF } from "jspdf";

// --- Sample files ---
const samples: Record<string, string> = {
  "Feature Test (all supported features)":
    "samples/musescore-display-feature-test.mscz",
  "Hark the Herald Angels Sing (organ, v2)":
    "samples/Hark the Herald Angels Sing (No 209).mscx",
  "Hark the Herald Angels Sing (clarinet + piano, v3)":
    "samples/hark-the-herald-angels-sing-clarinet-piano.mscz",
  "Boze svetov mocny pane (choir, v3, lyrics + slurs)":
    "samples/boze-svetov-mocny-pane-jks238-andrej-radlinsky.mscz",
  "O tajomstvach umucenia (choir, v3)":
    "samples/o-tajomstvach-umucenia-jks191-mikulas-schneider-trnavsky.mscz",
};

// --- Key definitions (circle of fifths) ---
interface KeyDef {
  fifths: number;
  major: string;
  minor: string;
}

const ALL_KEYS: KeyDef[] = [
  { fifths: -7, major: "Cb", minor: "Ab" },
  { fifths: -6, major: "Gb", minor: "Eb" },
  { fifths: -5, major: "Db", minor: "Bb" },
  { fifths: -4, major: "Ab", minor: "F" },
  { fifths: -3, major: "Eb", minor: "C" },
  { fifths: -2, major: "Bb", minor: "G" },
  { fifths: -1, major: "F", minor: "D" },
  { fifths: 0, major: "C", minor: "A" },
  { fifths: 1, major: "G", minor: "E" },
  { fifths: 2, major: "D", minor: "B" },
  { fifths: 3, major: "A", minor: "F#" },
  { fifths: 4, major: "E", minor: "C#" },
  { fifths: 5, major: "B", minor: "G#" },
  { fifths: 6, major: "F#", minor: "D#" },
  { fifths: 7, major: "C#", minor: "A#" },
];

// --- DOM elements ---
const sampleSelect = document.getElementById("sample-select") as HTMLSelectElement;
const fileInput = document.getElementById("file-input") as HTMLInputElement;
const zoomInBtn = document.getElementById("zoom-in")!;
const zoomOutBtn = document.getElementById("zoom-out")!;
const zoomResetBtn = document.getElementById("zoom-reset")!;
const zoomDisplay = document.getElementById("zoom-display")!;
const statusBar = document.getElementById("status-bar")!;
const statusText = document.getElementById("status-text")!;
const errorBanner = document.getElementById("error-banner")!;
const errorMessage = document.getElementById("error-message")!;
const errorDetail = document.getElementById("error-detail")!;
const emptyState = document.getElementById("empty-state")!;
const dropOverlay = document.getElementById("drop-overlay")!;
const openFileBtn = document.getElementById("open-file-btn")!;
const keySelect = document.getElementById("key-select") as HTMLSelectElement;
const originalKeyBadge = document.getElementById("original-key")!;
const transposeInput = document.getElementById("transpose-input") as HTMLInputElement;
const transposeDirection = document.getElementById("transpose-direction") as HTMLSelectElement;
const btnTranspose = document.getElementById("btn-transpose") as HTMLButtonElement;
const btnRerender = document.getElementById("btn-rerender") as HTMLButtonElement;
const btnDownloadXml = document.getElementById("btn-download-xml") as HTMLButtonElement;
const btnClear = document.getElementById("btn-clear") as HTMLButtonElement;
const cursorPrevBtn = document.getElementById("cursor-prev") as HTMLButtonElement;
const cursorNextBtn = document.getElementById("cursor-next") as HTMLButtonElement;
const cursorToggleBtn = document.getElementById("cursor-toggle") as HTMLButtonElement;
let cursorVisible = false;
const cursorResetBtn = document.getElementById("cursor-reset") as HTMLButtonElement;
const followCursorCheckbox = document.getElementById("follow-cursor") as HTMLInputElement;
const backendSelect = document.getElementById("backend-select") as HTMLSelectElement;
const pageFormatSelect = document.getElementById("page-format-select") as HTMLSelectElement;
const btnDarkMode = document.getElementById("btn-dark-mode") as HTMLButtonElement;
const btnPrint = document.getElementById("btn-print") as HTMLButtonElement;
const scoreContainer = document.getElementById("score-container")!;

// --- Init ---
const display = new MuseScoreDisplay("score-container");
let currentFile = "";

// Populate sample dropdown
for (const [name, _url] of Object.entries(samples)) {
  const option = document.createElement("option");
  option.value = name;
  option.textContent = name;
  sampleSelect.appendChild(option);
}

// Populate key dropdown
for (const k of ALL_KEYS) {
  const option = document.createElement("option");
  option.value = String(k.fifths);
  option.textContent = `${k.major} major / ${k.minor} minor`;
  keySelect.appendChild(option);
}

// --- Status helpers ---
function setStatus(text: string, type: "info" | "loading" | "success" | "error" = "info") {
  statusBar.className = "status-bar";
  if (type === "loading") statusBar.classList.add("loading");
  if (type === "success") statusBar.classList.add("success");
  if (type === "error") statusBar.classList.add("error");
  statusText.textContent = text;
}

function showError(message: string, detail?: string) {
  errorBanner.classList.add("visible");
  errorMessage.textContent = message;
  errorDetail.textContent = detail || "";
}

function clearError() {
  errorBanner.classList.remove("visible");
  errorMessage.textContent = "";
  errorDetail.textContent = "";
}

function updateZoomDisplay() {
  zoomDisplay.textContent = Math.round(display.zoom * 100) + "%";
}

function updateKeyDisplay() {
  const key = display.originalKey;
  if (key) {
    originalKeyBadge.textContent = key.name;
    originalKeyBadge.title = `Detected key: ${key.name} (${key.fifths} fifths)`;
    keySelect.disabled = false;
    // Pre-select the original key in the dropdown
    keySelect.value = String(key.fifths);
  } else {
    originalKeyBadge.textContent = "--";
    originalKeyBadge.title = "No key signature detected";
    keySelect.disabled = true;
    keySelect.value = "";
  }
}

function enableActions() {
  btnRerender.disabled = false;
  btnDownloadXml.disabled = false;
  btnClear.disabled = false;
  btnTranspose.disabled = false;
  cursorPrevBtn.disabled = false;
  cursorNextBtn.disabled = false;
  cursorToggleBtn.disabled = false;
  cursorResetBtn.disabled = false;
  backendSelect.disabled = false;
  pageFormatSelect.disabled = false;
  btnDarkMode.disabled = false;
  btnPrint.disabled = false;
}

function disableActions() {
  btnRerender.disabled = true;
  btnDownloadXml.disabled = true;
  btnClear.disabled = true;
  btnTranspose.disabled = true;
  keySelect.disabled = true;
  cursorPrevBtn.disabled = true;
  cursorNextBtn.disabled = true;
  cursorToggleBtn.disabled = true;
  cursorVisible = false;
  cursorToggleBtn.textContent = "Show Cursor";
  cursorResetBtn.disabled = true;
  backendSelect.disabled = true;
  pageFormatSelect.disabled = true;
  btnDarkMode.disabled = true;
  btnPrint.disabled = true;
}

// --- Load helpers ---
async function loadFromUrl(url: string, name: string) {
  clearError();
  emptyState.style.display = "none";
  setStatus(`Loading ${name}...`, "loading");

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    const buffer = await response.arrayBuffer();
    await display.load(buffer);
    currentFile = name;
    transposeInput.value = "0";
    setStatus(`Loaded: ${name}`, "success");
    enableActions();
    updateZoomDisplay();
    updateKeyDisplay();
    (window as any).__lastMusicXml = display.lastMusicXml;
    console.log("Generated MusicXML available at window.__lastMusicXml");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Failed to load: ${name}`, "error");
    showError(msg, err instanceof Error ? err.stack : undefined);
    console.error("Load error:", err);
  }
}

async function loadFile(file: File) {
  clearError();
  emptyState.style.display = "none";
  setStatus(`Loading ${file.name}...`, "loading");

  try {
    await display.load(file);
    currentFile = file.name;
    transposeInput.value = "0";
    setStatus(`Loaded: ${file.name}`, "success");
    enableActions();
    updateZoomDisplay();
    updateKeyDisplay();
    (window as any).__lastMusicXml = display.lastMusicXml;
    console.log("Generated MusicXML available at window.__lastMusicXml");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus(`Failed to load: ${file.name}`, "error");
    showError(msg, err instanceof Error ? err.stack : undefined);
    console.error("Load error:", err);
  }
}

// --- Event listeners ---

// Sample dropdown
sampleSelect.addEventListener("change", () => {
  const name = sampleSelect.value;
  if (!name) return;
  const url = samples[name];
  if (url) loadFromUrl(url, name);
});

// File picker - button triggers hidden input
openFileBtn.addEventListener("click", () => {
  fileInput.click();
});

fileInput.addEventListener("change", () => {
  const file = fileInput.files?.[0];
  if (!file) return;
  sampleSelect.value = "";
  loadFile(file);
});

// Zoom
zoomInBtn.addEventListener("click", () => {
  display.zoom = display.zoom * 1.2;
  updateZoomDisplay();
});

zoomOutBtn.addEventListener("click", () => {
  display.zoom = display.zoom / 1.2;
  updateZoomDisplay();
});

zoomResetBtn.addEventListener("click", () => {
  display.zoom = 1.0;
  updateZoomDisplay();
});

// Key transposition dropdown
keySelect.addEventListener("change", () => {
  const val = keySelect.value;
  if (val === "") return;
  const targetFifths = parseInt(val);
  const direction = transposeDirection.value as "auto" | "up" | "down";
  clearError();
  const keyDef = ALL_KEYS.find((k) => k.fifths === targetFifths);
  const keyLabel = keyDef ? `${keyDef.major} major / ${keyDef.minor} minor` : `fifths=${targetFifths}`;
  setStatus(`Transposing to ${keyLabel} (${direction})...`, "loading");
  try {
    display.transposeToKey(targetFifths, direction);
    // Update semitones input to reflect the computed value
    transposeInput.value = String(display.currentTranspose);
    setStatus(`Transposed to ${keyLabel}: ${currentFile}`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("Transpose failed", "error");
    showError(msg);
  }
});

// Re-transpose when direction changes while a key is selected
transposeDirection.addEventListener("change", () => {
  const val = keySelect.value;
  if (val === "") return;
  keySelect.dispatchEvent(new Event("change"));
});

// Transpose by semitones
btnTranspose.addEventListener("click", () => {
  const semitones = parseInt(transposeInput.value) || 0;
  clearError();
  setStatus(`Transposing by ${semitones} semitone(s)...`, "loading");
  try {
    display.transpose(semitones);
    setStatus(`Transposed by ${semitones} semitone(s): ${currentFile}`, "success");
    // Update key dropdown to reflect new key if possible
    syncKeyDropdownFromSemitones(semitones);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("Transpose failed", "error");
    showError(msg);
  }
});

/** Sync the key dropdown selection after manual semitone transposition. */
function syncKeyDropdownFromSemitones(semitones: number) {
  const orig = display.originalKey;
  if (!orig) return;
  // Compute the target fifths from semitones
  // semitones = ((deltaFifths * 7) % 12 + 12) % 12, solve for deltaFifths
  // Each semitone = 7 fifths (mod 12), so deltaFifths = (semitones * 7) % 12
  let deltaFifths = ((semitones * 7) % 12 + 12) % 12;
  if (deltaFifths > 6) deltaFifths -= 12;
  const targetFifths = orig.fifths + deltaFifths;
  if (targetFifths >= -7 && targetFifths <= 7) {
    keySelect.value = String(targetFifths);
  } else {
    keySelect.value = "";
  }
}

transposeInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !btnTranspose.disabled) {
    btnTranspose.click();
  }
});

// Re-render
btnRerender.addEventListener("click", () => {
  if (display.lastMusicXml) {
    setStatus("Re-rendering...", "loading");
    try {
      display.osmdInstance.render();
      setStatus(`Rendered: ${currentFile}`, "success");
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setStatus("Re-render failed", "error");
      showError(msg);
    }
  }
});

// Download MusicXML
btnDownloadXml.addEventListener("click", () => {
  const xml = display.lastMusicXml;
  if (!xml) return;
  const blob = new Blob([xml], { type: "application/xml" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = (currentFile.replace(/\.(mscz|mscx)$/i, "") || "score") + ".musicxml";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
});

// Clear
btnClear.addEventListener("click", () => {
  display.clear();
  currentFile = "";
  sampleSelect.value = "";
  transposeInput.value = "0";
  keySelect.value = "";
  keySelect.disabled = true;
  originalKeyBadge.textContent = "--";
  backendSelect.value = "svg";
  pageFormatSelect.value = "Endless";
  btnDarkMode.textContent = "Dark Mode";
  btnDarkMode.classList.remove("active");
  scoreContainer.style.background = "white";
  followCursorCheckbox.checked = false;
  setStatus("Score cleared.");
  disableActions();
  emptyState.style.display = "";
});

// --- Cursor controls ---
cursorToggleBtn.addEventListener("click", () => {
  cursorVisible = !cursorVisible;
  if (cursorVisible) {
    display.showCursor();
    cursorToggleBtn.textContent = "Hide Cursor";
  } else {
    display.hideCursor();
    cursorToggleBtn.textContent = "Show Cursor";
  }
});

cursorNextBtn.addEventListener("click", () => {
  display.cursorNext();
});

cursorPrevBtn.addEventListener("click", () => {
  display.cursorPrevious();
});

cursorResetBtn.addEventListener("click", () => {
  display.cursorReset();
});

followCursorCheckbox.addEventListener("change", () => {
  display.followCursor = followCursorCheckbox.checked;
});

// --- Backend switch ---
backendSelect.addEventListener("change", async () => {
  const backend = backendSelect.value as "svg" | "canvas";
  setStatus(`Switching to ${backend.toUpperCase()} backend...`, "loading");
  try {
    await display.setBackend(backend);
    setStatus(`Rendered with ${backend.toUpperCase()} backend: ${currentFile}`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("Backend switch failed", "error");
    showError(msg);
  }
});

// --- Page format ---
pageFormatSelect.addEventListener("change", async () => {
  const format = pageFormatSelect.value;
  setStatus(`Switching to ${format} page format...`, "loading");
  try {
    await display.setPageFormat(format);
    setStatus(`Page format: ${format} — ${currentFile}`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("Page format change failed", "error");
    showError(msg);
  }
});

// --- Dark mode ---
btnDarkMode.addEventListener("click", async () => {
  setStatus("Toggling dark mode...", "loading");
  try {
    await display.toggleDarkMode();
    const isDark = display.darkMode;
    btnDarkMode.textContent = isDark ? "Light Mode" : "Dark Mode";
    btnDarkMode.classList.toggle("active", isDark);
    scoreContainer.style.background = isDark ? "#000" : "white";
    setStatus(`Dark mode ${isDark ? "ON" : "OFF"}: ${currentFile}`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("Dark mode toggle failed", "error");
    showError(msg);
  }
});

// --- Print / PDF ---

/** Convert an SVG element to a JPEG data URL via canvas rendering. */
function svgElementToDataUrl(svgElement: SVGSVGElement, scale = 2, jpegQuality = 0.9): Promise<string> {
  return new Promise((resolve, reject) => {
    const clone = svgElement.cloneNode(true) as SVGSVGElement;
    if (!clone.getAttribute("xmlns")) {
      clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    }
    if (!clone.getAttribute("xmlns:xlink")) {
      clone.setAttribute("xmlns:xlink", "http://www.w3.org/1999/xlink");
    }

    const width = svgElement.clientWidth || svgElement.getBoundingClientRect().width;
    const height = svgElement.clientHeight || svgElement.getBoundingClientRect().height;
    clone.setAttribute("width", String(width));
    clone.setAttribute("height", String(height));

    const svgData = new XMLSerializer().serializeToString(clone);
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(svgBlob);

    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext("2d")!;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.drawImage(img, 0, 0, width, height);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL("image/jpeg", jpegQuality));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to render SVG to image"));
    };
    img.src = url;
  });
}

/** Create a PDF from the rendered score using jsPDF (matches OSMD demo approach). */
async function createPdf() {
  const osmd = display.osmdInstance;
  const backends = (osmd as any).drawer?.Backends as any[] | undefined;
  if (!backends || backends.length === 0) {
    showError("No rendered pages found. Make sure a score is loaded with SVG backend.");
    return;
  }

  const svgElement: SVGSVGElement = backends[0].getSvgElement();
  let pageWidth = 210;
  let pageHeight = 297;

  const pageFormat = (osmd as any).rules?.PageFormat ?? osmd.EngravingRules?.PageFormat;
  if (pageFormat && !pageFormat.IsUndefined) {
    pageWidth = pageFormat.width;
    pageHeight = pageFormat.height;
  } else {
    pageHeight = pageWidth * svgElement.clientHeight / svgElement.clientWidth;
  }

  const orientation = pageHeight > pageWidth ? "p" : "l";
  const pdf = new jsPDF({
    orientation: orientation as "p" | "l",
    unit: "mm",
    format: [pageWidth, pageHeight],
  });

  for (let idx = 0; idx < backends.length; idx++) {
    if (idx > 0) {
      pdf.addPage();
    }
    const pageSvg: SVGSVGElement = backends[idx].getSvgElement();
    const imageDataUrl = await svgElementToDataUrl(pageSvg);
    pdf.addImage(imageDataUrl, "JPEG", 0, 0, pageWidth, pageHeight);
  }

  const pdfName = (currentFile.replace(/\.(mscz|mscx)$/i, "") || "score") + ".pdf";
  pdf.save(pdfName);
}

btnPrint.addEventListener("click", async () => {
  setStatus("Creating PDF...", "loading");
  try {
    await createPdf();
    setStatus(`PDF created: ${currentFile}`, "success");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    setStatus("PDF creation failed", "error");
    showError(msg);
  }
});

// --- Drag and drop ---
let dragCounter = 0;

document.addEventListener("dragenter", (e) => {
  e.preventDefault();
  dragCounter++;
  if (dragCounter === 1) dropOverlay.classList.add("visible");
});

document.addEventListener("dragleave", (e) => {
  e.preventDefault();
  dragCounter--;
  if (dragCounter === 0) dropOverlay.classList.remove("visible");
});

document.addEventListener("dragover", (e) => {
  e.preventDefault();
});

document.addEventListener("drop", (e) => {
  e.preventDefault();
  dragCounter = 0;
  dropOverlay.classList.remove("visible");

  const file = e.dataTransfer?.files[0];
  if (file && /\.(mscz|mscx)$/i.test(file.name)) {
    sampleSelect.value = "";
    loadFile(file);
  } else if (file) {
    showError(`Unsupported file type: ${file.name}. Please use .mscz or .mscx files.`);
  }
});

// --- Keyboard shortcuts ---
document.addEventListener("keydown", (e) => {
  // Skip if user is typing in an input/select
  const tag = (e.target as HTMLElement)?.tagName;
  const isInput = tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";

  if (e.key === "+" || e.key === "=") {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      display.zoom = display.zoom * 1.2;
      updateZoomDisplay();
    }
  } else if (e.key === "-") {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      display.zoom = display.zoom / 1.2;
      updateZoomDisplay();
    }
  } else if (e.key === "0") {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      display.zoom = 1.0;
      updateZoomDisplay();
    }
  } else if (e.key === "ArrowRight" && !isInput && !cursorNextBtn.disabled) {
    e.preventDefault();
    display.cursorNext();
  } else if (e.key === "ArrowLeft" && !isInput && !cursorPrevBtn.disabled) {
    e.preventDefault();
    display.cursorPrevious();
  }
});

// --- URL parameter: load sample by index or name ---
const urlParams = new URLSearchParams(window.location.search);
const sampleParam = urlParams.get("sample");
if (sampleParam) {
  const idx = parseInt(sampleParam);
  const keys = Object.keys(samples);
  if (!isNaN(idx) && idx >= 0 && idx < keys.length) {
    sampleSelect.value = keys[idx];
    loadFromUrl(samples[keys[idx]], keys[idx]);
  } else {
    const match = keys.find((k) => k.toLowerCase().includes(sampleParam.toLowerCase()));
    if (match) {
      sampleSelect.value = match;
      loadFromUrl(samples[match], match);
    }
  }
}

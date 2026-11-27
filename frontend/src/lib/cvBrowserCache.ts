import type { CVAnalysis } from "./types";

export interface CachedCvData {
  cvText: string;
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
  extractionMethod?: string;
  updatedAt: string;
  analysis?: CVAnalysis | null;
}

export interface BrowserExtractResult {
  text: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  extractionMethod: string;
  isLikelyScanned: boolean;
}

const MAX_CV_FILE_BYTES = 8 * 1024 * 1024; // 8 MB client-side guard
const MAX_CV_TEXT_CHARS = 15000;
const MAX_OCR_PDF_PAGES = 4;

function getStorageKey(userId?: string): string {
  const safeId = (userId || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  return `job_hunter_cv_cache_${safeId}`;
}

export function normalizeCvText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/^[ \t]*[•▪◦●‣▪][ \t]*/gm, "- ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim()
    .slice(0, MAX_CV_TEXT_CHARS);
}

export function loadCvFromBrowserCache(userId?: string): CachedCvData | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(getStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedCvData;
    if (!parsed || typeof parsed.cvText !== "string") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function saveCvToBrowserCache(data: CachedCvData, userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(getStorageKey(userId), JSON.stringify(data));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function clearCvBrowserCache(userId?: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(getStorageKey(userId));
  } catch {
    // Ignore
  }
}

async function runBrowserOcr(
  images: Array<File | HTMLCanvasElement>,
  onProgress?: (status: string) => void,
  labelPrefix = "OCR scanning"
): Promise<string> {
  const { createWorker } = await import("tesseract.js");
  onProgress?.("Loading browser OCR engine (0 server load)...");

  let activeIndex = 0;
  const total = images.length;

  const worker = await createWorker("eng", undefined, {
    logger: (msg) => {
      if (msg.status === "recognizing text" && typeof msg.progress === "number") {
        const pct = Math.round(msg.progress * 100);
        onProgress?.(`${labelPrefix} ${activeIndex + 1}/${total} (${pct}%)...`);
      } else if (msg.status) {
        onProgress?.(`OCR: ${msg.status}...`);
      }
    },
  });

  try {
    const texts: string[] = [];
    for (let i = 0; i < images.length; i++) {
      activeIndex = i;
      onProgress?.(`${labelPrefix} ${i + 1}/${total}...`);
      const res = await worker.recognize(images[i]);
      if (res.data?.text) {
        texts.push(res.data.text);
      }
    }
    return normalizeCvText(texts.join("\n\n"));
  } finally {
    await worker.terminate();
  }
}

async function extractPdfTextInBrowser(
  arrayBuffer: ArrayBuffer,
  onProgress?: (status: string) => void
): Promise<{ text: string; method: string }> {
  onProgress?.("Reading PDF in browser...");
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    onProgress?.(`Extracting PDF page ${pageNum}/${pdf.numPages}...`);
    const page = await pdf.getPage(pageNum);
    const content = await page.getTextContent();
    let lastY: number | null = null;
    const lines: string[] = [];
    let currentLine = "";

    for (const item of content.items) {
      if (!("str" in item)) continue;
      const str = item.str;
      const transform = Array.isArray(item.transform) ? item.transform : [];
      const y = typeof transform[5] === "number" ? Math.round(transform[5]) : null;

      if (lastY !== null && y !== null && Math.abs(y - lastY) > 4) {
        if (currentLine.trim()) lines.push(currentLine.trim());
        currentLine = str;
      } else {
        currentLine = currentLine ? `${currentLine} ${str}` : str;
      }
      if (y !== null) lastY = y;
    }

    if (currentLine.trim()) lines.push(currentLine.trim());
    pageTexts.push(lines.join("\n"));
  }

  const extractedText = normalizeCvText(pageTexts.join("\n\n"));
  if (extractedText.length >= 40) {
    return { text: extractedText, method: "Browser PDF.js" };
  }

  // Fallback for scanned/image-based PDFs: render pages to canvas and run browser OCR
  if (typeof document === "undefined") {
    return { text: extractedText, method: "Browser PDF.js" };
  }

  const pagesToScan = Math.min(pdf.numPages, MAX_OCR_PDF_PAGES);
  const canvases: HTMLCanvasElement[] = [];

  for (let pageNum = 1; pageNum <= pagesToScan; pageNum++) {
    onProgress?.(`Rendering scanned PDF page ${pageNum}/${pagesToScan} for OCR...`);
    const page = await pdf.getPage(pageNum);
    const viewport = page.getViewport({ scale: 2.0 });
    const canvas = document.createElement("canvas");
    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);
    const ctx = canvas.getContext("2d");
    if (!ctx) continue;
    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    canvases.push(canvas);
  }

  if (canvases.length === 0) {
    return { text: extractedText, method: "Browser PDF.js" };
  }

  const ocrText = await runBrowserOcr(canvases, onProgress, "OCR scanning PDF page");
  return {
    text: ocrText.length > extractedText.length ? ocrText : extractedText,
    method: "Browser OCR (Scanned PDF)",
  };
}

async function extractDocxTextInBrowser(
  arrayBuffer: ArrayBuffer,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.("Extracting DOCX in browser...");
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeCvText(result.value || "");
}

async function extractOdtTextInBrowser(
  arrayBuffer: ArrayBuffer,
  onProgress?: (status: string) => void
): Promise<string> {
  onProgress?.("Extracting ODT document in browser...");
  const JSZip = (await import("jszip")).default;
  const zip = await JSZip.loadAsync(arrayBuffer);
  const contentFile = zip.file("content.xml");
  if (!contentFile) {
    throw new Error("Invalid ODT file (content.xml missing).");
  }
  const xmlText = await contentFile.async("text");
  const doc = new DOMParser().parseFromString(xmlText, "text/xml");
  const blocks = doc.querySelectorAll("p, h, text\\:p, text\\:h");
  if (blocks.length > 0) {
    const lines = Array.from(blocks)
      .map((el) => (el.textContent || "").trim())
      .filter(Boolean);
    return normalizeCvText(lines.join("\n"));
  }
  return normalizeCvText(doc.documentElement?.textContent || "");
}

function extractRtfTextInBrowser(rawRtf: string): string {
  // Strip non-content RTF header/embedded groups
  let text = rawRtf.replace(
    /\{\\(?:fonttbl|colortbl|stylesheet|info|pict|object|header|footer|footnote)[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi,
    " "
  );
  // Line & tab breaks
  text = text
    .replace(/\\(?:par|line)\b ?/gi, "\n")
    .replace(/\\tab\b ?/gi, "\t")
    .replace(/\\u(-?\d+)\??/g, (_, code) => {
      const n = Number(code);
      return String.fromCharCode(n < 0 ? n + 65536 : n);
    })
    .replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    )
    .replace(/\\[*a-zA-Z]+-?\d* ?/g, "")
    .replace(/[{}]/g, "");
  return normalizeCvText(text);
}

function extractHtmlTextInBrowser(rawHtml: string): string {
  const doc = new DOMParser().parseFromString(rawHtml, "text/html");
  doc.querySelectorAll("script, style, noscript").forEach((el) => el.remove());
  return normalizeCvText(doc.body?.innerText || doc.body?.textContent || "");
}

export async function extractCvTextInBrowser(
  file: File,
  onProgress?: (status: string) => void
): Promise<BrowserExtractResult> {
  if (file.size > MAX_CV_FILE_BYTES) {
    throw new Error("File is larger than 8 MB. Please upload a smaller CV file.");
  }

  const lowerName = file.name.toLowerCase();
  let text = "";
  let extractionMethod = "Browser Text";

  if (lowerName.endsWith(".doc") && !lowerName.endsWith(".docx")) {
    throw new Error(
      "Legacy .doc (Word 97-2003) binary format cannot be parsed directly in the browser. Please save as .docx or .pdf and upload again."
    );
  }

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    const res = await extractPdfTextInBrowser(buffer, onProgress);
    text = res.text;
    extractionMethod = res.method;
  } else if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await file.arrayBuffer();
    text = await extractDocxTextInBrowser(buffer, onProgress);
    extractionMethod = "Browser DOCX (Mammoth)";
  } else if (
    lowerName.endsWith(".odt") ||
    file.type === "application/vnd.oasis.opendocument.text"
  ) {
    const buffer = await file.arrayBuffer();
    text = await extractOdtTextInBrowser(buffer, onProgress);
    extractionMethod = "Browser ODT (JSZip)";
  } else if (lowerName.endsWith(".rtf") || file.type === "application/rtf" || file.type === "text/rtf") {
    onProgress?.("Parsing RTF document in browser...");
    text = extractRtfTextInBrowser(await file.text());
    extractionMethod = "Browser RTF Parser";
  } else if (lowerName.endsWith(".html") || lowerName.endsWith(".htm") || file.type === "text/html") {
    onProgress?.("Parsing HTML CV in browser...");
    text = extractHtmlTextInBrowser(await file.text());
    extractionMethod = "Browser HTML Parser";
  } else if (
    lowerName.endsWith(".png") ||
    lowerName.endsWith(".jpg") ||
    lowerName.endsWith(".jpeg") ||
    lowerName.endsWith(".webp") ||
    file.type.startsWith("image/")
  ) {
    text = await runBrowserOcr([file], onProgress, "OCR scanning image");
    extractionMethod = "Browser OCR (Image)";
  } else if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    file.type.startsWith("text/")
  ) {
    onProgress?.("Reading text file in browser...");
    text = normalizeCvText(await file.text());
    extractionMethod = "Browser Text Reader";
  } else {
    throw new Error(
      "Unsupported file format. Supported: PDF (text & scanned), DOCX, ODT, RTF, HTML, TXT, MD, PNG, JPG, WEBP."
    );
  }

  const isLikelyScanned = text.length < 25;
  return {
    text,
    fileName: file.name,
    fileType: file.type || lowerName.split(".").pop() || "unknown",
    fileSizeBytes: file.size,
    extractionMethod,
    isLikelyScanned,
  };
}

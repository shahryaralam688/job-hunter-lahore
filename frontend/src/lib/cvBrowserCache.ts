import type { CVAnalysis } from "./types";

export interface CachedCvData {
  cvText: string;
  fileName?: string;
  fileType?: string;
  fileSizeBytes?: number;
  updatedAt: string;
  analysis?: CVAnalysis | null;
}

export interface BrowserExtractResult {
  text: string;
  fileName: string;
  fileType: string;
  fileSizeBytes: number;
  isLikelyScanned: boolean;
}

const MAX_CV_FILE_BYTES = 5 * 1024 * 1024; // 5 MB client-side guard
const MAX_CV_TEXT_CHARS = 15000;

function getStorageKey(userId?: string): string {
  const safeId = (userId || "default").replace(/[^a-zA-Z0-9_-]/g, "");
  return `job_hunter_cv_cache_${safeId}`;
}

export function normalizeCvText(raw: string): string {
  return raw
    .replace(/\r\n/g, "\n")
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

async function extractPdfTextInBrowser(arrayBuffer: ArrayBuffer): Promise<string> {
  const pdfjsLib = await import("pdfjs-dist");
  pdfjsLib.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";

  const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageTexts: string[] = [];

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
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

  return normalizeCvText(pageTexts.join("\n\n"));
}

async function extractDocxTextInBrowser(arrayBuffer: ArrayBuffer): Promise<string> {
  const mammoth = await import("mammoth");
  const result = await mammoth.extractRawText({ arrayBuffer });
  return normalizeCvText(result.value || "");
}

export async function extractCvTextInBrowser(file: File): Promise<BrowserExtractResult> {
  if (file.size > MAX_CV_FILE_BYTES) {
    throw new Error("File is larger than 5 MB. Please upload a smaller CV file.");
  }

  const lowerName = file.name.toLowerCase();
  let text = "";

  if (lowerName.endsWith(".pdf") || file.type === "application/pdf") {
    const buffer = await file.arrayBuffer();
    text = await extractPdfTextInBrowser(buffer);
  } else if (
    lowerName.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    const buffer = await file.arrayBuffer();
    text = await extractDocxTextInBrowser(buffer);
  } else if (
    lowerName.endsWith(".txt") ||
    lowerName.endsWith(".md") ||
    file.type.startsWith("text/")
  ) {
    text = normalizeCvText(await file.text());
  } else {
    throw new Error("Unsupported file format. Please select a PDF, DOCX, TXT, or MD file.");
  }

  const isLikelyScanned = text.length < 40;
  return {
    text,
    fileName: file.name,
    fileType: file.type || lowerName.split(".").pop() || "unknown",
    fileSizeBytes: file.size,
    isLikelyScanned,
  };
}

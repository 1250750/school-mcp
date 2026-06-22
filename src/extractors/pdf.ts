import { readFile } from "node:fs/promises";
import { ExtractedSection } from "../types.js";
import { normalizeDocumentText } from "../security.js";

export async function extractPdf(filePath: string): Promise<ExtractedSection[]> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const data = new Uint8Array(await readFile(filePath));
  const loadingTask = pdfjs.getDocument({ data, useWorkerFetch: false });
  const document = await loadingTask.promise;
  const sections: ExtractedSection[] = [];
  try {
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber += 1) {
      const page = await document.getPage(pageNumber);
      const text = await page.getTextContent();
      const content = normalizeDocumentText(text.items.map((item) => ("str" in item ? item.str : "")).join(" "));
      if (content) sections.push({ text: content, page: pageNumber, slide: null });
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
  return sections;
}

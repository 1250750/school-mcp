import { DriveManifestEntry, ExtractedSection } from "../types.js";
import { extractDocx } from "./docx.js";
import { extractPdf } from "./pdf.js";
import { extractPptx } from "./pptx.js";

export async function extractDocument(entry: DriveManifestEntry, filePath: string): Promise<ExtractedSection[]> {
  switch (entry.documentType) {
    case "pdf": return extractPdf(filePath);
    case "pptx":
    case "google_slides": return extractPptx(filePath);
    case "docx":
    case "google_doc": return extractDocx(filePath);
  }
}

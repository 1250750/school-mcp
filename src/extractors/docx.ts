import mammoth from "mammoth";
import { ExtractedSection } from "../types.js";
import { normalizeDocumentText } from "../security.js";

export async function extractDocx(filePath: string): Promise<ExtractedSection[]> {
  const result = await mammoth.extractRawText({ path: filePath });
  const text = normalizeDocumentText(result.value);
  return text ? [{ text, page: null, slide: null }] : [];
}

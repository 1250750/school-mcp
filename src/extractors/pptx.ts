import AdmZip from "adm-zip";
import { ExtractedSection } from "../types.js";
import { normalizeDocumentText } from "../security.js";

function xmlDecode(value: string): string {
  return value.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&amp;/g, "&").replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)));
}

export async function extractPptx(filePath: string): Promise<ExtractedSection[]> {
  const zip = new AdmZip(filePath);
  const slides = zip.getEntries()
    .filter((entry) => /^ppt\/slides\/slide\d+\.xml$/.test(entry.entryName))
    .sort((a, b) => Number(a.entryName.match(/\d+/)?.[0]) - Number(b.entryName.match(/\d+/)?.[0]));
  return slides.flatMap((entry, index) => {
    const xml = entry.getData().toString("utf8");
    const text = normalizeDocumentText([...xml.matchAll(/<a:t(?:\s[^>]*)?>([\s\S]*?)<\/a:t>/g)]
      .map((match) => xmlDecode(match[1] ?? "")).join("\n"));
    return text ? [{ text, page: null, slide: index + 1 }] : [];
  });
}

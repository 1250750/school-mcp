import { config } from "../config.js";
import { ChunkInput, ExtractedSection } from "../types.js";

export function chunkSections(sections: ExtractedSection[]): ChunkInput[] {
  if (config.chunkOverlap >= config.chunkSize) throw new Error("CHUNK_OVERLAP tem de ser menor que CHUNK_SIZE.");
  const chunks: ChunkInput[] = [];
  let chunkIndex = 0;
  for (const section of sections) {
    let start = 0;
    while (start < section.text.length) {
      let end = Math.min(start + config.chunkSize, section.text.length);
      if (end < section.text.length) {
        const boundary = Math.max(section.text.lastIndexOf("\n", end), section.text.lastIndexOf(" ", end));
        if (boundary > start + Math.floor(config.chunkSize * 0.6)) end = boundary;
      }
      const content = section.text.slice(start, end).trim();
      if (content) chunks.push({ ...section, content, chunkIndex: chunkIndex++ });
      if (end >= section.text.length) break;
      start = Math.max(start + 1, end - config.chunkOverlap);
    }
  }
  return chunks;
}

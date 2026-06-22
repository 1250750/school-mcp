import { IndexedChunk, LocalIndex } from "../types.js";

const stopwords = new Set(["a", "ao", "aos", "as", "de", "da", "das", "do", "dos", "e", "em", "na", "nas", "no", "nos", "o", "os", "ou", "para", "por", "que", "um", "uma"]);

export function fold(value: string): string {
  return value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt");
}

function terms(value: string): string[] {
  return [...new Set(fold(value).match(/[\p{L}\p{N}]+/gu)?.filter((term) => term.length > 1 && !stopwords.has(term)) ?? [])];
}

function wordCounts(value: string): Map<string, number> {
  const counts = new Map<string, number>();
  for (const word of fold(value).match(/[\p{L}\p{N}]+/gu) ?? []) counts.set(word, (counts.get(word) ?? 0) + 1);
  return counts;
}

function excerpt(content: string, queryTerms: string[], length = 650): string {
  const normalized = fold(content);
  const positions = queryTerms.map((term) => normalized.indexOf(term)).filter((position) => position >= 0);
  const center = positions.length ? Math.min(...positions) : 0;
  const start = Math.max(0, center - Math.floor(length * 0.3));
  const end = Math.min(content.length, start + length);
  return `${start > 0 ? "…" : ""}${content.slice(start, end).trim()}${end < content.length ? "…" : ""}`;
}

export interface SearchResult {
  filePath: string;
  course: string;
  chapter: string;
  file: string;
  documentType: string;
  page: number | null;
  slide: number | null;
  excerpt: string;
  score: number;
}

export function searchIndex(index: LocalIndex, query: string, filters: { course?: string; chapter?: string; limit?: number } = {}): SearchResult[] {
  const queryTerms = terms(query);
  const phrase = fold(query).trim();
  if (!queryTerms.length) return [];
  return index.chunks.flatMap((chunk): Array<{ chunk: IndexedChunk; score: number }> => {
    if (filters.course && fold(chunk.course) !== fold(filters.course)) return [];
    if (filters.chapter && fold(chunk.chapter) !== fold(filters.chapter)) return [];
    const text = fold(chunk.content);
    const counts = wordCounts(chunk.content);
    let matched = 0;
    let frequency = 0;
    for (const term of queryTerms) {
      const occurrences = counts.get(term) ?? 0;
      if (occurrences > 0) matched += 1;
      frequency += Math.min(occurrences, 5);
    }
    if (!matched) return [];
    const coverage = matched / queryTerms.length;
    const phraseBonus = phrase.length > 2 && text.includes(phrase) ? 12 : 0;
    const locationBonus = chunk.page === 1 || chunk.slide === 1 ? 0.25 : 0;
    return [{ chunk, score: phraseBonus + coverage * 10 + frequency * 1.5 + locationBonus }];
  }).sort((a, b) => b.score - a.score || a.chunk.filePath.localeCompare(b.chunk.filePath))
    .slice(0, filters.limit ?? 10)
    .map(({ chunk, score }) => ({
      filePath: chunk.filePath,
      course: chunk.course,
      chapter: chunk.chapter,
      file: chunk.file,
      documentType: chunk.documentType,
      page: chunk.page,
      slide: chunk.slide,
      excerpt: excerpt(chunk.content, queryTerms),
      score: Number(score.toFixed(2)),
    }));
}

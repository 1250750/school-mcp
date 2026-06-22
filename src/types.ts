export type DocumentType = "pdf" | "pptx" | "docx" | "google_doc" | "google_slides";
export type LocalDocumentType = Extract<DocumentType, "pdf" | "pptx" | "docx">;

export interface DriveManifestEntry {
  driveId: string;
  name: string;
  mimeType: string;
  documentType: DocumentType;
  course: string;
  chapter: string;
  relativePath: string;
  modifiedTime: string | null;
  webViewLink: string | null;
}

export interface ExtractedSection {
  text: string;
  page: number | null;
  slide: number | null;
}

export interface ChunkInput extends ExtractedSection {
  content: string;
  chunkIndex: number;
}

export interface IndexedMaterial {
  filePath: string;
  course: string;
  chapter: string;
  file: string;
  documentType: LocalDocumentType;
  pages: number;
  slides: number;
  chunks: number;
}

export interface IndexedChunk {
  id: string;
  filePath: string;
  course: string;
  chapter: string;
  file: string;
  documentType: LocalDocumentType;
  page: number | null;
  slide: number | null;
  chunkIndex: number;
  content: string;
}

export interface LocalIndex {
  version: 1;
  generatedAt: string;
  materialsRoot: string;
  materials: IndexedMaterial[];
  chunks: IndexedChunk[];
}

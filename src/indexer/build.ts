import { createHash } from "node:crypto";
import { mkdir, readdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { chunkSections } from "../extractors/chunk.js";
import { extractDocument } from "../extractors/index.js";
import { DriveManifestEntry, IndexedChunk, IndexedMaterial, LocalDocumentType, LocalIndex } from "../types.js";

const extensions = new Map<string, LocalDocumentType>([[".pdf", "pdf"], [".pptx", "pptx"], [".docx", "docx"]]);

async function findMaterials(directory: string): Promise<string[]> {
  const found: string[] = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...await findMaterials(absolute));
    else if (entry.isFile() && extensions.has(path.extname(entry.name).toLowerCase())) found.push(absolute);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function metadata(absolutePath: string) {
  const relative = path.relative(config.materialsRoot, absolutePath);
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) throw new Error(`Ficheiro fora de MATERIALS_ROOT: ${absolutePath}`);
  const segments = relative.split(path.sep);
  const file = segments.at(-1)!;
  const course = segments[0] ?? "Sem cadeira";
  const chapter = segments.slice(1, -1).join(" / ") || "Geral";
  const documentType = extensions.get(path.extname(file).toLowerCase());
  if (!documentType) throw new Error(`Formato não suportado: ${file}`);
  return { filePath: segments.join("/"), file, course, chapter, documentType };
}

function chunkId(filePath: string, chunkIndex: number, content: string): string {
  return createHash("sha256").update(`${filePath}\0${chunkIndex}\0${content}`).digest("hex").slice(0, 24);
}

export async function buildLocalIndex(): Promise<LocalIndex> {
  await mkdir(config.materialsRoot, { recursive: true });
  const materials: IndexedMaterial[] = [];
  const chunks: IndexedChunk[] = [];

  for (const absolutePath of await findMaterials(config.materialsRoot)) {
    const meta = metadata(absolutePath);
    const extractorEntry: DriveManifestEntry = {
      driveId: meta.filePath,
      name: meta.file,
      mimeType: "application/octet-stream",
      documentType: meta.documentType,
      course: meta.course,
      chapter: meta.chapter,
      relativePath: meta.filePath,
      modifiedTime: null,
      webViewLink: null,
    };
    const sections = await extractDocument(extractorEntry, absolutePath);
    const fileChunks = chunkSections(sections);
    materials.push({
      ...meta,
      pages: Math.max(0, ...sections.map((section) => section.page ?? 0)),
      slides: Math.max(0, ...sections.map((section) => section.slide ?? 0)),
      chunks: fileChunks.length,
    });
    for (const chunk of fileChunks) {
      chunks.push({
        id: chunkId(meta.filePath, chunk.chunkIndex, chunk.content),
        ...meta,
        page: chunk.page,
        slide: chunk.slide,
        chunkIndex: chunk.chunkIndex,
        content: chunk.content,
      });
    }
    console.error(`Indexado: ${meta.course} / ${meta.chapter} / ${meta.file} (${fileChunks.length} excertos)`);
  }

  const index: LocalIndex = {
    version: 1,
    generatedAt: new Date().toISOString(),
    materialsRoot: config.materialsRoot,
    materials,
    chunks,
  };
  await mkdir(path.dirname(config.indexPath), { recursive: true });
  const temporary = `${config.indexPath}.${process.pid}.tmp`;
  await writeFile(temporary, JSON.stringify(index), "utf8");
  await rm(config.indexPath, { force: true });
  await rename(temporary, config.indexPath);
  return index;
}

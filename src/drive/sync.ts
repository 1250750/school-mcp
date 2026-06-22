import { mkdir, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { config, requireValues } from "../config.js";
import { createDriveClient } from "./client.js";

const FOLDER = "application/vnd.google-apps.folder";
const supported: Record<string, { extension: string; exportMime?: string }> = {
  "application/pdf": { extension: ".pdf" },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { extension: ".pptx" },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { extension: ".docx" },
  "application/vnd.google-apps.document": {
    extension: ".docx",
    exportMime: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  },
  "application/vnd.google-apps.presentation": {
    extension: ".pptx",
    exportMime: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  },
};

function safeSegment(value: string): string {
  const cleaned = value.normalize("NFKC").replace(/[<>:"/\\|?*\x00-\x1F]/g, "_").replace(/\.\.+/g, "_").trim();
  return cleaned || "sem-nome";
}

async function responseBuffer(data: unknown): Promise<Buffer> {
  if (Buffer.isBuffer(data)) return data;
  if (data instanceof ArrayBuffer) return Buffer.from(data);
  if (data instanceof Readable || (data && typeof (data as { on?: unknown }).on === "function")) {
    const chunks: Buffer[] = [];
    for await (const chunk of data as AsyncIterable<Buffer | string>) chunks.push(Buffer.from(chunk));
    return Buffer.concat(chunks);
  }
  throw new Error("Resposta de download do Google Drive inesperada.");
}

export async function syncDrive(): Promise<number> {
  if (!config.googleDriveEnabled) {
    throw new Error("Google Drive está desativado. Defina GOOGLE_DRIVE_ENABLED=true para sincronizar.");
  }
  const folderId = requireValues({ GOOGLE_DRIVE_FOLDER_ID: config.googleDriveFolderId }).GOOGLE_DRIVE_FOLDER_ID!;
  const root = config.materialsRoot;
  if (path.parse(root).root === root) throw new Error("MATERIALS_ROOT não pode ser a raiz do sistema de ficheiros.");
  const staging = path.join(path.dirname(root), `.${path.basename(root)}-drive-staging-${Date.now()}`);
  const drive = createDriveClient();
  let downloaded = 0;
  await mkdir(staging, { recursive: true });

  async function visit(parentId: string, segments: string[]): Promise<void> {
    let pageToken: string | undefined;
    do {
      const response = await drive.files.list({
        q: `'${parentId}' in parents and trashed = false`,
        fields: "nextPageToken,files(id,name,mimeType)",
        pageSize: 1000,
        pageToken,
        supportsAllDrives: true,
        includeItemsFromAllDrives: true,
      });
      const usedNames = new Set<string>();
      for (const file of response.data.files ?? []) {
        if (!file.id || !file.name || !file.mimeType) continue;
        const segment = safeSegment(file.name);
        if (file.mimeType === FOLDER) {
          await visit(file.id, [...segments, segment]);
          continue;
        }
        const format = supported[file.mimeType];
        if (!format) continue;
        const base = safeSegment(path.parse(segment).name);
        let localName = `${base}${format.extension}`;
        if (usedNames.has(localName.toLocaleLowerCase())) localName = `${base}--${file.id.slice(0, 8)}${format.extension}`;
        usedNames.add(localName.toLocaleLowerCase());
        const destination = path.join(staging, ...segments, localName);
        await mkdir(path.dirname(destination), { recursive: true });
        const download = format.exportMime
          ? await drive.files.export({ fileId: file.id, mimeType: format.exportMime }, { responseType: "stream" })
          : await drive.files.get({ fileId: file.id, alt: "media", supportsAllDrives: true }, { responseType: "stream" });
        await writeFile(destination, await responseBuffer(download.data));
        downloaded += 1;
      }
      pageToken = response.data.nextPageToken ?? undefined;
    } while (pageToken);
  }

  try {
    await visit(folderId, []);
    await rm(root, { recursive: true, force: true });
    await rename(staging, root);
    return downloaded;
  } catch (error) {
    await rm(staging, { recursive: true, force: true });
    throw error;
  }
}

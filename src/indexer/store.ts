import { readFile, stat } from "node:fs/promises";
import { config } from "../config.js";
import { LocalIndex } from "../types.js";

let cached: { modified: number; index: LocalIndex } | undefined;

export async function loadLocalIndex(): Promise<LocalIndex> {
  let info;
  try {
    info = await stat(config.indexPath);
  } catch {
    throw new Error(`Índice local não encontrado em ${config.indexPath}. Execute: npm run index`);
  }
  if (cached?.modified === info.mtimeMs) return cached.index;
  const index = JSON.parse(await readFile(config.indexPath, "utf8")) as LocalIndex;
  if (index.version !== 1 || !Array.isArray(index.materials) || !Array.isArray(index.chunks)) {
    throw new Error("Índice local inválido. Execute novamente: npm run index");
  }
  cached = { modified: info.mtimeMs, index };
  return index;
}

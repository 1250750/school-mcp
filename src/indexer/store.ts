import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { config } from "../config.js";
import { LocalIndex } from "../types.js";

let cached: { filePath: string; modified: number; index: LocalIndex } | undefined;

async function findIndexPath(): Promise<{ filePath: string; modified: number }> {
  const candidates = [...new Set([
    config.indexPath,
    path.resolve(process.cwd(), "src", "mcp-index", "index.json"),
    path.resolve(process.cwd(), ".mcp-index", "index.json"),
    path.resolve("/var/task", "src", "mcp-index", "index.json"),
    path.resolve("/var/task", ".mcp-index", "index.json"),
  ])];
  for (const filePath of candidates) {
    try {
      const info = await stat(filePath);
      return { filePath, modified: info.mtimeMs };
    } catch {
      // Try the next known runtime location.
    }
  }
  throw new Error(`Índice local não encontrado. Execute npm run index antes do build/deploy.`);
}

export async function loadLocalIndex(): Promise<LocalIndex> {
  const located = await findIndexPath();
  if (cached?.filePath === located.filePath && cached.modified === located.modified) return cached.index;
  const index = JSON.parse(await readFile(located.filePath, "utf8")) as LocalIndex;
  if (index.version !== 1 || !Array.isArray(index.materials) || !Array.isArray(index.chunks)) {
    throw new Error("Índice local inválido. Execute novamente: npm run index");
  }
  cached = { ...located, index };
  return index;
}

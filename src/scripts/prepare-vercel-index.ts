import { copyFile, mkdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const source = path.join(projectRoot, ".mcp-index", "index.json");
const target = path.join(projectRoot, "src", "mcp-index", "index.json");

try {
  await stat(source);
} catch {
  throw new Error("Indice MCP em falta. Execute npm run index antes de npm run build ou vercel deploy.");
}

await mkdir(path.dirname(target), { recursive: true });
await copyFile(source, target);

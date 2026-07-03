import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
//oi
const projectRoot = path.resolve(fileURLToPath(new URL("..", import.meta.url)));
dotenv.config({ path: path.join(projectRoot, ".env"), quiet: true });

export const config = {
  materialsRoot: path.resolve(projectRoot, process.env.MATERIALS_ROOT ?? "./Cadeiras"),
  indexPath: path.join(projectRoot, ".mcp-index", "index.json"),
  googleDriveEnabled: (process.env.GOOGLE_DRIVE_ENABLED ?? "false").toLowerCase() === "true",
  googleDriveFolderId: process.env.GOOGLE_DRIVE_FOLDER_ID,
  chunkSize: 1200,
  chunkOverlap: 200,
};

export function requireValues(values: Record<string, string | undefined>): Record<string, string> {
  for (const [name, value] of Object.entries(values)) {
    if (!value) throw new Error(`Variável obrigatória em falta: ${name}`);
  }
  return values as Record<string, string>;
}

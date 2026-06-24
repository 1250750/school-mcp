import { createServer, IncomingMessage, ServerResponse } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";

process.env.VERCEL = "1";
if (!process.env.MCP_ACCESS_TOKEN) process.env.MCP_ALLOW_PUBLIC = "true";

const projectRoot = path.resolve(fileURLToPath(new URL("../..", import.meta.url)));
const { default: mcpHandler } = await import("../../api/mcp.js");
const { default: healthHandler } = await import("../../api/health.js");
const port = Number(process.env.PORT ?? 3000);

async function body(request: IncomingMessage): Promise<ArrayBuffer | undefined> {
  if (request.method === "GET" || request.method === "HEAD") return undefined;
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  const joined = Buffer.concat(chunks);
  return joined.buffer.slice(joined.byteOffset, joined.byteOffset + joined.byteLength) as ArrayBuffer;
}

async function send(response: ServerResponse, webResponse: Response): Promise<void> {
  response.statusCode = webResponse.status;
  webResponse.headers.forEach((value, key) => response.setHeader(key, value));
  if (!webResponse.body) return void response.end();
  Readable.fromWeb(webResponse.body as import("node:stream/web").ReadableStream).pipe(response);
}

const staticFiles: Record<string, { file: string; type: string }> = {
  "/": { file: "index.html", type: "text/html; charset=utf-8" },
  "/styles.css": { file: "styles.css", type: "text/css; charset=utf-8" },
  "/favicon.svg": { file: "favicon.svg", type: "image/svg+xml" },
};

createServer(async (request, response) => {
  try {
    const url = new URL(request.url ?? "/", `http://${request.headers.host ?? `127.0.0.1:${port}`}`);
    if (url.pathname === "/mcp") {
      const webRequest = new Request(url, {
        method: request.method,
        headers: request.headers as HeadersInit,
        body: await body(request),
      });
      return await send(response, await mcpHandler(webRequest));
    }
    if (url.pathname === "/health") return await send(response, healthHandler());
    const asset = staticFiles[url.pathname];
    if (!asset) return await send(response, new Response("Not found", { status: 404 }));
    return await send(response, new Response(await readFile(path.join(projectRoot, "public", asset.file)), {
      headers: { "Content-Type": asset.type },
    }));
  } catch (error) {
    console.error(error);
    return await send(response, Response.json({ error: "Internal server error" }, { status: 500 }));
  }
}).listen(port, "127.0.0.1", () => {
  console.log(`lectureHub web: http://127.0.0.1:${port}`);
  console.log(`lectureHub MCP: http://127.0.0.1:${port}/mcp`);
});

import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { createMcpServer } from "../src/mcp/server.js";

export const config = { runtime: "nodejs" };

type VercelRequest = {
  body?: unknown;
  headers: Record<string, string | string[] | undefined>;
  method?: string;
  url?: string;
};

type VercelResponse = {
  end: (body?: Buffer | string) => void;
  setHeader: (name: string, value: string | string[]) => void;
  status: (code: number) => VercelResponse;
};

function withCors(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
  headers.set("Access-Control-Allow-Headers", "Authorization, Content-Type, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID");
  headers.set("Access-Control-Expose-Headers", "MCP-Protocol-Version, MCP-Session-Id");
  headers.set("Cache-Control", "no-store");
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}

function authorize(request: Request): Response | undefined {
  const token = process.env.MCP_ACCESS_TOKEN?.trim();
  if (!token) {
    if (process.env.MCP_ALLOW_PUBLIC === "true") return undefined;
    return Response.json({
      error: "MCP endpoint locked",
      message: "Configure MCP_ACCESS_TOKEN or explicitly set MCP_ALLOW_PUBLIC=true.",
    }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
  if (request.headers.get("authorization") !== `Bearer ${token}`) {
    return Response.json({ error: "Unauthorized" }, {
      status: 401,
      headers: { "WWW-Authenticate": "Bearer", "Cache-Control": "no-store" },
    });
  }
  return undefined;
}

function toWebRequest(request: VercelRequest): Request {
  const headers = new Headers();
  for (const [name, value] of Object.entries(request.headers)) {
    if (typeof value === "string") headers.set(name, value);
    else if (Array.isArray(value)) headers.set(name, value.join(", "));
  }

  const host = headers.get("host") ?? "localhost";
  const protocol = headers.get("x-forwarded-proto") ?? "https";
  const url = new URL(request.url ?? "/", `${protocol}://${host}`).toString();
  const method = request.method ?? "GET";
  const hasBody = method !== "GET" && method !== "HEAD";
  const body = hasBody ? normalizeBody(request.body) : undefined;

  return new Request(url, { method, headers, body });
}

function normalizeBody(body: unknown): BodyInit | undefined {
  if (body === undefined || body === null) return undefined;
  if (typeof body === "string" || body instanceof Buffer) return body;
  return JSON.stringify(body);
}

async function sendWebResponse(response: VercelResponse, webResponse: Response): Promise<void> {
  webResponse.headers.forEach((value, name) => response.setHeader(name, value));
  response.status(webResponse.status);

  const body = Buffer.from(await webResponse.arrayBuffer());
  if (body.length === 0) {
    response.end();
    return;
  }
  response.end(body);
}

export default async function handler(vercelRequest: VercelRequest, vercelResponse: VercelResponse): Promise<void> {
  const request = toWebRequest(vercelRequest);
  if (request.method === "OPTIONS") {
    await sendWebResponse(vercelResponse, withCors(new Response(null, { status: 204 })));
    return;
  }

  const denied = authorize(request);
  if (denied) {
    await sendWebResponse(vercelResponse, withCors(denied));
    return;
  }

  const transport = new WebStandardStreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  const server = createMcpServer();
  await server.connect(transport);
  await sendWebResponse(vercelResponse, withCors(await transport.handleRequest(request)));
}

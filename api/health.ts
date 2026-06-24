export const config = { runtime: "nodejs" };

type VercelResponse = {
  status: (code: number) => VercelResponse;
  setHeader: (name: string, value: string) => void;
  json: (body: unknown) => void;
};

export default function handler(_request: unknown, response: VercelResponse): void {
  response.setHeader("Cache-Control", "no-store");
  response.status(200).json({
    service: "lectureHub",
    status: "ok",
    mcp: "/mcp",
  });
}

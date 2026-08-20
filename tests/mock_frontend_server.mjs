import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve(process.cwd());
const port = Number(process.env.PORT || 8090);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
]);

const mockChatResponse = {
  query_id: "mock-query-id",
  question: "mock question",
  raw_answer: {
    text: "Raw mock answer",
    provider: "mock-provider",
    model: "mock-model",
    grounded_by_anchor: false,
    verification_status: "uncorrected",
  },
  corrected_answer: {
    text: "Corrected mock answer",
    evidence_status: "sufficient",
  },
  confidence: null,
  claims: [
    {
      claim_id: "claim-1",
      text: "Mock claim",
      type: "medical_fact",
      evidence_ids: ["EV_1"],
      verification_status: "supported",
      supporting_evidence_ids: ["EV_1"],
      conflicting_evidence_ids: [],
    },
  ],
  corrections: [
    {
      correction_id: "correction-1",
      original_claim: "Mock claim",
      corrected_claim: "Mock claim",
      verification_status: "supported",
      supporting_evidence_ids: ["EV_1"],
      conflicting_evidence_ids: [],
      correction_reason: "Supported by Anchor evidence.",
      citation_ids: ["citation-1"],
    },
  ],
  citations: [
    {
      citation_id: "citation-1",
      evidence_id: "EV_1",
      title: "Mock evidence",
      source: "Anchor KB",
      pmid: "12345678",
      doi: null,
    },
  ],
  audit: {
    raw_answer_preserved: true,
    correction_performed: true,
    evidence_status: "sufficient",
    notes: ["mocked browser test"],
  },
  latency_ms: 12,
};

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    await consumeRequest(request);
    sendJson(response, mockChatResponse);
    return;
  }

  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Method not allowed");
    return;
  }

  const pathname = new URL(request.url || "/", `http://127.0.0.1:${port}`).pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const resolvedPath = normalize(join(root, relativePath));

  if (!resolvedPath.startsWith(root)) {
    response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Forbidden");
    return;
  }

  try {
    const fileStat = await stat(resolvedPath);
    if (!fileStat.isFile()) throw new Error("Not a file");
    response.writeHead(200, {
      "Content-Type": contentTypes.get(extname(resolvedPath)) || "application/octet-stream",
      "Content-Length": fileStat.size,
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(resolvedPath).pipe(response);
  } catch (_error) {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    response.end("Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mock frontend server listening on http://127.0.0.1:${port}`);
});

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);

function shutdown() {
  server.close(() => process.exit(0));
}

function consumeRequest(request) {
  return new Promise((resolveRequest) => {
    request.on("data", () => {});
    request.on("end", resolveRequest);
    request.on("error", resolveRequest);
  });
}

function sendJson(response, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

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

const server = createServer(async (request, response) => {
  if (request.method === "POST" && request.url === "/api/chat") {
    const requestBody = await consumeRequest(request);
    sendJson(response, mockChatResponse(requestBody));
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
    let body = "";
    request.on("data", (chunk) => {
      body += chunk;
    });
    request.on("end", () => resolveRequest(body));
    request.on("error", () => resolveRequest(body));
  });
}

function mockChatResponse(requestBody) {
  const question = parseQuestion(requestBody);
  const rawAnswer = {
    text: "Raw mock answer",
    provider: "mock-provider",
    model: "mock-model",
    grounded_by_anchor: false,
    verification_status: "uncorrected",
  };
  if (/unavailable/i.test(question)) {
    return {
      ...baseResponse(question, rawAnswer),
      corrected_answer: {
        text: "Anchor calibration is currently unavailable.",
        evidence_status: "unavailable",
      },
      claims: [],
      corrections: [],
      citations: [],
      audit: {
        raw_answer_preserved: true,
        correction_performed: false,
        evidence_status: "unavailable",
        notes: ["mocked unavailable browser test"],
      },
    };
  }
  if (/insufficient/i.test(question)) {
    return {
      ...baseResponse(question, rawAnswer),
      corrected_answer: {
        text: "Anchor 当前知识库中没有足够证据完成可靠核验/矫正。",
        evidence_status: "insufficient",
      },
      claims: [
        {
          claim_id: "claim-1",
          text: "Mock claim without enough Anchor evidence",
          type: "medical_fact",
          evidence_ids: [],
          verification_status: "not_verifiable",
          supporting_evidence_ids: [],
          conflicting_evidence_ids: [],
        },
      ],
      corrections: [],
      citations: [],
      audit: {
        raw_answer_preserved: true,
        correction_performed: false,
        evidence_status: "insufficient",
        notes: ["mocked insufficient browser test"],
      },
    };
  }
  return {
    ...baseResponse(question, rawAnswer),
    corrected_answer: {
      text: "Corrected mock answer",
      evidence_status: "sufficient",
    },
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
      {
        claim_id: "claim-2",
        text: "Mock claim needing weaker wording",
        type: "medical_fact",
        evidence_ids: ["EV_2"],
        verification_status: "partially_supported",
        supporting_evidence_ids: ["EV_2"],
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
      {
        correction_id: "correction-2",
        original_claim: "Mock claim needing weaker wording",
        corrected_claim: "Mock claim may be appropriate in selected patients.",
        verification_status: "partially_supported",
        supporting_evidence_ids: ["EV_2"],
        conflicting_evidence_ids: [],
        correction_reason: "Anchor evidence supports a narrower statement.",
        citation_ids: ["citation-2"],
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
      {
        citation_id: "citation-2",
        evidence_id: "EV_2",
        title: "Mock evidence 2",
        source: "Anchor KB",
        pmid: null,
        doi: "10.1000/mock",
      },
    ],
    audit: {
      raw_answer_preserved: true,
      correction_performed: true,
      evidence_status: "sufficient",
      notes: ["mocked browser test"],
    },
  };
}

function baseResponse(question, rawAnswer) {
  return {
    query_id: "mock-query-id",
    question,
    raw_answer: rawAnswer,
    confidence: null,
    latency_ms: 12,
  };
}

function parseQuestion(requestBody) {
  try {
    const payload = JSON.parse(requestBody || "{}");
    return String(payload.question || "mock question");
  } catch (_error) {
    return "mock question";
  }
}

function sendJson(response, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(200, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

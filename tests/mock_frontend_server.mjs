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
  if (request.method === "GET" && request.url === "/health") {
    sendJson(response, { status: "ok", service: "anchor-ai" });
    return;
  }

  if (request.method === "GET" && request.url === "/ready") {
    sendJson(response, {
      status: "ready",
      dependencies: {
        database: "ok",
        retrieval: "ok",
        llm: "configured",
        configuration: "ok",
      },
    });
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat/stream") {
    const requestBody = await consumeRequest(request);
    const mockResponse = mockChatResponse(requestBody);
    if (mockResponse.status !== 200) {
      sendJson(response, mockResponse.body, mockResponse.status);
      return;
    }
    response.writeHead(200, {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    });
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "accepted" });
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "raw_generation" });
    await sendStreamEvent(response, "raw_answer", { query_id: "mock-query-id", raw_answer: mockResponse.body.raw_answer });
    if (mockResponse.delayMs) await delay(mockResponse.delayMs);
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "retrieval" });
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "claim_extraction" });
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "verification" });
    await sendStreamEvent(response, "stage", { query_id: "mock-query-id", stage: "correction" });
    await sendStreamEvent(response, "final", mockResponse.body);
    response.end();
    return;
  }

  if (request.method === "POST" && request.url === "/api/chat") {
    const requestBody = await consumeRequest(request);
    const mockResponse = mockChatResponse(requestBody);
    if (mockResponse.delayMs) await delay(mockResponse.delayMs);
    sendJson(response, mockResponse.body, mockResponse.status);
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
    text: "Raw mock answer\n\nMock claim. Mock claim needing weaker wording.",
    provider: "mock-provider",
    model: "mock-model",
    grounded_by_anchor: false,
    verification_status: "uncorrected",
  };
  if (/status400/i.test(question)) {
    return errorResponse(400, "INVALID_REQUEST", "Traceback at /Users/private/server.py");
  }
  if (/status422/i.test(question)) {
    return errorResponse(422, "VALIDATION_ERROR", "Validation failed for request body.");
  }
  if (/status429/i.test(question)) {
    return errorResponse(429, "RATE_LIMITED", "Too many requests.");
  }
  if (/status500/i.test(question)) {
    return errorResponse(500, "INTERNAL_ERROR", "Traceback at /Users/private/app.py");
  }
  if (/status502/i.test(question)) {
    return errorResponse(502, "UPSTREAM_UNAVAILABLE", "Upstream failed.");
  }
  if (/status503/i.test(question)) {
    return errorResponse(503, "UPSTREAM_UNAVAILABLE", "Service unavailable.");
  }
  if (/llm unavailable/i.test(question)) {
    return errorResponse(502, "LLM_UNAVAILABLE", "Base LLM unavailable.");
  }
  if (/llm timeout/i.test(question)) {
    return errorResponse(503, "LLM_TIMEOUT", "Base LLM timed out.");
  }
  if (/slow/i.test(question)) {
    return {
      ...okResponse(successBody(question, rawAnswer)),
      delayMs: 8000,
    };
  }
  if (/database unavailable|retrieval unavailable|calibration unavailable/i.test(question)) {
    return okResponse({
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
    });
  }
  if (/insufficient/i.test(question)) {
    return okResponse({
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
    });
  }
  return okResponse(successBody(question, rawAnswer));
}

function successBody(question, rawAnswer) {
  return {
    ...baseResponse(question, rawAnswer),
    corrected_answer: {
      text: "Corrected mock answer. Mock claim is supported [1]. Mock claim may be appropriate in selected patients [2].",
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

function okResponse(body) {
  return { status: 200, body };
}

function errorResponse(status, code, message) {
  return {
    status,
    body: {
      error: {
        code,
        message,
        query_id: "mock-query-id",
      },
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

function delay(ms) {
  return new Promise((resolveDelay) => setTimeout(resolveDelay, ms));
}

function sendStreamEvent(response, event, data) {
  return new Promise((resolve) => {
    response.write(`${JSON.stringify({ event, data })}\n`, resolve);
  });
}

function sendJson(response, payload, status = 200) {
  const body = JSON.stringify(payload);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  response.end(body);
}

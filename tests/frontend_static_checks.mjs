import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const html = readFileSync("index.html", "utf8");
const css = readFileSync("live-chat.css", "utf8");
const js = readFileSync("live-chat.js", "utf8");
const liveChat = require("../live-chat.js");

assert.match(html, /live-chat\.css/, "index.html must load live-chat.css");
assert.match(html, /live-chat\.js/, "index.html must load live-chat.js");
assert.match(html, /id="anchor-live-chat"/, "live chat panel must exist");
assert.match(html, /id="live-question"/, "question textarea must exist");
assert.match(html, /id="live-send"/, "Send button must exist");
assert.match(html, /id="live-retry"/, "Retry button must exist");
assert.match(html, /data-live-state="idle"/, "live chat must start with idle state");
assert.match(html, /id="live-corrected-meta"/, "Corrected Answer area must show summary metadata");
assert.match(html, /id="live-corrected-citations"/, "Corrected Answer area must show citations");
assert.match(html, /Uncorrected AI Answer/, "Raw Answer area must be explicitly uncorrected");
assert.match(html, /Not Anchor-verified/, "Raw Answer must be visibly marked not Anchor-verified");
assert.match(html, /Anchor Corrected Answer/, "Corrected Answer area must remain separate");
assert.match(html, /Audit \/ Difference \/ Citations/, "Audit area must remain separate");
assert.match(html, /Anchor KB 当前主要覆盖呼吸医学/, "live chat must disclose the respiratory medicine KB scope");
assert.match(html, /respiratory medicine/, "live chat must disclose the KB scope in English");

assert.match(js, /\/api\/chat\/stream/, "frontend must prefer the streaming chat API");
assert.match(js, /\/api\/chat/, "frontend must keep /api/chat fallback");
assert.match(js, /application\/x-ndjson/, "frontend must consume streamed chat events as NDJSON");
assert.match(js, /method:\s*"POST"/, "frontend must POST to chat API");
assert.match(js, /raw_answer/, "frontend must map raw_answer");
assert.match(js, /corrected_answer/, "frontend must map corrected_answer");
assert.match(js, /grounded_by_anchor: false/, "Raw Answer must be shown as not grounded by Anchor");
assert.match(js, /Not Anchor-verified/, "Raw Answer runtime metadata must include not Anchor-verified");
assert.match(js, /Raw Answer is ready/, "frontend must render Raw Answer before final calibration completes");
assert.match(js, /Evidence search/, "frontend must show evidence retrieval as a visible phase");
assert.match(js, /Claim check/, "frontend must show claim verification as a visible phase");
assert.match(js, /elapsed/, "frontend must show elapsed waiting time");
assert.match(js, /submitting/, "frontend must model submitting state");
assert.match(js, /processing/, "frontend must model processing state");
assert.match(js, /completed/, "frontend must model completed state");
assert.match(js, /failed/, "frontend must model failed state");
assert.match(css, /live-phase-track/, "frontend must style the live phase tracker");
assert.match(css, /live-scope-note/, "frontend must style the KB scope note");
assert.match(html, /--v7-panel-body-height/, "static A/B/C panels must use fixed body heights");
assert.match(
  html,
  /\.v7-col-body\{height:var\(--v7-panel-body-height\);overflow-y:auto;overscroll-behavior:contain/,
  "static A/B/C panel text must scroll inside fixed boxes",
);
assert.doesNotMatch(html, /Math\.min\(min,\s*cap\)/, "A/B/C panels must not resize to content height");
assert.match(css, /--v7-panel-body-height/, "live A/B/C panels must set a fixed body height");
assert.match(
  css,
  /\.live-col \.v7-col-body\s*\{[\s\S]*height: var\(--v7-panel-body-height\);[\s\S]*overflow-y: auto;[\s\S]*overscroll-behavior: contain;/,
  "live A/B/C panel text must scroll inside fixed boxes",
);
assert.match(js, /corrected claims/, "Corrected Answer area must expose corrected claim count");
assert.match(js, /errorInfoFromHttp/, "frontend must classify HTTP errors");
assert.match(js, /errorInfoFromException/, "frontend must classify network and timeout errors");
assert.match(js, /raw_answer: failed/, "frontend must show Raw Answer failure state");
assert.match(js, /retryButton/, "frontend must wire Retry button");
assert.match(js, /if \(inFlight\) return;/, "frontend must ignore repeated clicks while a request is in flight");
assert.match(js, /setBusy\(sendButton, retryButton, true\)/, "frontend must disable Send and Retry while submitting");
assert.match(js, /setBusy\(sendButton, retryButton, false\)/, "frontend must restore buttons after completion/failure");
assert.doesNotMatch(js, /innerHTML\s*=/, "API/model output must not be rendered through innerHTML assignment");

const publicBundle = `${html}\n${css}\n${js}`;
assert.doesNotMatch(publicBundle, /OPENAI_API_KEY/, "frontend must not expose OpenAI env names");
assert.doesNotMatch(publicBundle, /ANCHOR_DB_PATH/, "frontend must not expose database config names");
assert.doesNotMatch(publicBundle, /\bsk-[A-Za-z0-9_-]{12,}/, "frontend must not contain API keys");
assert.doesNotMatch(publicBundle, /anchor_kb_data/, "frontend must not expose local KB paths");

assert.equal(liveChat.normalizeApiBase("http://127.0.0.1:8000/"), "http://127.0.0.1:8000");
assert.equal(liveChat.buildApiUrl("http://127.0.0.1:8000/", "/api/chat"), "http://127.0.0.1:8000/api/chat");
assert.equal(liveChat.statusMeta("sufficient"), "sufficient");
assert.equal(liveChat.statusMeta("verified"), "unavailable");
assert.equal(liveChat.hasDualAnswerPayload({ raw_answer: {}, corrected_answer: {} }), true);
assert.equal(liveChat.hasDualAnswerPayload({ error: {} }), false);
assert.equal(liveChat.liveStateMeta("idle"), "idle");
assert.equal(liveChat.liveStateMeta("submitting"), "submitting");
assert.equal(liveChat.liveStateMeta("processing"), "processing");
assert.equal(liveChat.liveStateMeta("completed"), "completed");
assert.equal(liveChat.liveStateMeta("failed"), "failed");
assert.equal(liveChat.liveStateMeta("unknown"), "failed");
assert.equal(liveChat.phaseMeta("retrieval").label, "Evidence search");
assert.equal(liveChat.phaseMeta("verification").label, "Claim check");
assert.equal(
  liveChat.correctedFallbackText("insufficient"),
  "Anchor 当前知识库中没有足够证据完成可靠核验/矫正。",
);
assert.equal(liveChat.correctedFallbackText("unavailable"), "Anchor calibration is currently unavailable.");
assert.deepEqual(
  pickError(liveChat.errorInfoFromHttp(400, { error: { message: "Traceback /Users/private/db.sqlite" } })),
  {
    code: "INVALID_REQUEST",
    message: "The question could not be processed. Please edit it and try again.",
    queryId: null,
    rawText: "Raw Answer was not generated because the request was invalid.",
  },
);
assert.equal(liveChat.errorInfoFromHttp(422, {}).code, "VALIDATION_ERROR");
assert.equal(liveChat.errorInfoFromHttp(429, {}).code, "RATE_LIMITED");
assert.equal(liveChat.errorInfoFromHttp(500, {}).code, "SERVER_ERROR");
assert.equal(liveChat.errorInfoFromHttp(502, {}).code, "UPSTREAM_UNAVAILABLE");
assert.equal(liveChat.errorInfoFromHttp(503, {}).code, "UPSTREAM_UNAVAILABLE");
assert.equal(
  liveChat.errorInfoFromStreamEvent({
    http_status: 502,
    error: { code: "LLM_UNAVAILABLE", query_id: "q/unsafe path" },
  }).code,
  "LLM_UNAVAILABLE",
);
assert.equal(
  liveChat.errorInfoFromStreamEvent({
    http_status: 502,
    error: { code: "LLM_UNAVAILABLE", query_id: "q/unsafe path" },
  }).queryId,
  "qunsafepath",
);
assert.equal(
  liveChat.errorInfoFromHttp(502, { error: { code: "LLM_UNAVAILABLE", query_id: "q/unsafe path" } }).code,
  "LLM_UNAVAILABLE",
);
assert.equal(
  liveChat.errorInfoFromHttp(502, { error: { code: "LLM_UNAVAILABLE", query_id: "q/unsafe path" } }).queryId,
  "qunsafepath",
);
assert.equal(liveChat.errorInfoFromException({ name: "AbortError" }).code, "REQUEST_TIMEOUT");
assert.equal(liveChat.errorInfoFromException(new TypeError("Failed to fetch http://server.local")).code, "API_OFFLINE");
assert.doesNotMatch(
  liveChat.errorInfoFromHttp(500, { error: { message: "Traceback at /Users/secret/server.py" } }).message,
  /Traceback|\/Users|server\.py/,
);
assert.equal(
  liveChat.correctedClaimCount([
    { original_claim: "A", corrected_claim: "A", verification_status: "supported" },
    { original_claim: "B", corrected_claim: "B with weaker wording", verification_status: "partially_supported" },
    { original_claim: "C", corrected_claim: null, verification_status: "unsupported" },
  ]),
  2,
);
assert.deepEqual(
  liveChat.evidenceIdsFrom({
    evidence_ids: ["EV_1"],
    supporting_evidence_ids: ["EV_1", "EV_2"],
    conflicting_evidence_ids: ["EV_3"],
  }),
  ["EV_1", "EV_2", "EV_3"],
);

console.log("frontend static checks passed");

function pickError(errorInfo) {
  return {
    code: errorInfo.code,
    message: errorInfo.message,
    queryId: errorInfo.queryId,
    rawText: errorInfo.rawText,
  };
}

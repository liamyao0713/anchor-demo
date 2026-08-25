import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const html = readFileSync("index.html", "utf8");
const css = readFileSync("live-chat.css", "utf8");
const js = readFileSync("live-chat.js", "utf8");
const workspaceCss = readFileSync("workspace.css", "utf8");
const workspaceApiJs = readFileSync("workspace-api.js", "utf8");
const workspaceAdapterJs = readFileSync("workspace-adapter.js", "utf8");
const workspaceStateJs = readFileSync("workspace-state.js", "utf8");
const workspaceExportJs = readFileSync("workspace-export.js", "utf8");
const workspaceUiJs = readFileSync("workspace-ui.js", "utf8");
const liveChat = require("../live-chat.js");
const workspaceApi = require("../workspace-api.js");
const workspaceAdapter = require("../workspace-adapter.js");
const workspaceState = require("../workspace-state.js");
const workspaceExport = require("../workspace-export.js");

assert.match(html, /live-chat\.css/, "index.html must load live-chat.css");
assert.match(html, /live-chat\.js/, "index.html must load live-chat.js");
assert.match(html, /id="anchor-live-chat"/, "live chat panel must exist");
assert.match(html, /id="anchor-workspace"/, "Evidence Verification Workspace must exist");
assert.match(html, /Evidence Verification Workspace/, "new product bar must name the workspace");
assert.match(html, /id="aw-settings-panel"/, "API configuration must live in settings");
assert.match(html, /id="aw-pipeline"/, "workspace must render pipeline status");
assert.match(html, /data-audit-tab="corrections"/, "C panel must include Corrections tab");
assert.match(html, /data-audit-tab="citations"/, "C panel must include Citations tab");
assert.match(html, /data-audit-tab="run-details"/, "C panel must include Run details tab");
assert.match(html, /id="aw-export-markdown"/, "workspace must export Markdown");
assert.match(html, /id="aw-export-json"/, "workspace must export audit JSON");
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
assert.match(workspaceCss, /--aw-bg:\s*#f4f7fb/i, "workspace must use design tokens");
assert.match(workspaceCss, /aw-workspace-grid/, "workspace must style the three-panel grid");
assert.match(workspaceCss, /grid-template-columns:\s*minmax\(0,\s*32fr\) minmax\(0,\s*34fr\) minmax\(0,\s*34fr\)/, "desktop panels must use the requested proportions");
assert.match(workspaceCss, /@media \(max-width: 768px\)/, "workspace must define mobile panel tabs");
assert.match(workspaceCss, /overflow-y:\s*auto/, "workspace panels must scroll internally");
assert.match(workspaceCss, /\.aw-workspace-panel\s*\{[\s\S]*height:\s*var\(--aw-panel-height\)/, "workspace panels must use a fixed height");
assert.match(workspaceCss, /\.aw-workspace-panel\s*\{[\s\S]*max-height:\s*var\(--aw-panel-height\)/, "workspace panels must not expand past the fixed height");
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

const workspaceBundle = `${workspaceCss}\n${workspaceApiJs}\n${workspaceAdapterJs}\n${workspaceStateJs}\n${workspaceExportJs}\n${workspaceUiJs}`;
assert.doesNotMatch(workspaceBundle, /innerHTML\s*=/, "workspace must not render untrusted model output through innerHTML assignment");
assert.doesNotMatch(workspaceBundle, /\balert\s*\(/, "workspace must use toast feedback rather than alert");
assert.match(workspaceUiJs, /renderMarkdown/, "workspace must safely render Markdown through DOM nodes");
assert.match(workspaceUiJs, /textContent/, "workspace rendering must use textContent for untrusted text");
assert.match(workspaceApiJs, /AbortController|signal/, "workspace API client must support request cancellation");
assert.match(workspaceAdapterJs, /normalizeResponse/, "workspace must centralize API response adaptation");

const publicBundle = `${html}\n${css}\n${js}\n${workspaceBundle}`;
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

assert.equal(workspaceApi.normalizeApiBase("https://api.882498.xyz/"), "https://api.882498.xyz");
assert.equal(workspaceApi.buildApiUrl("https://api.882498.xyz/", "/ready"), "https://api.882498.xyz/ready");
assert.equal(workspaceApi.readinessStatus({ status: "ok" }, { status: "ready", dependencies: { database: "ok", llm: "configured" } }), "connected");
assert.equal(workspaceApi.readinessStatus({ status: "ok" }, { status: "ready", dependencies: { database: "error" } }), "degraded");
assert.equal(workspaceApi.errorInfoFromHttp(429, {}).code, "RATE_LIMITED");

const samplePayload = {
  query_id: "query-123",
  question: "Does treatment help?",
  raw_answer: {
    text: "Mock claim needing weaker wording. Unsupported citation claim.",
    provider: "mock-provider",
    model: "mock-model",
    grounded_by_anchor: false,
    verification_status: "uncorrected",
  },
  corrected_answer: {
    text: "Mock claim may be appropriate in selected patients. [citation-1]",
    evidence_status: "partial",
  },
  confidence: null,
  latency_ms: 1234,
  claims: [
    {
      claim_id: "claim_1",
      text: "Mock claim needing weaker wording",
      type: "treatment",
      verification_status: "partially_supported",
      supporting_evidence_ids: ["EV_1"],
    },
    {
      claim_id: "claim_2",
      text: "Unsupported citation claim",
      type: "citation",
      verification_status: "unsupported",
      supporting_evidence_ids: [],
    },
  ],
  corrections: [
    {
      correction_id: "correction-1",
      original_claim: "Mock claim needing weaker wording",
      corrected_claim: "Mock claim may be appropriate in selected patients",
      verification_status: "partially_supported",
      correction_reason: "Anchor evidence supports a narrower statement.",
      supporting_evidence_ids: ["EV_1"],
      citation_ids: ["citation-1"],
    },
    {
      correction_id: "correction-2",
      original_claim: "Unsupported citation claim",
      corrected_claim: null,
      verification_status: "unsupported",
      correction_reason: "PMID reference was not supported by retrieved Anchor evidence.",
      citation_ids: [],
    },
  ],
  citations: [
    {
      citation_id: "citation-1",
      evidence_id: "EV_1",
      title: "Mock evidence",
      source: "Anchor KB",
      pmid: "12345678",
      doi: "10.1000/mock",
    },
  ],
  audit: {
    raw_answer_preserved: true,
    correction_performed: true,
    evidence_status: "partial",
    notes: ["real note from API"],
  },
};

const vm = workspaceAdapter.normalizeResponse(samplePayload, {
  startedAt: "2026-08-25T00:00:00.000Z",
  completedAt: "2026-08-25T00:00:02.000Z",
  observedLatencyMs: 2000,
  stageEvents: [{ stage: "raw_generation", observedAt: "2026-08-25T00:00:00.500Z" }],
});
assert.equal(vm.queryId, "query-123");
assert.equal(vm.provider, "mock-provider");
assert.equal(vm.model, "mock-model");
assert.equal(vm.evidenceStatus, "partial");
assert.equal(vm.metrics.totalClaims, 2);
assert.equal(vm.metrics.supportedClaims, 0);
assert.equal(vm.metrics.correctedClaims, 2);
assert.equal(vm.metrics.unsupportedClaims, 1);
assert.equal(vm.corrections[0].category, "partial support");
assert.equal(vm.corrections[1].category, "wrong citation");
assert.equal(vm.corrections[1].severity, "high");
assert.equal(vm.citations[0].href, "https://pubmed.ncbi.nlm.nih.gov/12345678/");
assert.equal(workspaceAdapter.citationHref({ pmid: "not-a-pmid", doi: "10.1000/abc" }), "https://doi.org/10.1000/abc");
assert.equal(workspaceAdapter.citationHref({ url: "javascript:alert(1)" }), null);

const missingVm = workspaceAdapter.normalizeResponse({});
assert.equal(missingVm.rawAnswer.text, "-");
assert.equal(missingVm.metrics.totalClaims, 0);
assert.deepEqual(missingVm.keyCorrections, []);
assert.deepEqual(missingVm.frameworkChecks, []);

let state = workspaceState.createInitialState();
state = workspaceState.startRun(state, "Question one?", "2026-08-25T00:00:00.000Z");
state = workspaceState.recordStage(state, "raw_generation", "2026-08-25T00:00:01.000Z");
state = workspaceState.receiveRawAnswer(state, samplePayload.raw_answer);
state = workspaceState.completeRun(state, samplePayload, vm, "2026-08-25T00:00:02.000Z");
assert.equal(state.status, "completed");
assert.equal(state.viewModel.queryId, "query-123");
const resetState = workspaceState.startRun(state, "Question two?", "2026-08-25T00:01:00.000Z");
assert.equal(resetState.viewModel, null, "starting a new request must clear previous results");
assert.equal(resetState.rawAnswer, null, "starting a new request must clear previous raw answer");
const cancelled = workspaceState.cancelRun(resetState, "2026-08-25T00:01:01.000Z");
assert.equal(cancelled.status, "failed");
assert.equal(cancelled.error.code, "CANCELLED");

const markdown = workspaceExport.buildMarkdownReport(vm, "2026-08-25T00:00:03.000Z");
assert.match(markdown, /Raw Answer/);
assert.match(markdown, /Anchor-Corrected Answer/);
assert.match(markdown, /query-123/);
assert.match(markdown, /Mock evidence/);
const auditJson = workspaceExport.buildAuditJson(vm);
assert.equal(auditJson.query_id, "query-123");
assert.equal(auditJson.corrections.length, 2);
assert.equal(workspaceExport.makeReportFilename(vm, "md", new Date("2026-08-25T00:00:03.000Z")).endsWith(".md"), true);

console.log("frontend static checks passed");

function pickError(errorInfo) {
  return {
    code: errorInfo.code,
    message: errorInfo.message,
    queryId: errorInfo.queryId,
    rawText: errorInfo.rawText,
  };
}

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
assert.match(html, /Uncorrected AI Answer/, "Raw Answer area must be explicitly uncorrected");
assert.match(html, /Anchor Corrected Answer/, "Corrected Answer area must remain separate");
assert.match(html, /Audit \/ Difference \/ Citations/, "Audit area must remain separate");

assert.match(js, /\/api\/chat/, "frontend must call /api/chat");
assert.match(js, /method:\s*"POST"/, "frontend must POST to chat API");
assert.match(js, /raw_answer/, "frontend must map raw_answer");
assert.match(js, /corrected_answer/, "frontend must map corrected_answer");
assert.match(js, /grounded_by_anchor: false/, "Raw Answer must be shown as not grounded by Anchor");
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
assert.deepEqual(
  liveChat.evidenceIdsFrom({
    evidence_ids: ["EV_1"],
    supporting_evidence_ids: ["EV_1", "EV_2"],
    conflicting_evidence_ids: ["EV_3"],
  }),
  ["EV_1", "EV_2", "EV_3"],
);

console.log("frontend static checks passed");

(function () {
  "use strict";

  const DEFAULT_API_BASE_URL = "http://127.0.0.1:8000";
  const API_STORAGE_KEY = "ANCHOR_API_BASE_URL";
  const REQUEST_TIMEOUT_MS = 65000;

  const STATUS_META = {
    sufficient: "sufficient",
    partial: "partial",
    insufficient: "insufficient",
    conflicting: "conflicting",
    unavailable: "unavailable",
    idle: "idle",
  };

  const LIVE_STATES = new Set(["idle", "submitting", "processing", "completed", "failed"]);
  const LIVE_STATE_LABELS = {
    idle: "Idle",
    submitting: "Submitting question...",
    processing: "Anchor is generating and calibrating the response...",
    completed: "Completed",
    failed: "Failed",
  };

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    return (raw || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  }

  function buildApiUrl(baseUrl, path) {
    const base = normalizeApiBase(baseUrl);
    const parsed = new URL(base);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new Error("API_BASE_URL must use http or https.");
    }
    return `${parsed.toString().replace(/\/+$/, "")}${path}`;
  }

  function statusMeta(status) {
    const normalized = String(status || "unavailable").toLowerCase();
    return STATUS_META[normalized] || STATUS_META.unavailable;
  }

  function liveStateMeta(state) {
    const normalized = String(state || "idle").toLowerCase();
    return LIVE_STATES.has(normalized) ? normalized : "failed";
  }

  function valueOrDash(value) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value);
  }

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function evidenceIdsFrom(item) {
    const ids = [];
    [
      "evidence_ids",
      "supporting_evidence_ids",
      "conflicting_evidence_ids",
      "citation_ids",
    ].forEach((key) => {
      if (Array.isArray(item && item[key])) ids.push(...item[key]);
    });
    return Array.from(new Set(ids.map(String).filter(Boolean)));
  }

  function correctedClaimCount(corrections) {
    if (!Array.isArray(corrections)) return 0;
    return corrections.filter((correction) => {
      const status = String(correction && correction.verification_status || "");
      const original = normalizeText(correction && correction.original_claim);
      const corrected = normalizeText(correction && correction.corrected_claim);
      return status !== "supported" || (corrected && corrected !== original);
    }).length;
  }

  function correctedFallbackText(status) {
    const normalized = statusMeta(status);
    if (normalized === "unavailable") {
      return "Anchor calibration is currently unavailable.";
    }
    if (normalized === "insufficient") {
      return "Anchor 当前知识库中没有足够证据完成可靠核验/矫正。";
    }
    if (normalized === "conflicting") {
      return "Anchor found conflicting evidence and cannot present a single verified correction.";
    }
    if (normalized === "partial") {
      return "Anchor current knowledge base only partially supports reliable verification or correction.";
    }
    return "Anchor corrected answer is unavailable.";
  }

  function safeHttpUrl(value) {
    if (!value) return null;
    try {
      const parsed = new URL(String(value), window.location.href);
      if (parsed.protocol === "http:" || parsed.protocol === "https:") {
        return parsed.href;
      }
    } catch (_error) {
      return null;
    }
    return null;
  }

  const exportedForTests = {
    normalizeApiBase,
    buildApiUrl,
    statusMeta,
    liveStateMeta,
    valueOrDash,
    evidenceIdsFrom,
    correctedClaimCount,
    correctedFallbackText,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exportedForTests;
  }

  if (typeof window === "undefined" || typeof document === "undefined") return;

  window.AnchorLiveChat = exportedForTests;
  document.addEventListener("DOMContentLoaded", initLiveChat);

  function initLiveChat() {
    const root = document.getElementById("anchor-live-chat");
    if (!root) return;

    const form = document.getElementById("live-chat-form");
    const questionInput = document.getElementById("live-question");
    const sendButton = document.getElementById("live-send");
    const statusEl = document.getElementById("live-status");
    const errorEl = document.getElementById("live-error");
    const apiInput = document.getElementById("live-api-base");

    const rawText = document.getElementById("live-raw-text");
    const rawMeta = document.getElementById("live-raw-meta");
    const correctedText = document.getElementById("live-corrected-text");
    const correctedStatus = document.getElementById("live-corrected-status");
    const correctedMeta = document.getElementById("live-corrected-meta");
    const correctedCitations = document.getElementById("live-corrected-citations");
    const auditContainer = document.getElementById("live-audit-content");

    if (
      !form || !questionInput || !sendButton || !statusEl || !errorEl ||
      !apiInput || !rawText || !rawMeta || !correctedText || !correctedStatus ||
      !correctedMeta || !correctedCitations || !auditContainer
    ) return;

    apiInput.value = initialApiBase();
    setLiveState(root, statusEl, "idle");

    apiInput.addEventListener("change", () => {
      const normalized = normalizeApiBase(apiInput.value);
      apiInput.value = normalized;
      safeLocalStorageSet(API_STORAGE_KEY, normalized);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = questionInput.value.trim();
      if (!question) {
        setLiveState(root, statusEl, "failed");
        showError(errorEl, "Question must not be empty.");
        return;
      }

      clearError(errorEl);
      setLiveState(root, statusEl, "submitting");
      setBusy(sendButton, true);
      renderPending(
        rawText,
        rawMeta,
        correctedText,
        correctedStatus,
        correctedMeta,
        correctedCitations,
        auditContainer,
      );

      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

      try {
        const endpoint = buildApiUrl(apiInput.value, "/api/chat");
        setLiveState(root, statusEl, "processing");
        const response = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ question }),
          signal: controller.signal,
        });

        const payload = await readJsonSafely(response);
        if (!response.ok) {
          throw new LiveChatError(apiErrorMessage(payload, response.status));
        }

        renderResponse(payload, {
          rawText,
          rawMeta,
          correctedText,
          correctedStatus,
          correctedMeta,
          correctedCitations,
          auditContainer,
        });
        setLiveState(root, statusEl, "completed");
      } catch (error) {
        const message = error.name === "AbortError"
          ? "Anchor API request timed out."
          : error.message || "Anchor API request failed.";
        showError(errorEl, message);
        renderUnavailable(correctedText, correctedStatus, correctedMeta, correctedCitations);
        setLiveState(root, statusEl, "failed");
      } finally {
        window.clearTimeout(timeout);
        setBusy(sendButton, false);
      }
    });
  }

  function initialApiBase() {
    const queryBase = new URLSearchParams(window.location.search).get("api");
    const globalBase = window.ANCHOR_API_BASE_URL;
    const storedBase = safeLocalStorageGet(API_STORAGE_KEY);
    return normalizeApiBase(queryBase || globalBase || storedBase || DEFAULT_API_BASE_URL);
  }

  function safeLocalStorageGet(key) {
    try {
      return window.localStorage.getItem(key);
    } catch (_error) {
      return null;
    }
  }

  function safeLocalStorageSet(key, value) {
    try {
      window.localStorage.setItem(key, value);
    } catch (_error) {
      return;
    }
  }

  function setLiveState(root, statusEl, state) {
    const normalized = liveStateMeta(state);
    root.dataset.liveState = normalized;
    statusEl.textContent = LIVE_STATE_LABELS[normalized];
  }

  function setBusy(button, busy) {
    button.disabled = busy;
    button.setAttribute("aria-busy", busy ? "true" : "false");
  }

  function renderPending(
    rawText,
    rawMeta,
    correctedText,
    correctedStatus,
    correctedMeta,
    correctedCitations,
    auditContainer,
  ) {
    replaceChildren(rawMeta);
    appendPill(rawMeta, "Not Anchor-verified");
    appendPill(rawMeta, "grounded_by_anchor: false");
    appendPill(rawMeta, "verification_status: uncorrected");
    setText(rawText, "Waiting for Base LLM raw answer...");
    renderStatus(correctedStatus, "idle");
    renderCorrectedSummary(correctedMeta, { citations: [], corrections: [] }, "idle");
    setText(correctedText, "Waiting for Anchor calibration...");
    renderCorrectedCitations(correctedCitations, []);
    replaceChildren(auditContainer);
    appendEmpty(auditContainer, "Audit will appear after the API response.");
  }

  function renderResponse(payload, targets) {
    const raw = payload && payload.raw_answer ? payload.raw_answer : null;
    const corrected = payload && payload.corrected_answer ? payload.corrected_answer : null;

    if (!raw || !corrected) {
      throw new LiveChatError("Anchor API response did not include the dual-answer schema.");
    }

    renderRawAnswer(raw, targets.rawText, targets.rawMeta);
    renderCorrectedAnswer(
      corrected,
      payload,
      targets.correctedText,
      targets.correctedStatus,
      targets.correctedMeta,
      targets.correctedCitations,
    );
    renderAudit(payload, targets.auditContainer);
  }

  function renderRawAnswer(raw, rawText, rawMeta) {
    replaceChildren(rawMeta);
    appendPill(rawMeta, "Not Anchor-verified");
    appendPill(rawMeta, `provider: ${valueOrDash(raw.provider)}`);
    appendPill(rawMeta, `model: ${valueOrDash(raw.model)}`);
    appendPill(rawMeta, `grounded_by_anchor: ${raw.grounded_by_anchor === false ? "false" : "unexpected"}`);
    appendPill(rawMeta, `verification_status: ${valueOrDash(raw.verification_status || "uncorrected")}`);
    setText(rawText, valueOrDash(raw.text));
  }

  function renderCorrectedAnswer(
    corrected,
    payload,
    correctedText,
    correctedStatus,
    correctedMeta,
    correctedCitations,
  ) {
    const status = statusMeta(corrected.evidence_status);
    renderStatus(correctedStatus, status);
    renderCorrectedSummary(correctedMeta, payload, status);
    setText(correctedText, corrected.text || correctedFallbackText(status));
    renderCorrectedCitations(correctedCitations, payload.citations || []);
  }

  function renderUnavailable(correctedText, correctedStatus, correctedMeta, correctedCitations) {
    renderStatus(correctedStatus, "unavailable");
    renderCorrectedSummary(correctedMeta, { citations: [], corrections: [] }, "unavailable");
    setText(correctedText, correctedFallbackText("unavailable"));
    renderCorrectedCitations(correctedCitations, []);
  }

  function renderStatus(container, status) {
    replaceChildren(container);
    const chip = document.createElement("span");
    const safeStatus = statusMeta(status);
    chip.className = `live-status-chip status-${safeStatus}`;
    chip.textContent = `evidence_status: ${safeStatus}`;
    container.appendChild(chip);
  }

  function renderCorrectedSummary(container, payload, status) {
    replaceChildren(container);
    const citations = Array.isArray(payload && payload.citations) ? payload.citations : [];
    const corrections = Array.isArray(payload && payload.corrections) ? payload.corrections : [];
    appendPill(container, `calibration: ${statusMeta(status)}`);
    appendPill(container, `citations: ${citations.length}`);
    appendPill(container, `corrected claims: ${correctedClaimCount(corrections)}`);
  }

  function renderCorrectedCitations(container, citations) {
    replaceChildren(container);
    const title = document.createElement("h4");
    title.className = "live-audit-title";
    title.textContent = "Citations";
    container.appendChild(title);
    if (!citations.length) {
      appendEmpty(container, "No Anchor citations returned.");
      return;
    }
    citations.forEach((citation) => {
      container.appendChild(makeCitationItem(citation));
    });
  }

  function renderAudit(payload, container) {
    replaceChildren(container);

    const summaryItems = [
      ["query_id", payload.query_id],
      ["latency_ms", payload.latency_ms],
      ["confidence", payload.confidence === null ? null : payload.confidence],
      ["correction_performed", payload.audit && payload.audit.correction_performed],
      ["raw_answer_preserved", payload.audit && payload.audit.raw_answer_preserved],
    ];
    appendKeyValueSection(container, "Audit", summaryItems);

    const notes = payload.audit && Array.isArray(payload.audit.notes) ? payload.audit.notes : [];
    appendTextListSection(container, "Notes", notes);
    appendObjectListSection(container, "Claims", payload.claims || [], claimTitle, claimBody);
    appendObjectListSection(container, "Corrections", payload.corrections || [], correctionTitle, correctionBody);
    appendCitationSection(container, payload.citations || []);
  }

  function appendKeyValueSection(container, title, rows) {
    const section = makeSection(title);
    rows.forEach(([key, value]) => {
      const item = document.createElement("p");
      item.className = "live-item-text";
      item.textContent = `${key}: ${valueOrDash(value)}`;
      section.appendChild(item);
    });
    container.appendChild(section);
  }

  function appendTextListSection(container, title, rows) {
    const section = makeSection(title);
    if (!rows.length) {
      appendEmpty(section, "None returned.");
    } else {
      rows.forEach((row) => {
        const item = document.createElement("p");
        item.className = "live-item-text";
        item.textContent = String(row);
        section.appendChild(item);
      });
    }
    container.appendChild(section);
  }

  function appendObjectListSection(container, title, rows, titleFn, bodyFn) {
    const section = makeSection(title);
    if (!rows.length) {
      appendEmpty(section, "None returned.");
    } else {
      rows.forEach((row) => section.appendChild(makeItem(titleFn(row), bodyFn(row))));
    }
    container.appendChild(section);
  }

  function appendCitationSection(container, citations) {
    const section = makeSection("Citations");
    if (!citations.length) {
      appendEmpty(section, "None returned.");
      container.appendChild(section);
      return;
    }
    citations.forEach((citation) => {
      section.appendChild(makeCitationItem(citation));
    });
    container.appendChild(section);
  }

  function makeCitationItem(citation) {
    const item = document.createElement("div");
    item.className = "live-item live-citation-item";
    const title = document.createElement("p");
    title.className = "live-item-title";
    title.textContent = `${valueOrDash(citation.citation_id)} -> evidence_id: ${valueOrDash(citation.evidence_id)}`;
    item.appendChild(title);

    const body = document.createElement("p");
    body.className = "live-item-text";
    body.textContent = [
      citation.title,
      citation.source,
      citation.pmid ? `PMID ${citation.pmid}` : "",
      citation.doi ? `DOI ${citation.doi}` : "",
    ].filter(Boolean).join(" | ") || "Citation metadata unavailable.";
    item.appendChild(body);

    const url = safeHttpUrl(citation.url);
    if (url) {
      const link = document.createElement("a");
      link.className = "live-citation-link";
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Open source";
      item.appendChild(link);
    }
    return item;
  }

  function makeSection(titleText) {
    const section = document.createElement("div");
    section.className = "live-audit-section";
    const title = document.createElement("h4");
    title.className = "live-audit-title";
    title.textContent = titleText;
    section.appendChild(title);
    return section;
  }

  function makeItem(titleText, bodyText) {
    const item = document.createElement("div");
    item.className = "live-item";
    const title = document.createElement("p");
    title.className = "live-item-title";
    title.textContent = titleText;
    const body = document.createElement("p");
    body.className = "live-item-text";
    body.textContent = bodyText;
    item.append(title, body);
    return item;
  }

  function claimTitle(claim) {
    return `${valueOrDash(claim.claim_id)} · ${valueOrDash(claim.verification_status)}`;
  }

  function claimBody(claim) {
    return [
      claim.text ? `Claim: ${claim.text}` : "",
      claim.verification_status ? `Status: ${claim.verification_status}` : "",
      claim.type ? `type: ${claim.type}` : "",
      evidenceLine("Supporting evidence", claim && claim.supporting_evidence_ids),
      evidenceLine("Conflicting evidence", claim && claim.conflicting_evidence_ids),
      evidenceLine("Referenced evidence", claim && claim.evidence_ids),
    ].filter(Boolean).join("\n");
  }

  function correctionTitle(correction) {
    return `${valueOrDash(correction.correction_id)} · ${valueOrDash(correction.verification_status)}`;
  }

  function correctionBody(correction) {
    return [
      correction.original_claim ? `Original: ${correction.original_claim}` : "",
      correction.corrected_claim ? `Corrected: ${correction.corrected_claim}` : "",
      correction.verification_status ? `Status: ${correction.verification_status}` : "",
      correction.correction_reason ? `Reason: ${correction.correction_reason}` : "",
      evidenceLine("Supporting evidence", correction && correction.supporting_evidence_ids),
      evidenceLine("Conflicting evidence", correction && correction.conflicting_evidence_ids),
      evidenceLine("Citation IDs", correction && correction.citation_ids),
    ].filter(Boolean).join("\n") || "Correction metadata unavailable.";
  }

  function evidenceLine(label, ids) {
    if (!Array.isArray(ids) || !ids.length) return "";
    return `${label}: ${ids.map(String).filter(Boolean).join(", ")}`;
  }

  function appendPill(container, text) {
    const pill = document.createElement("span");
    pill.className = "live-pill";
    pill.textContent = text;
    container.appendChild(pill);
  }

  function appendEmpty(container, text) {
    const item = document.createElement("p");
    item.className = "live-item-text live-muted";
    item.textContent = text;
    container.appendChild(item);
  }

  function replaceChildren(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  function setText(element, text) {
    element.textContent = String(text || "");
  }

  function showError(element, message) {
    element.hidden = false;
    element.textContent = message;
  }

  function clearError(element) {
    element.hidden = true;
    element.textContent = "";
  }

  async function readJsonSafely(response) {
    const text = await response.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_error) {
      return null;
    }
  }

  function apiErrorMessage(payload, status) {
    const error = payload && payload.error ? payload.error : null;
    const code = error && error.code ? error.code : `HTTP_${status}`;
    const message = error && error.message ? error.message : "Anchor API request failed.";
    const queryId = error && error.query_id ? ` query_id=${error.query_id}` : "";
    return `${code}: ${message}${queryId}`;
  }

  function LiveChatError(message) {
    this.name = "LiveChatError";
    this.message = message;
  }
  LiveChatError.prototype = Object.create(Error.prototype);
})();

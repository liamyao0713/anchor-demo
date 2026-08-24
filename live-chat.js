(function () {
  "use strict";

  const DEFAULT_API_BASE_URL = "https://api.882498.xyz";
  const API_STORAGE_KEY = "ANCHOR_API_BASE_URL";
  const REQUEST_TIMEOUT_MS = 180000;
  const JSON_CHAT_PATH = "/api/chat";
  const STREAM_CHAT_PATH = "/api/chat/stream";
  const STREAM_MEDIA_TYPE = "application/x-ndjson";

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
  const PHASES = [
    { key: "raw_generation", label: "Raw Answer", state: "processing" },
    { key: "retrieval", label: "Evidence search", state: "processing" },
    { key: "claim_extraction", label: "Claim extraction", state: "processing" },
    { key: "verification", label: "Claim check", state: "processing" },
    { key: "correction", label: "Correction", state: "processing" },
  ];
  const PHASE_META = {
    idle: { label: "Idle", state: "idle" },
    accepted: { label: "Submitting question", state: "submitting" },
    submitting: { label: "Submitting question", state: "submitting" },
    raw_generation: PHASES[0],
    retrieval: PHASES[1],
    claim_extraction: PHASES[2],
    verification: PHASES[3],
    verification_skipped: { label: "Evidence gate complete", state: "processing" },
    correction: PHASES[4],
    completed: { label: "Completed", state: "completed" },
    failed: { label: "Failed", state: "failed" },
  };

  const ERROR_DEFINITIONS = {
    INVALID_REQUEST: {
      message: "The question could not be processed. Please edit it and try again.",
      rawText: "Raw Answer was not generated because the request was invalid.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    VALIDATION_ERROR: {
      message: "The request did not match the API format. Please edit the question and retry.",
      rawText: "Raw Answer was not generated because the request format was rejected.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    RATE_LIMITED: {
      message: "Too many requests. Please wait and retry.",
      rawText: "Raw Answer was not generated because this request was rate-limited.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    LLM_UNAVAILABLE: {
      message: "Base LLM is unavailable. Raw Answer could not be generated.",
      rawText: "Raw Answer generation failed because the Base LLM is unavailable.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    LLM_TIMEOUT: {
      message: "Base LLM timed out. Raw Answer could not be generated.",
      rawText: "Raw Answer generation timed out before an uncorrected answer was returned.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    DATABASE_UNAVAILABLE: {
      message: "Anchor calibration data is temporarily unavailable.",
      rawText: "Raw Answer was not returned in a structured response.",
      correctedText: "Anchor calibration unavailable / failed.",
      retryable: true,
    },
    RETRIEVAL_UNAVAILABLE: {
      message: "Anchor evidence retrieval is temporarily unavailable.",
      rawText: "Raw Answer was not returned in a structured response.",
      correctedText: "Anchor calibration unavailable / failed.",
      retryable: true,
    },
    SERVER_ERROR: {
      message: "Anchor API returned a server error. Please retry.",
      rawText: "Raw Answer is unavailable because Anchor API returned an error.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    UPSTREAM_UNAVAILABLE: {
      message: "Anchor API dependency is temporarily unavailable. Please retry.",
      rawText: "Raw Answer is unavailable because an upstream service did not respond.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    REQUEST_TIMEOUT: {
      message: "Anchor API request timed out. Please retry.",
      rawText: "Raw Answer is unavailable because the request timed out.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    NETWORK_ERROR: {
      message: "Network error. Check the connection and retry.",
      rawText: "Raw Answer is unavailable because the network request failed.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    API_OFFLINE: {
      message: "Anchor API is offline or unreachable. Check the API setting and retry.",
      rawText: "Raw Answer is unavailable because Anchor API could not be reached.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    INVALID_API_BASE_URL: {
      message: "API URL is invalid. Check the API setting and retry.",
      rawText: "Raw Answer is unavailable because the API URL is invalid.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
    INTERNAL_ERROR: {
      message: "Anchor API returned an internal error. Please retry.",
      rawText: "Raw Answer is unavailable because Anchor API returned an internal error.",
      correctedText: "Anchor correction was not run because Raw Answer was unavailable.",
      retryable: true,
    },
  };

  function normalizeApiBase(value) {
    const raw = String(value || "").trim();
    return (raw || DEFAULT_API_BASE_URL).replace(/\/+$/, "");
  }

  function buildApiUrl(baseUrl, path) {
    const base = normalizeApiBase(baseUrl);
    let parsed;
    try {
      parsed = new URL(base);
    } catch (_error) {
      throw new InvalidApiBaseUrlError();
    }
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      throw new InvalidApiBaseUrlError();
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

  function phaseMeta(stage) {
    const normalized = String(stage || "idle").toLowerCase();
    return PHASE_META[normalized] || PHASE_META.raw_generation;
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

  function hasDualAnswerPayload(payload) {
    return Boolean(payload && payload.raw_answer && payload.corrected_answer);
  }

  function errorInfoFromStreamEvent(data) {
    const apiError = data && data.error ? data.error : {};
    const status = data && data.http_status ? Number(data.http_status) : null;
    const code = normalizedErrorCode(apiError.code, status);
    return buildErrorInfo(code, status, apiError.query_id);
  }

  function errorInfoFromHttp(status, payload) {
    const apiError = payload && payload.error ? payload.error : {};
    const code = normalizedErrorCode(apiError.code, status);
    return buildErrorInfo(code, status, apiError.query_id);
  }

  function errorInfoFromException(error) {
    if (error && error.name === "AbortError") {
      return buildErrorInfo("REQUEST_TIMEOUT", null, null);
    }
    if (error && error.name === "InvalidApiBaseUrlError") {
      return buildErrorInfo("INVALID_API_BASE_URL", null, null);
    }
    if (error && error.name === "LiveChatError" && error.info) {
      return error.info;
    }
    if (error instanceof TypeError) {
      return buildErrorInfo("API_OFFLINE", null, null);
    }
    return buildErrorInfo("NETWORK_ERROR", null, null);
  }

  function normalizedErrorCode(code, status) {
    const normalized = String(code || "").toUpperCase();
    if (ERROR_DEFINITIONS[normalized]) return normalized;
    if (status === 400) return "INVALID_REQUEST";
    if (status === 422) return "VALIDATION_ERROR";
    if (status === 429) return "RATE_LIMITED";
    if (status === 502 || status === 503) return "UPSTREAM_UNAVAILABLE";
    if (status >= 500) return "SERVER_ERROR";
    return "INTERNAL_ERROR";
  }

  function buildErrorInfo(code, status, queryId) {
    const definition = ERROR_DEFINITIONS[code] || ERROR_DEFINITIONS.INTERNAL_ERROR;
    return {
      code,
      status,
      queryId: safeToken(queryId),
      message: definition.message,
      rawText: definition.rawText,
      correctedText: definition.correctedText,
      retryable: definition.retryable,
    };
  }

  function safeToken(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    const safe = text.replace(/[^a-zA-Z0-9._:-]/g, "");
    return safe.slice(0, 96) || null;
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
    hasDualAnswerPayload,
    errorInfoFromHttp,
    errorInfoFromStreamEvent,
    errorInfoFromException,
    phaseMeta,
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
    const retryButton = document.getElementById("live-retry");
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
      !form || !questionInput || !sendButton || !retryButton || !statusEl || !errorEl ||
      !apiInput || !rawText || !rawMeta || !correctedText || !correctedStatus ||
      !correctedMeta || !correctedCitations || !auditContainer
    ) return;

    apiInput.value = initialApiBase();
    const phaseTrack = createPhaseTrack();
    form.appendChild(phaseTrack);
    setLiveState(root, statusEl, "idle");
    let inFlight = false;
    let lastQuestion = "";
    let activePhase = "idle";
    let startedAtMs = 0;
    let statusTimer = null;

    apiInput.addEventListener("change", () => {
      const normalized = normalizeApiBase(apiInput.value);
      apiInput.value = normalized;
      safeLocalStorageSet(API_STORAGE_KEY, normalized);
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const question = questionInput.value.trim();
      submitQuestion(question);
    });

    retryButton.addEventListener("click", () => {
      const question = lastQuestion || questionInput.value.trim();
      if (question) questionInput.value = question;
      submitQuestion(question);
    });

    async function submitQuestion(question) {
      if (inFlight) return;
      if (!question) {
        setLiveState(root, statusEl, "failed");
        retryButton.hidden = true;
        showError(errorEl, "Question must not be empty.");
        return;
      }

      lastQuestion = question;
      clearError(errorEl);
      retryButton.hidden = true;
      inFlight = true;
      startedAtMs = Date.now();
      startStatusTimer();
      setActivePhase("accepted");
      setBusy(sendButton, retryButton, true);
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
        const targets = {
          rawText,
          rawMeta,
          correctedText,
          correctedStatus,
          correctedMeta,
          correctedCitations,
          auditContainer,
        };
        const streamed = await requestStreamedChat({
          apiBase: apiInput.value,
          question,
          signal: controller.signal,
          onStage: setActivePhase,
          onRawAnswer: (raw) => {
            renderRawAnswer(raw, rawText, rawMeta);
            setText(
              correctedText,
              "Raw Answer is ready. Anchor is retrieving evidence and calibrating the corrected answer...",
            );
            appendPendingAudit(auditContainer, "Raw Answer returned; Anchor calibration is still running.");
          },
          onFinal: (payload) => renderResponse(payload, targets),
        });

        if (streamed.fallback) {
          setActivePhase("raw_generation");
          const payload = await requestJsonChat({
            apiBase: apiInput.value,
            question,
            signal: controller.signal,
          });
          renderResponse(payload, targets);
        }
        setActivePhase("completed");
      } catch (error) {
        const errorInfo = errorInfoFromException(error);
        showError(errorEl, errorBannerText(errorInfo));
        renderErrorState(
          rawText,
          rawMeta,
          correctedText,
          correctedStatus,
          correctedMeta,
          correctedCitations,
          auditContainer,
          errorInfo,
        );
        retryButton.hidden = !errorInfo.retryable;
        setActivePhase("failed");
      } finally {
        window.clearTimeout(timeout);
        stopStatusTimer();
        inFlight = false;
        setBusy(sendButton, retryButton, false);
      }
    }

    function setActivePhase(stage) {
      activePhase = stage || activePhase;
      const meta = phaseMeta(activePhase);
      renderPhaseTrack(phaseTrack, activePhase);
      setLiveState(root, statusEl, meta.state, phaseStatusText(activePhase, startedAtMs));
    }

    function startStatusTimer() {
      stopStatusTimer();
      statusTimer = window.setInterval(() => {
        if (activePhase !== "idle") setActivePhase(activePhase);
      }, 1000);
    }

    function stopStatusTimer() {
      if (statusTimer !== null) {
        window.clearInterval(statusTimer);
        statusTimer = null;
      }
    }
  }

  async function requestStreamedChat(options) {
    const endpoint = buildApiUrl(options.apiBase, STREAM_CHAT_PATH);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": STREAM_MEDIA_TYPE,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: options.question }),
      signal: options.signal,
    });

    if ((response.status === 404 || response.status === 405) && !response.ok) {
      return { fallback: true };
    }

    if (!response.ok) {
      const payload = await readJsonSafely(response);
      throw new LiveChatError(errorInfoFromHttp(response.status, payload));
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (!response.body || !contentType.includes(STREAM_MEDIA_TYPE)) {
      return { fallback: true };
    }

    let finalSeen = false;
    await readNdjsonStream(response.body, (event) => {
      const name = String(event && event.event || "");
      const data = event && event.data ? event.data : {};
      if (name === "stage") {
        options.onStage(data.stage);
      } else if (name === "raw_answer" && data.raw_answer) {
        options.onRawAnswer(data.raw_answer);
      } else if (name === "final") {
        finalSeen = true;
        options.onFinal(data);
      } else if (name === "error") {
        throw new LiveChatError(errorInfoFromStreamEvent(data));
      }
    });

    if (!finalSeen) {
      throw new LiveChatError(buildErrorInfo("UPSTREAM_UNAVAILABLE", null, null));
    }
    return { fallback: false };
  }

  async function requestJsonChat(options) {
    const endpoint = buildApiUrl(options.apiBase, JSON_CHAT_PATH);
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Accept": "application/json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question: options.question }),
      signal: options.signal,
    });

    const payload = await readJsonSafely(response);
    if (!response.ok) {
      if (hasDualAnswerPayload(payload)) return payload;
      throw new LiveChatError(errorInfoFromHttp(response.status, payload));
    }
    return payload;
  }

  async function readNdjsonStream(body, onEvent) {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const result = await reader.read();
      if (result.done) break;
      buffer += decoder.decode(result.value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() || "";
      lines.forEach((line) => consumeNdjsonLine(line, onEvent));
    }
    buffer += decoder.decode();
    consumeNdjsonLine(buffer, onEvent);
  }

  function consumeNdjsonLine(line, onEvent) {
    const trimmed = String(line || "").trim();
    if (!trimmed) return;
    let parsed;
    try {
      parsed = JSON.parse(trimmed);
    } catch (_error) {
      throw new LiveChatError(buildErrorInfo("UPSTREAM_UNAVAILABLE", null, null));
    }
    onEvent(parsed);
  }

  function createPhaseTrack() {
    const track = document.createElement("div");
    track.className = "live-phase-track";
    track.setAttribute("aria-label", "Anchor pipeline progress");
    renderPhaseTrack(track, "idle");
    return track;
  }

  function renderPhaseTrack(track, currentStage) {
    replaceChildren(track);
    const currentIndex = phaseIndex(currentStage);
    PHASES.forEach((phase, index) => {
      const chip = document.createElement("span");
      chip.className = `live-phase-chip ${phaseClass(index, currentIndex, currentStage)}`;
      chip.textContent = phase.label;
      track.appendChild(chip);
    });
  }

  function phaseClass(index, currentIndex, currentStage) {
    if (currentStage === "completed") return "phase-done";
    if (currentStage === "failed") return index <= Math.max(0, currentIndex) ? "phase-done" : "phase-pending";
    if (currentIndex < 0) return "phase-pending";
    if (index < currentIndex) return "phase-done";
    if (index === currentIndex) return "phase-active";
    return "phase-pending";
  }

  function phaseIndex(stage) {
    if (stage === "verification_skipped") return PHASES.findIndex((phase) => phase.key === "correction");
    return PHASES.findIndex((phase) => phase.key === stage);
  }

  function phaseStatusText(stage, startedAtMs) {
    const meta = phaseMeta(stage);
    const elapsed = elapsedSeconds(startedAtMs);
    return elapsed === null ? meta.label : `${meta.label} · ${elapsed}s elapsed`;
  }

  function elapsedSeconds(startedAtMs) {
    if (!startedAtMs) return null;
    return Math.max(0, Math.round((Date.now() - startedAtMs) / 1000));
  }

  function appendPendingAudit(container, message) {
    replaceChildren(container);
    appendEmpty(container, message);
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

  function setBusy(sendButton, retryButton, busy) {
    sendButton.disabled = busy;
    retryButton.disabled = busy;
    sendButton.setAttribute("aria-busy", busy ? "true" : "false");
    retryButton.setAttribute("aria-busy", busy ? "true" : "false");
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

  function renderErrorState(
    rawText,
    rawMeta,
    correctedText,
    correctedStatus,
    correctedMeta,
    correctedCitations,
    auditContainer,
    errorInfo,
  ) {
    renderRawFailure(rawText, rawMeta, errorInfo);
    renderCorrectionFailure(correctedText, correctedStatus, correctedMeta, correctedCitations, errorInfo);
    renderErrorAudit(auditContainer, errorInfo);
  }

  function renderRawFailure(rawText, rawMeta, errorInfo) {
    replaceChildren(rawMeta);
    appendPill(rawMeta, "Not Anchor-verified");
    appendPill(rawMeta, "raw_answer: failed");
    appendPill(rawMeta, `error: ${valueOrDash(errorInfo.code)}`);
    setText(rawText, errorInfo.rawText || "Raw Answer is unavailable.");
  }

  function renderCorrectionFailure(correctedText, correctedStatus, correctedMeta, correctedCitations, errorInfo) {
    renderStatus(correctedStatus, "unavailable");
    renderCorrectedSummary(correctedMeta, { citations: [], corrections: [] }, "unavailable");
    setText(correctedText, errorInfo.correctedText || "Anchor correction was not run.");
    renderCorrectedCitations(correctedCitations, []);
  }

  function renderErrorAudit(container, errorInfo) {
    replaceChildren(container);
    appendKeyValueSection(container, "Audit", [
      ["query_id", errorInfo.queryId],
      ["error", errorInfo.code],
      ["http_status", errorInfo.status],
      ["raw_answer_preserved", false],
      ["correction_performed", false],
    ]);
    appendTextListSection(container, "Notes", [errorInfo.message]);
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

  function errorBannerText(errorInfo) {
    const queryPart = errorInfo.queryId ? ` query_id=${errorInfo.queryId}` : "";
    return `${errorInfo.code}: ${errorInfo.message}${queryPart}`;
  }

  function LiveChatError(info) {
    this.name = "LiveChatError";
    this.info = info;
    this.message = info && info.message ? info.message : "Anchor API request failed.";
  }
  LiveChatError.prototype = Object.create(Error.prototype);

  function InvalidApiBaseUrlError() {
    this.name = "InvalidApiBaseUrlError";
    this.message = "Invalid API URL.";
  }
  InvalidApiBaseUrlError.prototype = Object.create(Error.prototype);
})();

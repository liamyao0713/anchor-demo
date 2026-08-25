(function () {
  "use strict";

  const PHASES = [
    { key: "raw_generation", label: "Raw answer" },
    { key: "retrieval", label: "Evidence search" },
    { key: "claim_extraction", label: "Claim extraction" },
    { key: "verification", label: "Claim check" },
    { key: "correction", label: "Correction" },
  ];

  const PHASE_ALIASES = {
    accepted: null,
    raw_answer: "raw_generation",
    raw_generation: "raw_generation",
    retrieval: "retrieval",
    claim_extraction: "claim_extraction",
    verification: "verification",
    verification_skipped: "verification",
    correction: "correction",
  };

  function createInitialState() {
    return {
      status: "idle",
      question: "",
      activePanel: "raw",
      activeAuditTab: "corrections",
      correctedMode: "clean",
      selectedClaimId: null,
      selectedCitationId: null,
      startedAt: null,
      completedAt: null,
      error: null,
      rawAnswer: null,
      response: null,
      viewModel: null,
      stageEvents: [],
      phases: PHASES.map((phase) => ({
        key: phase.key,
        label: phase.label,
        status: "pending",
        observedAt: null,
      })),
    };
  }

  function startRun(previousState, question, startedAt) {
    const state = createInitialState();
    state.status = "running";
    state.question = String(question || "").trim();
    state.startedAt = startedAt || new Date().toISOString();
    state.activePanel = previousState && previousState.activePanel ? previousState.activePanel : "raw";
    return state;
  }

  function recordStage(state, stage, observedAt) {
    const key = PHASE_ALIASES[String(stage || "").toLowerCase()];
    const next = cloneState(state);
    next.stageEvents.push({
      stage: String(stage || "unknown"),
      observedAt: observedAt || new Date().toISOString(),
    });
    if (!key) return next;

    let reached = false;
    next.phases = next.phases.map((phase) => {
      if (phase.key === key) {
        reached = true;
        return Object.assign({}, phase, {
          status: stage === "verification_skipped" ? "skipped" : "running",
          observedAt: observedAt || new Date().toISOString(),
        });
      }
      if (!reached && phase.status === "pending") {
        return Object.assign({}, phase, { status: "completed" });
      }
      return phase;
    });
    return next;
  }

  function receiveRawAnswer(state, rawAnswer) {
    const next = cloneState(state);
    next.rawAnswer = rawAnswer || null;
    next.phases = next.phases.map((phase) => {
      if (phase.key === "raw_generation") {
        return Object.assign({}, phase, { status: "completed", observedAt: phase.observedAt || new Date().toISOString() });
      }
      return phase;
    });
    return next;
  }

  function completeRun(state, payload, viewModel, completedAt) {
    const next = cloneState(state);
    next.status = "completed";
    next.completedAt = completedAt || new Date().toISOString();
    next.response = payload || null;
    next.viewModel = viewModel || null;
    next.rawAnswer = payload && payload.raw_answer ? payload.raw_answer : next.rawAnswer;
    next.error = null;
    next.phases = next.phases.map((phase) => {
      if (phase.status === "pending" || phase.status === "running") {
        return Object.assign({}, phase, { status: "completed" });
      }
      return phase;
    });
    return next;
  }

  function failRun(state, error, completedAt) {
    const next = cloneState(state);
    next.status = "failed";
    next.completedAt = completedAt || new Date().toISOString();
    next.error = error || null;
    let marked = false;
    next.phases = next.phases.map((phase) => {
      if (!marked && (phase.status === "running" || phase.status === "pending")) {
        marked = true;
        return Object.assign({}, phase, { status: "failed" });
      }
      if (!marked) return phase;
      return phase.status === "pending" ? Object.assign({}, phase, { status: "skipped" }) : phase;
    });
    return next;
  }

  function cancelRun(state, completedAt) {
    return failRun(state, { code: "CANCELLED", message: "The request was cancelled.", retryable: true }, completedAt);
  }

  function clearRun() {
    return createInitialState();
  }

  function setActivePanel(state, panel) {
    const next = cloneState(state);
    next.activePanel = panel || "raw";
    return next;
  }

  function setAuditTab(state, tab) {
    const next = cloneState(state);
    next.activeAuditTab = tab || "corrections";
    return next;
  }

  function setCorrectedMode(state, mode) {
    const next = cloneState(state);
    next.correctedMode = mode === "tracked" ? "tracked" : "clean";
    return next;
  }

  function selectClaim(state, claimId) {
    const next = cloneState(state);
    next.selectedClaimId = claimId || null;
    next.activePanel = "audit";
    next.activeAuditTab = "corrections";
    return next;
  }

  function selectCitation(state, citationId) {
    const next = cloneState(state);
    next.selectedCitationId = citationId || null;
    next.activePanel = "audit";
    next.activeAuditTab = "citations";
    return next;
  }

  function cloneState(state) {
    return {
      status: state.status,
      question: state.question,
      activePanel: state.activePanel,
      activeAuditTab: state.activeAuditTab,
      correctedMode: state.correctedMode,
      selectedClaimId: state.selectedClaimId,
      selectedCitationId: state.selectedCitationId,
      startedAt: state.startedAt,
      completedAt: state.completedAt,
      error: state.error,
      rawAnswer: state.rawAnswer,
      response: state.response,
      viewModel: state.viewModel,
      stageEvents: (state.stageEvents || []).slice(),
      phases: (state.phases || []).map((phase) => Object.assign({}, phase)),
    };
  }

  const exported = {
    PHASES,
    createInitialState,
    startRun,
    recordStage,
    receiveRawAnswer,
    completeRun,
    failRun,
    cancelRun,
    clearRun,
    setActivePanel,
    setAuditTab,
    setCorrectedMode,
    selectClaim,
    selectCitation,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
  if (typeof window !== "undefined") {
    window.AnchorWorkspaceState = exported;
  }
})();

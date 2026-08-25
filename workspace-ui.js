(function () {
  "use strict";

  if (typeof window === "undefined" || typeof document === "undefined") return;

  const Api = window.AnchorWorkspaceApi;
  const Adapter = window.AnchorWorkspaceAdapter;
  const State = window.AnchorWorkspaceState;
  const Exporter = window.AnchorWorkspaceExport;
  if (!Api || !Adapter || !State || !Exporter) return;

  const PANEL_KEYS = ["raw", "corrected", "audit"];
  const AUDIT_TABS = ["corrections", "citations", "run-details"];
  const CORRECTION_CATEGORIES = [
    "all",
    "stale evidence",
    "wrong citation",
    "unsupported claim",
    "contradicted claim",
    "numerical error",
    "missing context",
    "excessive certainty",
    "partial support",
    "wording calibration",
    "other",
  ];
  const STATUS_FILTERS = [
    "all",
    "supported",
    "partially_supported",
    "unsupported",
    "conflicting",
    "not_verifiable",
    "not_evaluated",
  ];
  const ABOUT_LANGUAGE_STORAGE_KEY = "ANCHOR_ABOUT_LANGUAGE";
  const ABOUT_LANGUAGES = new Set(["en", "zh"]);

  document.addEventListener("DOMContentLoaded", initWorkspace);

  function initWorkspace() {
    const root = document.getElementById("anchor-workspace");
    if (!root) return;

    const refs = collectRefs(root);
    let state = State.createInitialState();
    let activeController = null;
    let activeTimeout = null;
    let userCancelled = false;
    let lastQuestion = "";
    let apiBase = initialApiBase();
    let connection = { status: "checking", health: null, ready: null, dependencies: {}, error: null };
    let correctionCategory = "all";
    let correctionStatus = "all";
    let correctionSearch = "";
    let citationFilter = "all";
    let citationSearch = "";

    refs.apiBaseInput.value = apiBase;
    initAboutLanguage();
    bindEvents();
    renderAll();
    checkConnection();

    function bindEvents() {
      refs.form.addEventListener("submit", (event) => {
        event.preventDefault();
        submitCurrentQuestion();
      });

      refs.questionInput.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
          event.preventDefault();
          submitCurrentQuestion();
        }
      });

      refs.questionInput.addEventListener("input", renderRunControls);
      refs.clearButton.addEventListener("click", clearCurrentRun);
      refs.copyQuestionButton.addEventListener("click", () => copyValue(refs.questionInput.value, "Question copied."));
      refs.retryButton.addEventListener("click", () => {
        if (lastQuestion) refs.questionInput.value = lastQuestion;
        submitCurrentQuestion();
      });
      refs.cancelButton.addEventListener("click", cancelCurrentRun);

      refs.aboutButton.addEventListener("click", scrollToAbout);
      refs.aboutLangButtons.forEach((button) => {
        button.addEventListener("click", () => setAboutLanguage(button.dataset.aboutLang));
      });
      refs.readGuideCards.forEach((card) => {
        card.addEventListener("click", () => scrollToWorkspacePanel(card.dataset.readPanel));
      });

      refs.settingsButton.addEventListener("click", openSettings);
      refs.settingsCloseButton.addEventListener("click", closeSettings);
      refs.settingsBackdrop.addEventListener("click", closeSettings);
      refs.saveApiButton.addEventListener("click", saveApiBase);
      refs.resetApiButton.addEventListener("click", resetApiBase);
      refs.testConnectionButton.addEventListener("click", checkConnection);

      refs.exportButton.addEventListener("click", () => {
        const expanded = refs.exportMenu.hidden;
        refs.exportMenu.hidden = !expanded;
        refs.exportButton.setAttribute("aria-expanded", expanded ? "true" : "false");
      });
      document.addEventListener("click", (event) => {
        if (!refs.exportWrap.contains(event.target)) {
          refs.exportMenu.hidden = true;
          refs.exportButton.setAttribute("aria-expanded", "false");
        }
      });

      refs.copyRawButton.addEventListener("click", () => copyCurrent("raw"));
      refs.copyCorrectedButton.addEventListener("click", () => copyCurrent("corrected"));
      refs.copyKeyCorrectionsButton.addEventListener("click", () => copyCurrent("keyCorrections"));
      refs.copyQueryIdButton.addEventListener("click", () => copyCurrent("queryId"));
      refs.copyRunDetailsButton.addEventListener("click", () => copyCurrent("runDetails"));
      refs.copyQueryIdPanelButton.addEventListener("click", () => copyCurrent("queryId"));
      refs.copyRunDetailsPanelButton.addEventListener("click", () => copyCurrent("runDetails"));
      refs.exportMarkdownButton.addEventListener("click", exportMarkdown);
      refs.exportJsonButton.addEventListener("click", exportJson);
      refs.downloadAuditJsonButton.addEventListener("click", exportJson);

      refs.correctedModeButtons.forEach((button) => {
        button.addEventListener("click", () => {
          state = State.setCorrectedMode(state, button.dataset.mode);
          renderCorrectedPanel();
        });
      });

      refs.panelTabs.forEach((button) => {
        button.addEventListener("click", () => {
          state = State.setActivePanel(state, button.dataset.panel);
          renderResponsivePanels();
        });
      });

      refs.auditTabs.forEach((button) => {
        button.addEventListener("click", () => {
          state = State.setAuditTab(state, button.dataset.auditTab);
          renderAuditTabs();
        });
      });

      refs.expandAllCorrections.addEventListener("click", () => setCorrectionCardsOpen(true));
      refs.collapseAllCorrections.addEventListener("click", () => setCorrectionCardsOpen(false));
      refs.correctionCategoryFilter.addEventListener("change", () => {
        correctionCategory = refs.correctionCategoryFilter.value;
        renderCorrectionsTab();
      });
      refs.correctionStatusFilter.addEventListener("change", () => {
        correctionStatus = refs.correctionStatusFilter.value;
        renderCorrectionsTab();
      });
      refs.correctionSearch.addEventListener("input", () => {
        correctionSearch = refs.correctionSearch.value.trim().toLowerCase();
        renderCorrectionsTab();
      });
      refs.citationFilter.addEventListener("change", () => {
        citationFilter = refs.citationFilter.value;
        renderCitationsTab();
      });
      refs.citationSearch.addEventListener("input", () => {
        citationSearch = refs.citationSearch.value.trim().toLowerCase();
        renderCitationsTab();
      });
    }

    function initAboutLanguage() {
      setAboutLanguage(initialAboutLanguage(), { persist: false });
    }

    function initialAboutLanguage() {
      const storedLanguage = safeLocalStorageGet(ABOUT_LANGUAGE_STORAGE_KEY);
      if (ABOUT_LANGUAGES.has(storedLanguage)) return storedLanguage;
      const browserLanguage = (window.navigator.languages && window.navigator.languages[0]) ||
        window.navigator.language ||
        "en";
      return String(browserLanguage).toLowerCase().startsWith("zh") ? "zh" : "en";
    }

    function setAboutLanguage(language, options) {
      const nextLanguage = ABOUT_LANGUAGES.has(language) ? language : "en";
      refs.aboutSection.dataset.aboutLanguage = nextLanguage;
      refs.aboutLangButtons.forEach((button) => {
        const isActive = button.dataset.aboutLang === nextLanguage;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      if (!options || options.persist !== false) {
        safeLocalStorageSet(ABOUT_LANGUAGE_STORAGE_KEY, nextLanguage);
      }
    }

    function scrollToAbout() {
      scrollToElement(refs.aboutSection, "start");
    }

    function scrollToWorkspacePanel(panelKey) {
      if (!PANEL_KEYS.includes(panelKey)) return;
      state = State.setActivePanel(state, panelKey);
      renderResponsivePanels();
      const targetPanel = refs.workspacePanels.find((panel) => panel.dataset.panel === panelKey);
      if (targetPanel) {
        scrollToElement(targetPanel, "center");
      }
    }

    function scrollToElement(element, block) {
      const behavior = reducedMotion() ? "auto" : "smooth";
      if (block === "center") {
        element.scrollIntoView({ block: "center", behavior });
        return;
      }
      const headerHeight = refs.productBar.getBoundingClientRect().height;
      const top = element.getBoundingClientRect().top + window.scrollY - headerHeight - 12;
      window.scrollTo({ top: Math.max(0, top), behavior });
    }

    async function submitCurrentQuestion() {
      const question = refs.questionInput.value.trim();
      if (state.status === "running") return;
      if (!question) {
        renderInlineError("Question must not be empty.");
        refs.questionInput.focus();
        return;
      }

      lastQuestion = question;
      clearInlineError();
      userCancelled = false;
      const startedAt = new Date().toISOString();
      const startedMs = Date.now();
      state = State.startRun(state, question, startedAt);
      activeController = new AbortController();
      activeTimeout = window.setTimeout(() => {
        if (activeController) activeController.abort();
      }, Api.REQUEST_TIMEOUT_MS);
      renderAll();

      try {
        const streamed = await Api.requestStreamedChat({
          apiBase,
          question,
          signal: activeController.signal,
          onStage: (stage) => {
            state = State.recordStage(state, stage, new Date().toISOString());
            renderPipeline();
            renderRunControls();
          },
          onRawAnswer: (rawAnswer) => {
            state = State.receiveRawAnswer(state, rawAnswer);
            renderRawPanel();
            renderPipeline();
            renderSummary();
          },
        });
        let payload = streamed.payload;
        if (streamed.fallback) {
          state = State.recordStage(state, "raw_generation", new Date().toISOString());
          renderPipeline();
          payload = await Api.requestJsonChat({
            apiBase,
            question,
            signal: activeController.signal,
          });
        }
        const completedAt = new Date().toISOString();
        const vm = Adapter.normalizeResponse(payload, {
          question,
          startedAt,
          completedAt,
          observedLatencyMs: Date.now() - startedMs,
          stageEvents: state.stageEvents,
        });
        state = State.completeRun(state, payload, vm, completedAt);
        renderAll();
        showToast("Verification completed.");
      } catch (error) {
        const info = userCancelled ? Api.buildErrorInfo("CANCELLED", null, null) : Api.errorInfoFromException(error);
        state = userCancelled ? State.cancelRun(state, new Date().toISOString()) : State.failRun(state, info, new Date().toISOString());
        renderAll();
        renderInlineError(info.message);
      } finally {
        if (activeTimeout) window.clearTimeout(activeTimeout);
        activeTimeout = null;
        activeController = null;
        userCancelled = false;
      }
    }

    function cancelCurrentRun() {
      if (!activeController) return;
      userCancelled = true;
      activeController.abort();
    }

    function clearCurrentRun() {
      if (activeController) {
        userCancelled = true;
        activeController.abort();
      }
      refs.questionInput.value = "";
      lastQuestion = "";
      state = State.clearRun();
      clearInlineError();
      renderAll();
      refs.questionInput.focus();
    }

    async function checkConnection() {
      const testBase = refs.apiBaseInput.value || apiBase;
      connection = { status: "checking", health: null, ready: null, dependencies: {}, error: null };
      renderConnection();
      const controller = new AbortController();
      const timeout = window.setTimeout(() => controller.abort(), 15000);
      try {
        connection = await Api.testConnection({ apiBase: testBase, signal: controller.signal });
      } finally {
        window.clearTimeout(timeout);
        renderConnection();
        renderSettingsStatus();
      }
    }

    function openSettings() {
      refs.apiBaseInput.value = apiBase;
      refs.settingsPanel.hidden = false;
      refs.settingsPanel.setAttribute("aria-hidden", "false");
      refs.apiBaseInput.focus();
      renderSettingsStatus();
    }

    function closeSettings() {
      refs.settingsPanel.hidden = true;
      refs.settingsPanel.setAttribute("aria-hidden", "true");
      refs.settingsButton.focus();
    }

    function saveApiBase() {
      let normalized;
      try {
        normalized = Api.normalizeApiBase(refs.apiBaseInput.value);
        Api.buildApiUrl(normalized, Api.HEALTH_PATH);
      } catch (_error) {
        renderSettingsMessage("API Base URL must be a valid http or https URL.", "error");
        return;
      }
      apiBase = normalized;
      safeLocalStorageSet(Api.API_STORAGE_KEY, apiBase);
      refs.apiBaseInput.value = apiBase;
      state = State.clearRun();
      renderAll();
      renderSettingsMessage("API Base URL saved. Existing run results were cleared.", "ok");
      checkConnection();
    }

    function resetApiBase() {
      apiBase = Api.DEFAULT_API_BASE_URL;
      refs.apiBaseInput.value = apiBase;
      safeLocalStorageSet(Api.API_STORAGE_KEY, apiBase);
      state = State.clearRun();
      renderAll();
      renderSettingsMessage("Default API Base URL restored.", "ok");
      checkConnection();
    }

    function renderAll() {
      root.dataset.runState = state.status;
      renderConnection();
      renderQuestionHeader();
      renderRunControls();
      renderPipeline();
      renderSummary();
      renderFrameworkChecks();
      renderClinicalImpact();
      renderKeyCorrections();
      renderRawPanel();
      renderCorrectedPanel();
      renderAuditTabs();
      renderResponsivePanels();
    }

    function renderConnection() {
      const label = connectionLabel(connection.status);
      refs.connectionBadge.className = `aw-connection aw-connection-${connection.status}`;
      refs.connectionBadge.textContent = label;
      refs.apiHost.textContent = Api.apiHostLabel(apiBase);
    }

    function renderQuestionHeader() {
      const vm = state.viewModel;
      refs.taskTitle.textContent = vm ? vm.query.title : "Live evidence verification";
      refs.topicTag.textContent = vm ? "Current run" : "Ready";
      refs.modelTag.textContent = vm ? `${vm.provider} / ${vm.model}` : "Server-configured model";
    }

    function renderRunControls() {
      const question = refs.questionInput.value.trim();
      const running = state.status === "running";
      refs.runButton.disabled = running || !question;
      refs.runButton.textContent = running ? "Running verification..." : "Run verification";
      refs.cancelButton.hidden = !running;
      refs.retryButton.hidden = running || !lastQuestion || state.status !== "failed";
      refs.copyQuestionButton.disabled = !question;
      refs.clearButton.disabled = running ? false : !question && !state.viewModel && !state.rawAnswer;
      refs.exportMarkdownButton.disabled = !state.viewModel;
      refs.exportJsonButton.disabled = !state.viewModel;
      refs.downloadAuditJsonButton.disabled = !state.viewModel;
      refs.copyKeyCorrectionsButton.disabled = !state.viewModel;
      refs.copyQueryIdButton.disabled = !state.viewModel;
      refs.copyRunDetailsButton.disabled = !state.viewModel;
      refs.copyQueryIdPanelButton.disabled = !state.viewModel;
      refs.copyRunDetailsPanelButton.disabled = !state.viewModel;
      refs.statusText.textContent = statusText();
    }

    function renderPipeline() {
      replaceChildren(refs.pipeline);
      state.phases.forEach((phase) => {
        const item = create("li", { className: `aw-stage aw-stage-${phase.status}` });
        item.append(
          create("span", { className: "aw-stage-icon", text: phaseIcon(phase.status), ariaHidden: "true" }),
          create("span", { className: "aw-stage-label", text: phase.label }),
          create("span", { className: "aw-stage-state", text: phase.status }),
        );
        refs.pipeline.appendChild(item);
      });
    }

    function renderSummary() {
      const vm = state.viewModel;
      const raw = state.rawAnswer;
      refs.summaryGrid.replaceChildren(
        metric("Evidence status", vm ? vm.evidenceStatus : "-"),
        metric("Confidence", vm && vm.confidence !== null ? vm.confidence : "-"),
        metric("Citations", vm ? vm.metrics.citationCount : "-"),
        metric("Total claims", vm ? vm.metrics.totalClaims : "-"),
        metric("Supported claims", vm ? vm.metrics.supportedClaims : "-"),
        metric("Corrected claims", vm ? vm.metrics.correctedClaims : "-"),
        metric("Unsupported claims", vm ? vm.metrics.unsupportedClaims : "-"),
        metric("Total latency", vm ? Adapter.formatLatency(vm.latency.totalMs || vm.latency.observedMs) : "-"),
      );
      refs.modelTag.textContent = vm
        ? `${vm.provider} / ${vm.model}`
        : raw
          ? `${Adapter.valueOrDash(raw.provider)} / ${Adapter.valueOrDash(raw.model)}`
          : "Server-configured model";
    }

    function renderFrameworkChecks() {
      const vm = state.viewModel;
      const checks = vm && Array.isArray(vm.frameworkChecks) ? vm.frameworkChecks : [];
      replaceChildren(refs.frameworkChecks);
      if (!checks.length) {
        refs.frameworkChecks.appendChild(create("p", {
          className: "aw-empty-inline",
          text: "No structured framework checks were returned by the API.",
        }));
        return;
      }
      checks.forEach((check) => {
        const button = create("button", {
          className: `aw-check-chip aw-check-${check.status.toLowerCase().replace(/\s+/g, "-")}`,
          type: "button",
          text: `${check.label}: ${check.status}`,
        });
        button.addEventListener("click", () => {
          if (check.correctionId || check.claimId) focusCorrection(check.correctionId, check.claimId);
        });
        refs.frameworkChecks.appendChild(button);
      });
    }

    function renderClinicalImpact() {
      const vm = state.viewModel;
      refs.clinicalImpact.hidden = true;
      replaceChildren(refs.clinicalImpact);
      if (!vm || !Array.isArray(vm.clinicalImpacts) || !vm.clinicalImpacts.length) return;
      refs.clinicalImpact.hidden = false;
      vm.clinicalImpacts.forEach((impact) => {
        refs.clinicalImpact.appendChild(create("p", { text: String(impact) }));
      });
    }

    function renderKeyCorrections() {
      const vm = state.viewModel;
      replaceChildren(refs.keyCorrections);
      const title = create("div", { className: "aw-section-title-row" });
      title.append(
        create("h2", { className: "aw-section-title", text: "Key corrections" }),
        create("button", {
          className: "aw-ghost-button",
          type: "button",
          text: "Copy key corrections",
          onClick: () => copyCurrent("keyCorrections"),
        }),
      );
      refs.keyCorrections.appendChild(title);

      if (!vm) {
        refs.keyCorrections.appendChild(create("p", { className: "aw-empty-inline", text: "Run a question to see material corrections." }));
        return;
      }
      if (!vm.keyCorrections.length) {
        refs.keyCorrections.appendChild(create("p", { className: "aw-empty-inline", text: "No material correction was required." }));
        return;
      }
      const list = create("div", { className: "aw-key-list" });
      vm.keyCorrections.forEach((item) => {
        const button = create("button", {
          className: `aw-key-card aw-severity-${item.severity}`,
          type: "button",
        });
        button.append(
          create("span", { className: "aw-key-type", text: item.category }),
          create("span", { className: "aw-key-summary", text: item.summary }),
          create("span", { className: "aw-key-meta", text: `${item.severity} severity | ${item.claimId || "-"}` }),
        );
        button.addEventListener("click", () => focusCorrection(item.id, item.claimId));
        list.appendChild(button);
      });
      refs.keyCorrections.appendChild(list);
    }

    function renderRawPanel() {
      const vm = state.viewModel;
      const raw = vm ? vm.rawAnswer : normalizeRawDuringStream(state.rawAnswer);
      replaceChildren(refs.rawMeta);
      refs.rawProvider.textContent = raw.provider || "-";
      refs.rawModel.textContent = raw.model || "-";
      refs.rawVerification.textContent = raw.verificationStatus || "uncorrected";
      refs.copyRawButton.disabled = !(vm || state.rawAnswer);
      const markers = vm ? rawMarkers(vm) : [];
      const matched = renderMarkdown(refs.rawText, raw.text || "Raw answer has not been generated.", {
        markers,
        onClaim: focusByClaimOnly,
        citations: vm ? vm.citations : [],
        onCitation: focusCitation,
      });
      renderFlaggedClaims(vm, matched);
    }

    function renderFlaggedClaims(vm, matched) {
      replaceChildren(refs.flaggedClaims);
      if (!vm) return;
      const flagged = vm.claims.filter((claim) => claim.verificationStatus !== "supported");
      const unmatched = flagged.filter((claim) => !matched.has(claim.id));
      if (!unmatched.length) return;
      refs.flaggedClaims.appendChild(create("h3", { className: "aw-mini-heading", text: "Flagged claims" }));
      unmatched.forEach((claim) => {
        const button = create("button", {
          className: `aw-flagged-claim aw-status-${safeClass(claim.verificationStatus)}`,
          type: "button",
          text: `${claim.id} | ${claim.verificationStatus}: ${claim.text}`,
        });
        button.addEventListener("click", () => focusByClaimOnly(claim.id));
        refs.flaggedClaims.appendChild(button);
      });
    }

    function renderCorrectedPanel() {
      const vm = state.viewModel;
      refs.correctedEvidence.textContent = vm ? vm.evidenceStatus : "-";
      refs.correctedConfidence.textContent = vm && vm.confidence !== null ? String(vm.confidence) : "-";
      refs.copyCorrectedButton.disabled = !vm;
      refs.correctedModeButtons.forEach((button) => {
        const active = button.dataset.mode === state.correctedMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const text = vm ? vm.correctedAnswer.text : "Anchor-corrected answer will appear after the run finishes.";
      const markers = vm && state.correctedMode === "tracked" ? correctedMarkers(vm) : [];
      renderMarkdown(refs.correctedText, text, {
        markers,
        onClaim: focusByClaimOnly,
        citations: vm ? vm.citations : [],
        onCitation: focusCitation,
      });
      renderCorrectedReferences(vm);
    }

    function renderCorrectedReferences(vm) {
      replaceChildren(refs.correctedReferences);
      const summary = create("summary", { text: `Corrected-version references (${vm ? vm.citations.length : 0})` });
      refs.correctedReferences.appendChild(summary);
      if (!vm || !vm.citations.length) {
        refs.correctedReferences.appendChild(create("p", { className: "aw-empty-inline", text: "No Anchor citations returned." }));
        return;
      }
      const list = create("ol", { className: "aw-reference-list" });
      vm.citations.forEach((citation) => {
        const item = create("li");
        appendText(item, `${citation.id}: ${citation.title} | ${citation.source || citation.journal} | `);
        if (citation.href) {
          const link = safeLink(citation.href, citation.pmid ? `PMID ${citation.pmid}` : citation.doi ? `DOI ${citation.doi}` : "Source");
          item.appendChild(link);
        } else {
          appendText(item, "No external link");
        }
        list.appendChild(item);
      });
      refs.correctedReferences.appendChild(list);
    }

    function renderAuditTabs() {
      refs.auditTabs.forEach((button) => {
        const active = button.dataset.auditTab === state.activeAuditTab;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      refs.auditPanels.forEach((panel) => {
        panel.hidden = panel.dataset.auditPanel !== state.activeAuditTab;
      });
      renderCorrectionsTab();
      renderCitationsTab();
      renderRunDetailsTab();
    }

    function renderCorrectionsTab() {
      const vm = state.viewModel;
      replaceChildren(refs.correctionsSummary);
      replaceChildren(refs.correctionsList);
      populateSelect(refs.correctionCategoryFilter, CORRECTION_CATEGORIES, correctionCategory);
      populateSelect(refs.correctionStatusFilter, STATUS_FILTERS, correctionStatus);
      refs.correctionSearch.value = correctionSearch;

      if (!vm) {
        refs.correctionsSummary.appendChild(create("p", { className: "aw-empty-inline", text: "No run yet." }));
        refs.correctionsList.appendChild(emptyBlock("No correction records were returned for this run."));
        return;
      }

      refs.correctionsSummary.append(
        smallStat("Supported", vm.metrics.supportedClaims),
        smallStat("Corrected", vm.metrics.correctedClaims),
        smallStat("Unsupported", vm.metrics.unsupportedClaims),
      );

      const corrections = filteredCorrections(vm.corrections);
      if (!corrections.length) {
        refs.correctionsList.appendChild(emptyBlock("No correction records match the current filters."));
        return;
      }

      corrections.forEach((correction) => {
        const details = create("details", {
          className: `aw-correction-card aw-severity-${correction.severity}`,
          dataCorrectionId: correction.id,
          dataClaimId: correction.claimId,
        });
        details.open = correction.material || vm.corrections.length <= 3;
        const summary = create("summary", { className: "aw-correction-summary" });
        summary.append(
          create("span", { className: "aw-category-chip", text: correction.category }),
          create("span", { className: `aw-severity-chip aw-severity-${correction.severity}`, text: correction.severity }),
          create("span", { className: "aw-correction-title", text: `${correction.claimId || "-"} | ${correction.verificationStatus}` }),
        );
        details.appendChild(summary);
        details.append(
          correctionRow("Model said", correction.originalClaim),
          correctionRow("Verified", correction.correctedClaim || correction.originalClaim || "-"),
          correctionRow("Why", correction.reason),
          correctionRow("Supporting evidence", correction.supportingEvidenceIds.join(", ") || "-"),
          correctionRow("Citation links", correction.citationIds.join(", ") || "-"),
          correctionRow("Verification status", correction.verificationStatus),
        );
        details.addEventListener("toggle", () => {
          if (details.open) highlightLinked(correction.claimId, correction.id);
        });
        details.addEventListener("click", (event) => {
          if (event.target.tagName !== "SUMMARY") highlightLinked(correction.claimId, correction.id);
        });
        refs.correctionsList.appendChild(details);
      });
    }

    function renderCitationsTab() {
      const vm = state.viewModel;
      replaceChildren(refs.citationsList);
      refs.citationFilter.value = citationFilter;
      refs.citationSearch.value = citationSearch;
      if (!vm) {
        refs.citationsList.appendChild(emptyBlock("No citation records were returned for this run."));
        return;
      }
      const citations = filteredCitations(vm.citations);
      if (!citations.length) {
        refs.citationsList.appendChild(emptyBlock("No citation records match the current filters."));
        return;
      }
      citations.forEach((citation) => {
        const card = create("article", {
          className: `aw-citation-card aw-citation-${safeClass(citation.verificationStatus)}`,
          dataCitationId: citation.id,
        });
        const head = create("div", { className: "aw-citation-head" });
        head.append(
          create("strong", { text: citation.id }),
          create("span", { className: "aw-citation-status", text: citation.verificationStatus }),
        );
        card.appendChild(head);
        card.append(
          citationRow("Evidence ID", citation.evidenceId),
          citationRow("Title", citation.title),
          citationRow("Source", citation.source || citation.journal),
          citationRow("Authors", citation.authors),
          citationRow("Year", citation.year),
          citationRow("PMID", citation.pmid || "-"),
          citationRow("DOI", citation.doi || "-"),
          citationRow("Used by corrections", citation.usedByCorrectionIds.join(", ") || "-"),
          citationRow("Issue", citation.issue),
        );
        if (citation.href) {
          const link = safeLink(citation.href, citation.pmid ? `Open PMID ${citation.pmid}` : citation.doi ? "Open DOI" : "Open source");
          link.className = "aw-link-button";
          card.appendChild(link);
        }
        card.addEventListener("click", () => highlightCitation(citation.id));
        refs.citationsList.appendChild(card);
      });
    }

    function renderRunDetailsTab() {
      const vm = state.viewModel;
      replaceChildren(refs.runDetails);
      if (!vm) {
        refs.runDetails.appendChild(emptyBlock("Run details will appear after a response is returned."));
        return;
      }
      const details = vm.runDetails;
      refs.runDetails.append(
        keyValueGrid([
          ["Query ID", vm.queryId],
          ["Start time", details.startTime],
          ["End time", details.endTime],
          ["Total latency", Adapter.formatLatency(vm.latency.totalMs || vm.latency.observedMs)],
          ["Provider", details.provider],
          ["Model", details.model],
          ["Evidence status", details.evidenceStatus],
          ["Confidence / calibration", vm.confidence === null ? "-" : vm.confidence],
          ["Correction performed", details.correctionPerformed],
          ["Raw answer preserved", details.rawAnswerPreserved],
          ["Retrieved evidence count", details.retrievedEvidenceCount],
          ["Usable evidence count", details.usableEvidenceCount],
        ]),
        stageEventList(details.stageEvents),
        notesBlock("Warnings / notes", details.warnings),
      );
      if (isDebugMode()) {
        const rawDetails = create("details", { className: "aw-debug-details" });
        rawDetails.append(
          create("summary", { text: "View raw response" }),
          create("pre", { text: JSON.stringify(vm.rawPayload, null, 2) }),
        );
        refs.runDetails.appendChild(rawDetails);
      }
    }

    function renderResponsivePanels() {
      refs.panelTabs.forEach((button) => {
        const active = button.dataset.panel === state.activePanel;
        button.classList.toggle("active", active);
        button.setAttribute("aria-selected", active ? "true" : "false");
      });
      refs.workspacePanels.forEach((panel) => {
        panel.classList.toggle("aw-mobile-active", panel.dataset.panel === state.activePanel);
      });
    }

    function renderSettingsStatus() {
      replaceChildren(refs.settingsStatus);
      refs.settingsStatus.appendChild(create("p", {
        className: `aw-settings-state aw-settings-${connection.status}`,
        text: `Connection: ${connectionLabel(connection.status)}`,
      }));
      if (connection.error) {
        refs.settingsStatus.appendChild(create("p", { className: "aw-error-text", text: connection.error.message }));
      }
      const deps = connection.dependencies || {};
      const list = create("div", { className: "aw-dependency-grid" });
      ["database", "retrieval", "llm", "configuration"].forEach((key) => {
        list.appendChild(create("span", { className: "aw-dependency-chip", text: `${key}: ${deps[key] || "-"}` }));
      });
      refs.settingsStatus.appendChild(list);
    }

    function renderSettingsMessage(message, type) {
      refs.settingsMessage.className = `aw-settings-message aw-settings-message-${type || "ok"}`;
      refs.settingsMessage.textContent = message;
      refs.settingsMessage.hidden = false;
    }

    function renderInlineError(message) {
      refs.errorBox.hidden = false;
      refs.errorBox.textContent = message || "The request failed.";
    }

    function clearInlineError() {
      refs.errorBox.hidden = true;
      refs.errorBox.textContent = "";
    }

    function statusText() {
      if (state.status === "idle") return "Idle";
      if (state.status === "running") return "Server processing. Results will update as real stream events arrive.";
      if (state.status === "completed") return "Completed";
      if (state.status === "failed" && state.error) return `${state.error.code || "FAILED"}: ${state.error.message || "Request failed"}`;
      return state.status;
    }

    function copyCurrent(kind) {
      const vm = state.viewModel;
      if (kind === "raw") return copyValue(vm && vm.rawAnswer ? vm.rawAnswer.text : "", "Raw answer copied.");
      if (kind === "corrected") return copyValue(vm && vm.correctedAnswer ? vm.correctedAnswer.text : "", "Corrected answer copied.");
      if (kind === "queryId") return copyValue(vm ? vm.queryId : "", "Query ID copied.");
      if (kind === "runDetails") return copyValue(vm ? JSON.stringify(Exporter.buildAuditJson(vm).run_details, null, 2) : "", "Run details copied.");
      if (kind === "keyCorrections") {
        const text = vm && vm.keyCorrections.length
          ? vm.keyCorrections.map((item) => `${item.category} (${item.severity}): ${item.summary} [${item.claimId || "-"}]`).join("\n")
          : "No material correction was required.";
        return copyValue(text, "Key corrections copied.");
      }
      return Promise.resolve(false);
    }

    async function copyValue(value, successMessage) {
      const text = String(value || "").trim();
      if (!text) {
        showToast("Nothing to copy.");
        return false;
      }
      let ok = false;
      try {
        ok = await Exporter.copyText(text);
      } catch (_error) {
        ok = false;
      }
      showToast(ok ? successMessage : "Copy is unavailable in this browser.");
      return ok;
    }

    function exportMarkdown() {
      const vm = state.viewModel;
      if (!vm) {
        showToast("Run a question before exporting.");
        return;
      }
      const text = Exporter.buildMarkdownReport(vm);
      const filename = Exporter.makeReportFilename(vm, "md");
      Exporter.downloadText(filename, text, "text/markdown;charset=utf-8");
      showToast("Markdown report exported.");
    }

    function exportJson() {
      const vm = state.viewModel;
      if (!vm) {
        showToast("Run a question before exporting.");
        return;
      }
      const text = JSON.stringify(Exporter.buildAuditJson(vm), null, 2);
      const filename = Exporter.makeReportFilename(vm, "json");
      Exporter.downloadText(filename, text, "application/json;charset=utf-8");
      showToast("Audit JSON exported.");
    }

    function focusCorrection(correctionId, claimId) {
      state = State.setActivePanel(state, "audit");
      state = State.setAuditTab(state, "corrections");
      state = State.selectClaim(state, claimId || null);
      renderResponsivePanels();
      renderAuditTabs();
      const selector = correctionId
        ? `[data-correction-id="${cssEscape(correctionId)}"]`
        : `[data-claim-id="${cssEscape(claimId)}"]`;
      const card = refs.correctionsList.querySelector(selector);
      if (card) {
        card.open = true;
        card.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
        card.classList.add("aw-focus-pulse");
        window.setTimeout(() => card.classList.remove("aw-focus-pulse"), 1200);
      }
      highlightLinked(claimId, correctionId);
    }

    function focusByClaimOnly(claimId) {
      const vm = state.viewModel;
      const correction = vm && vm.corrections.find((item) => item.claimId === claimId);
      focusCorrection(correction && correction.id, claimId);
    }

    function focusCitation(citationId) {
      state = State.selectCitation(state, citationId);
      renderResponsivePanels();
      renderAuditTabs();
      highlightCitation(citationId);
    }

    function highlightLinked(claimId, correctionId) {
      root.querySelectorAll(".aw-is-linked").forEach((node) => node.classList.remove("aw-is-linked"));
      if (claimId) {
        root.querySelectorAll(`[data-claim-id="${cssEscape(claimId)}"]`).forEach((node) => node.classList.add("aw-is-linked"));
      }
      if (correctionId) {
        root.querySelectorAll(`[data-correction-id="${cssEscape(correctionId)}"]`).forEach((node) => node.classList.add("aw-is-linked"));
      }
    }

    function highlightCitation(citationId) {
      root.querySelectorAll(".aw-is-linked").forEach((node) => node.classList.remove("aw-is-linked"));
      root.querySelectorAll(`[data-citation-id="${cssEscape(citationId)}"]`).forEach((node) => node.classList.add("aw-is-linked"));
      const card = refs.citationsList.querySelector(`[data-citation-id="${cssEscape(citationId)}"]`);
      if (card) {
        card.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      }
    }

    function setCorrectionCardsOpen(open) {
      refs.correctionsList.querySelectorAll("details").forEach((details) => {
        details.open = open;
      });
    }

    function filteredCorrections(corrections) {
      return corrections.filter((correction) => {
        if (correctionCategory !== "all" && correction.category !== correctionCategory) return false;
        if (correctionStatus !== "all" && correction.verificationStatus !== correctionStatus) return false;
        if (correctionSearch) {
          const haystack = [
            correction.id,
            correction.claimId,
            correction.category,
            correction.originalClaim,
            correction.correctedClaim,
            correction.reason,
            correction.verificationStatus,
          ].join(" ").toLowerCase();
          if (!haystack.includes(correctionSearch)) return false;
        }
        return true;
      });
    }

    function filteredCitations(citations) {
      return citations.filter((citation) => {
        if (citationFilter === "problematic" && citation.verificationStatus === "verified") return false;
        if (citationFilter === "corrected" && !citation.usedInCorrectedAnswer) return false;
        if (citationSearch) {
          const haystack = [
            citation.id,
            citation.evidenceId,
            citation.pmid,
            citation.doi,
            citation.title,
            citation.source,
            citation.usedByCorrectionIds.join(" "),
          ].join(" ").toLowerCase();
          if (!haystack.includes(citationSearch)) return false;
        }
        return true;
      });
    }

    function showToast(message) {
      refs.toast.textContent = message;
      refs.toast.hidden = false;
      window.clearTimeout(refs.toastTimer);
      refs.toastTimer = window.setTimeout(() => {
        refs.toast.hidden = true;
      }, 2200);
    }

    function initialApiBase() {
      const queryBase = new URLSearchParams(window.location.search).get("api");
      const globalBase = window.ANCHOR_API_BASE_URL;
      const storedBase = safeLocalStorageGet(Api.API_STORAGE_KEY);
      return Api.normalizeApiBase(queryBase || globalBase || storedBase || Api.DEFAULT_API_BASE_URL);
    }
  }

  function collectRefs(root) {
    return {
      form: required(root, "#aw-question-form"),
      questionInput: required(root, "#aw-question"),
      runButton: required(root, "#aw-run"),
      clearButton: required(root, "#aw-clear"),
      copyQuestionButton: required(root, "#aw-copy-question"),
      retryButton: required(root, "#aw-retry"),
      cancelButton: required(root, "#aw-cancel"),
      statusText: required(root, "#aw-status-text"),
      errorBox: required(root, "#aw-error"),
      taskTitle: required(root, "#aw-task-title"),
      topicTag: required(root, "#aw-topic-tag"),
      modelTag: required(root, "#aw-model-tag"),
      productBar: required(root, ".aw-product-bar"),
      connectionBadge: required(root, "#aw-connection"),
      apiHost: required(root, "#aw-api-host"),
      settingsButton: required(root, "#aw-settings-button"),
      settingsPanel: required(root, "#aw-settings-panel"),
      settingsBackdrop: required(root, "#aw-settings-backdrop"),
      settingsCloseButton: required(root, "#aw-settings-close"),
      apiBaseInput: required(root, "#aw-api-base"),
      saveApiButton: required(root, "#aw-save-api"),
      resetApiButton: required(root, "#aw-reset-api"),
      testConnectionButton: required(root, "#aw-test-connection"),
      settingsStatus: required(root, "#aw-settings-status"),
      settingsMessage: required(root, "#aw-settings-message"),
      exportWrap: required(root, "#aw-export-wrap"),
      exportButton: required(root, "#aw-export-button"),
      exportMenu: required(root, "#aw-export-menu"),
      exportMarkdownButton: required(root, "#aw-export-markdown"),
      exportJsonButton: required(root, "#aw-export-json"),
      copyKeyCorrectionsButton: required(root, "#aw-copy-key-corrections"),
      copyQueryIdButton: required(root, "#aw-copy-query-id"),
      copyRunDetailsButton: required(root, "#aw-copy-run-details"),
      copyQueryIdPanelButton: required(root, "#aw-copy-query-id-panel"),
      copyRunDetailsPanelButton: required(root, "#aw-copy-run-details-panel"),
      downloadAuditJsonButton: required(root, "#aw-download-audit-json"),
      pipeline: required(root, "#aw-pipeline"),
      summaryGrid: required(root, "#aw-summary-grid"),
      frameworkChecks: required(root, "#aw-framework-checks"),
      clinicalImpact: required(root, "#aw-clinical-impact"),
      keyCorrections: required(root, "#aw-key-corrections"),
      aboutButton: required(root, "#aw-about-button"),
      aboutSection: required(root, "#aw-about"),
      aboutLangButtons: Array.from(root.querySelectorAll(".aw-lang-button")),
      readGuideCards: Array.from(root.querySelectorAll(".aw-read-card")),
      panelTabs: Array.from(root.querySelectorAll(".aw-panel-tab")),
      workspacePanels: Array.from(root.querySelectorAll(".aw-workspace-panel")),
      rawMeta: required(root, "#aw-raw-meta"),
      rawProvider: required(root, "#aw-raw-provider"),
      rawModel: required(root, "#aw-raw-model"),
      rawVerification: required(root, "#aw-raw-verification"),
      rawText: required(root, "#aw-raw-text"),
      flaggedClaims: required(root, "#aw-flagged-claims"),
      copyRawButton: required(root, "#aw-copy-raw"),
      correctedEvidence: required(root, "#aw-corrected-evidence"),
      correctedConfidence: required(root, "#aw-corrected-confidence"),
      correctedText: required(root, "#aw-corrected-text"),
      correctedReferences: required(root, "#aw-corrected-references"),
      correctedModeButtons: Array.from(root.querySelectorAll(".aw-mode-button")),
      copyCorrectedButton: required(root, "#aw-copy-corrected"),
      auditTabs: Array.from(root.querySelectorAll(".aw-audit-tab")),
      auditPanels: Array.from(root.querySelectorAll(".aw-audit-panel")),
      correctionsSummary: required(root, "#aw-corrections-summary"),
      correctionsList: required(root, "#aw-corrections-list"),
      expandAllCorrections: required(root, "#aw-expand-corrections"),
      collapseAllCorrections: required(root, "#aw-collapse-corrections"),
      correctionCategoryFilter: required(root, "#aw-correction-category-filter"),
      correctionStatusFilter: required(root, "#aw-correction-status-filter"),
      correctionSearch: required(root, "#aw-correction-search"),
      citationFilter: required(root, "#aw-citation-filter"),
      citationSearch: required(root, "#aw-citation-search"),
      citationsList: required(root, "#aw-citations-list"),
      runDetails: required(root, "#aw-run-details"),
      toast: required(root, "#aw-toast"),
      toastTimer: null,
    };
  }

  function renderMarkdown(container, sourceText, options) {
    replaceChildren(container);
    const text = String(sourceText || "");
    const matched = new Set();
    const lines = text.replace(/\r\n/g, "\n").split("\n");
    let index = 0;
    while (index < lines.length) {
      const line = lines[index];
      if (!line.trim()) {
        index += 1;
        continue;
      }
      if (isTableStart(lines, index)) {
        const tableLines = [];
        while (index < lines.length && lines[index].includes("|")) {
          tableLines.push(lines[index]);
          index += 1;
        }
        container.appendChild(renderTable(tableLines, options, matched));
        continue;
      }
      const heading = line.match(/^(#{1,4})\s+(.+)$/);
      if (heading) {
        const level = Math.min(4, heading[1].length + 1);
        const node = create(`h${level}`, { className: "aw-md-heading" });
        appendInline(node, heading[2], options, matched);
        container.appendChild(node);
        index += 1;
        continue;
      }
      if (/^\s*[-*]\s+/.test(line) || /^\s*\d+[.)]\s+/.test(line)) {
        const list = create(/^\s*\d+[.)]\s+/.test(line) ? "ol" : "ul", { className: "aw-md-list" });
        while (index < lines.length && (/^\s*[-*]\s+/.test(lines[index]) || /^\s*\d+[.)]\s+/.test(lines[index]))) {
          const item = create("li");
          appendInline(item, lines[index].replace(/^\s*(?:[-*]|\d+[.)])\s+/, ""), options, matched);
          list.appendChild(item);
          index += 1;
        }
        container.appendChild(list);
        continue;
      }
      if (/^\s*>/.test(line)) {
        const quote = create("blockquote", { className: "aw-md-quote" });
        appendInline(quote, line.replace(/^\s*>\s?/, ""), options, matched);
        container.appendChild(quote);
        index += 1;
        continue;
      }
      const paragraphLines = [];
      while (
        index < lines.length &&
        lines[index].trim() &&
        !/^(#{1,4})\s+/.test(lines[index]) &&
        !/^\s*[-*]\s+/.test(lines[index]) &&
        !/^\s*\d+[.)]\s+/.test(lines[index]) &&
        !/^\s*>/.test(lines[index]) &&
        !isTableStart(lines, index)
      ) {
        paragraphLines.push(lines[index]);
        index += 1;
      }
      const paragraph = create("p", { className: "aw-md-p" });
      appendInline(paragraph, paragraphLines.join(" "), options, matched);
      container.appendChild(paragraph);
    }
    if (!container.childNodes.length) {
      container.appendChild(create("p", { className: "aw-empty-inline", text: "No text returned." }));
    }
    return matched;
  }

  function appendInline(parent, text, options, matched) {
    const markers = Array.isArray(options && options.markers) ? options.markers : [];
    const citations = Array.isArray(options && options.citations) ? options.citations : [];
    const citationMatches = citationLabels(citations);
    let cursor = 0;
    const source = String(text || "");
    while (cursor < source.length) {
      const next = nextInlineMatch(source, cursor, markers, citationMatches);
      if (!next) {
        appendBoldText(parent, source.slice(cursor));
        break;
      }
      if (next.index > cursor) appendBoldText(parent, source.slice(cursor, next.index));
      if (next.type === "marker") {
        const button = create("button", {
          className: `aw-claim-marker aw-status-${safeClass(next.marker.status)}`,
          type: "button",
          text: next.text,
          title: `${next.marker.id} | ${next.marker.status} | ${next.marker.category || "other"} | ${next.marker.reason || ""}`,
          dataClaimId: next.marker.id,
        });
        button.addEventListener("click", () => options.onClaim(next.marker.id));
        parent.appendChild(button);
        matched.add(next.marker.id);
      } else {
        const button = create("button", {
          className: "aw-citation-marker",
          type: "button",
          text: next.text,
          dataCitationId: next.citationId,
          title: `Open ${next.citationId} in citations`,
        });
        button.addEventListener("click", () => options.onCitation(next.citationId));
        parent.appendChild(button);
      }
      cursor = next.index + next.text.length;
    }
  }

  function citationLabels(citations) {
    const labels = [];
    citations.forEach((citation, index) => {
      const citationId = String(citation.id || "");
      if (!citationId) return;
      const candidates = new Set([`[${citationId}]`]);
      const trailingNumber = citationId.match(/(\d+)$/);
      if (trailingNumber) candidates.add(`[${trailingNumber[1]}]`);
      candidates.add(`[${index + 1}]`);
      candidates.forEach((label) => labels.push({ label, citationId }));
    });
    return labels.sort((a, b) => b.label.length - a.label.length);
  }

  function nextInlineMatch(source, cursor, markers, citationMatches) {
    let best = null;
    markers.forEach((marker) => {
      const needle = String(marker.needle || "");
      if (needle.length < 8) return;
      const index = source.indexOf(needle, cursor);
      if (index === -1) return;
      if (!best || index < best.index || (index === best.index && needle.length > best.text.length)) {
        best = { type: "marker", index, text: needle, marker };
      }
    });
    citationMatches.forEach((candidate) => {
      const index = source.indexOf(candidate.label, cursor);
      if (index === -1) return;
      if (!best || index < best.index || (index === best.index && candidate.label.length > best.text.length)) {
        best = { type: "citation", index, text: candidate.label, citationId: candidate.citationId };
      }
    });
    return best;
  }

  function appendBoldText(parent, text) {
    const parts = String(text || "").split(/(\*\*[^*]+\*\*|__[^_]+__)/g);
    parts.forEach((part) => {
      if (!part) return;
      const bold = part.match(/^(?:\*\*([^*]+)\*\*|__([^_]+)__)$/);
      if (bold) {
        parent.appendChild(create("strong", { text: bold[1] || bold[2] }));
      } else {
        appendText(parent, part);
      }
    });
  }

  function renderTable(lines, options, matched) {
    const wrap = create("div", { className: "aw-table-wrap" });
    const table = create("table", { className: "aw-md-table" });
    lines.forEach((line, index) => {
      if (/^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line)) return;
      const row = create("tr");
      line.replace(/^\||\|$/g, "").split("|").forEach((cell) => {
        const node = create(index === 0 ? "th" : "td");
        appendInline(node, cell.trim(), options, matched);
        row.appendChild(node);
      });
      table.appendChild(row);
    });
    wrap.appendChild(table);
    return wrap;
  }

  function isTableStart(lines, index) {
    return Boolean(lines[index] && lines[index].includes("|") && lines[index + 1] && /^\s*\|?\s*:?-{3,}:?/.test(lines[index + 1]));
  }

  function rawMarkers(vm) {
    const correctionByClaim = new Map(vm.corrections.map((correction) => [correction.claimId, correction]));
    return vm.claims
      .filter((claim) => claim.verificationStatus !== "supported")
      .map((claim) => {
        const correction = correctionByClaim.get(claim.id);
        return {
          id: claim.id,
          needle: claim.text,
          status: claim.verificationStatus,
          category: correction ? correction.category : "other",
          reason: correction ? correction.reason : "",
        };
      });
  }

  function correctedMarkers(vm) {
    return vm.corrections
      .filter((correction) => correction.material)
      .map((correction) => ({
        id: correction.claimId,
        needle: correction.correctedClaim || correction.originalClaim,
        status: correction.verificationStatus,
        category: correction.category,
        reason: correction.reason,
      }));
  }

  function normalizeRawDuringStream(raw) {
    return {
      text: raw && raw.text ? raw.text : "Raw answer has not been generated.",
      provider: raw && raw.provider ? raw.provider : "-",
      model: raw && raw.model ? raw.model : "-",
      verificationStatus: raw && raw.verification_status ? raw.verification_status : "uncorrected",
    };
  }

  function metric(label, value) {
    const item = create("div", { className: "aw-metric" });
    item.append(create("span", { text: label }), create("strong", { text: value === null || value === undefined ? "-" : String(value) }));
    return item;
  }

  function smallStat(label, value) {
    const item = create("span", { className: "aw-small-stat" });
    item.append(create("span", { text: label }), create("strong", { text: String(value) }));
    return item;
  }

  function correctionRow(label, value) {
    const row = create("div", { className: "aw-correction-row" });
    row.append(create("span", { text: label }), create("p", { text: value || "-" }));
    return row;
  }

  function citationRow(label, value) {
    const row = create("div", { className: "aw-citation-row" });
    row.append(create("span", { text: label }), create("p", { text: value || "-" }));
    return row;
  }

  function keyValueGrid(rows) {
    const grid = create("dl", { className: "aw-run-grid" });
    rows.forEach(([key, value]) => {
      grid.append(create("dt", { text: key }), create("dd", { text: value === null || value === undefined || value === "" ? "-" : String(value) }));
    });
    return grid;
  }

  function stageEventList(events) {
    const details = create("details", { className: "aw-run-notes" });
    details.appendChild(create("summary", { text: "Observed stage events" }));
    if (!Array.isArray(events) || !events.length) {
      details.appendChild(create("p", { className: "aw-empty-inline", text: "No streaming stage events were observed." }));
      return details;
    }
    const list = create("ol");
    events.forEach((event) => {
      list.appendChild(create("li", { text: `${event.stage} | ${event.observedAt}` }));
    });
    details.appendChild(list);
    return details;
  }

  function notesBlock(title, notes) {
    const details = create("details", { className: "aw-run-notes" });
    details.appendChild(create("summary", { text: title }));
    if (!Array.isArray(notes) || !notes.length) {
      details.appendChild(create("p", { className: "aw-empty-inline", text: "None returned." }));
      return details;
    }
    const list = create("ul");
    notes.forEach((note) => list.appendChild(create("li", { text: note })));
    details.appendChild(list);
    return details;
  }

  function emptyBlock(message) {
    const block = create("div", { className: "aw-empty-block" });
    block.appendChild(create("p", { text: message }));
    return block;
  }

  function safeLink(href, text) {
    const link = create("a", { text });
    link.href = href;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function populateSelect(select, values, selected) {
    if (select.options.length === values.length) return;
    replaceChildren(select);
    values.forEach((value) => {
      const option = create("option", { text: value });
      option.value = value;
      option.selected = value === selected;
      select.appendChild(option);
    });
  }

  function phaseIcon(status) {
    if (status === "completed") return "OK";
    if (status === "running") return "...";
    if (status === "failed") return "!";
    if (status === "skipped") return "--";
    return "P";
  }

  function connectionLabel(status) {
    if (status === "connected") return "Connected";
    if (status === "degraded") return "Degraded";
    if (status === "disconnected") return "Disconnected";
    return "Checking";
  }

  function safeClass(value) {
    return String(value || "unknown").toLowerCase().replace(/[^a-z0-9_-]+/g, "-");
  }

  function cssEscape(value) {
    if (window.CSS && window.CSS.escape) return window.CSS.escape(String(value || ""));
    return String(value || "").replace(/["\\]/g, "\\$&");
  }

  function isDebugMode() {
    return new URLSearchParams(window.location.search).get("debug") === "1" ||
      window.location.hostname === "127.0.0.1" ||
      window.location.hostname === "localhost";
  }

  function reducedMotion() {
    return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
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

  function required(root, selector) {
    const element = root.querySelector(selector);
    if (!element) throw new Error(`Missing required workspace element: ${selector}`);
    return element;
  }

  function create(tagName, options) {
    const element = document.createElement(tagName);
    const opts = options || {};
    if (opts.className) element.className = opts.className;
    if (opts.text !== undefined) element.textContent = String(opts.text);
    if (opts.type) element.type = opts.type;
    if (opts.title) element.title = opts.title;
    if (opts.ariaHidden) element.setAttribute("aria-hidden", opts.ariaHidden);
    if (opts.dataClaimId) element.dataset.claimId = opts.dataClaimId;
    if (opts.dataCorrectionId) element.dataset.correctionId = opts.dataCorrectionId;
    if (opts.dataCitationId) element.dataset.citationId = opts.dataCitationId;
    if (typeof opts.onClick === "function") element.addEventListener("click", opts.onClick);
    return element;
  }

  function appendText(parent, text) {
    parent.appendChild(document.createTextNode(String(text || "")));
  }

  function replaceChildren(element) {
    while (element.firstChild) element.removeChild(element.firstChild);
  }

  window.AnchorWorkspaceUi = {
    renderMarkdown,
  };
})();

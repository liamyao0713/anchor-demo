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
    "not verifiable",
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
  const UI_LANGUAGE_STORAGE_KEY = "ANCHOR_UI_LANGUAGE";
  const LEGACY_ABOUT_LANGUAGE_STORAGE_KEY = "ANCHOR_ABOUT_LANGUAGE";
  const UI_LANGUAGES = new Set(["en", "zh"]);
  let currentUiLanguage = "en";

  const UI_TEXT = {
    en: {
      documentTitle: "AnchorAI | Evidence Verification Workspace",
      pageName: "Evidence Verification Workspace",
      brandSubtitle: "Evidence-grounded answer correction and audit",
      languageToggle: "Page language",
      aboutButton: "About AnchorAI",
      aboutEyebrow: "About AnchorAI",
      workspaceGuideEyebrow: "Workspace guide",
      whyEyebrow: "Why Anchor matters",
      moatsEyebrow: "The 3 Anchor moats",
      settings: "Settings",
      export: "Export",
      exportMarkdown: "Export Markdown report",
      exportJson: "Export audit JSON",
      copyKeyCorrections: "Copy key corrections",
      copyQueryId: "Copy query ID",
      copyRunDetails: "Copy run details",
      taskTitleIdle: "Live evidence verification",
      ready: "Ready",
      currentRun: "Current run",
      serverConfiguredModel: "Server-configured model",
      scopeNote: "Anchor KB currently focuses on respiratory medicine; out-of-scope questions keep the uncorrected answer and are marked as insufficient evidence when Anchor cannot verify them.",
      medicalQuestion: "Medical question",
      questionPlaceholder: "Enter a medical question for Anchor verification",
      runVerification: "Run verification",
      runningVerification: "Running verification...",
      cancel: "Cancel",
      retry: "Retry",
      clear: "Clear",
      copyQuestion: "Copy question",
      verificationMethod: "Verification method",
      methodPipeline: "Pipeline: Raw answer, evidence search, claim extraction, claim check, correction.",
      methodScope: "KB scope: respiratory medicine, based on server-side Anchor KB readiness.",
      methodSchema: "Schema: AnchorChatResponse fields returned by the API; no private system prompt is exposed.",
      summaryAria: "Verification status and summary",
      pipelineAria: "Pipeline stages",
      frameworkAria: "Framework checks",
      clinicalImpactAria: "Clinical impact warning",
      keyCorrections: "Key corrections",
      workbenchAria: "Evidence verification workspace",
      workspacePanelsAria: "Workspace panels",
      panelTabRaw: "A Raw",
      panelTabCorrected: "B Corrected",
      panelTabAudit: "C Audit",
      rawTitle: "Uncorrected answer",
      correctedTitle: "Anchor-corrected answer",
      auditTitle: "Audit / Differences / Citations",
      auditSubtitle: "Correction records, references and run details",
      copyRawAnswer: "Copy raw answer",
      copyCorrectedAnswer: "Copy corrected answer",
      kbGrounded: "KB-grounded",
      confidenceLower: "confidence",
      correctedModeAria: "Corrected answer display mode",
      clean: "Clean answer",
      tracked: "Show changes",
      downloadAuditJson: "Download audit JSON",
      auditTabsAria: "Audit tabs",
      corrections: "Corrections",
      citations: "Citations",
      runDetails: "Run details",
      categoryFilterAria: "Filter corrections by category",
      statusFilterAria: "Filter corrections by status",
      correctionSearchAria: "Search corrections",
      correctionSearchPlaceholder: "Search claim ID or text",
      citationFilterAria: "Filter citations",
      citationSearchAria: "Search citations",
      citationSearchPlaceholder: "Search PMID, DOI, title or claim ID",
      selectAll: "all",
      problematicOnly: "problematic only",
      usedByCorrection: "used by correction",
      "option.all": "all",
      "option.stale_evidence": "stale evidence",
      "option.wrong_citation": "wrong citation",
      "option.unsupported_claim": "unsupported claim",
      "option.not_verifiable": "not verifiable",
      "option.contradicted_claim": "contradicted claim",
      "option.numerical_error": "numerical error",
      "option.missing_context": "missing context",
      "option.excessive_certainty": "excessive certainty",
      "option.partial_support": "partial support",
      "option.wording_calibration": "wording calibration",
      "option.other": "other",
      "option.supported": "supported",
      "option.partially_supported": "partially_supported",
      "option.unsupported": "unsupported",
      "option.conflicting": "conflicting",
      "option.not_verifiable": "not_verifiable",
      "option.not_evaluated": "not_evaluated",
      "verification.supported": "supported",
      "verification.partially_supported": "partially_supported",
      "verification.unsupported": "unsupported",
      "verification.conflicting": "conflicting",
      "verification.not_verifiable": "not_verifiable",
      "verification.not_evaluated": "not_evaluated",
      "verification.verified": "verified",
      "verification.partial": "partial",
      "verification.wrong_paper": "wrong paper",
      "verification.unavailable": "unavailable",
      "verification.unverified": "unverified",
      "verification.uncorrected": "uncorrected",
      "evidence.sufficient": "sufficient",
      "evidence.partial": "partial",
      "evidence.insufficient": "insufficient",
      "evidence.unavailable": "unavailable",
      "severity.high": "high",
      "severity.medium": "medium",
      "severity.low": "low",
      "severity.info": "info",
      "dependency.database": "database",
      "dependency.retrieval": "retrieval",
      "dependency.llm": "LLM",
      "dependency.configuration": "configuration",
      "dependency_status.ok": "ok",
      "dependency_status.configured": "configured",
      "dependency_status.ready": "ready",
      "dependency_status.error": "error",
      "dependency_status.unavailable": "unavailable",
      "framework_status.passed": "Passed",
      "framework_status.warning": "Warning",
      "framework_status.failed": "Failed",
      "framework_status.not_evaluated": "Not evaluated",
      keyMeta: "{severity} severity | {claimId}",
      markerRetained: "retained",
      markerQualified: "qualified",
      markerRemoved: "not supported",
      markerConflicting: "conflicting",
      markerNotVerifiable: "not verifiable",
      markerOther: "changed",
      previousClaim: "Previous claim",
      nextClaim: "Next claim",
      claimPosition: "Claim {index} of {total}",
      noClaimSelected: "No claim selected",
      claimNavAria: "Claim navigation",
      citationIncompleteIssue: "Citation metadata is incomplete in the API response.",
      boolTrue: "true",
      boolFalse: "false",
      expandAll: "Expand all",
      collapseAll: "Collapse all",
      closeSettings: "Close settings",
      apiBaseUrl: "API Base URL",
      save: "Save",
      restoreDefault: "Restore default",
      testConnection: "Test connection",
      readRawTitle: "Uncorrected answer",
      readCorrectedTitle: "Anchor-corrected answer",
      readAuditTitle: "Audit / Differences / Citations",
      evidenceRisk: "Evidence risk",
      clinicalConsequence: "Clinical consequence",
      verifiableCorrection: "Verifiable correction",
      structuredEvidenceKb: "Structured evidence KB",
      visibleCorrectionLayer: "Visible correction layer",
      auditableTrace: "Auditable trace",
      noFrameworkChecks: "No structured framework checks were returned by the API.",
      noRunCorrections: "No run yet.",
      noCorrectionReturned: "No correction records were returned for this run.",
      noCorrectionMatches: "No correction records match the current filters.",
      noCitationReturned: "No citation records were returned for this run.",
      noCitationMatches: "No citation records match the current filters.",
      noRunDetails: "Run details will appear after a response is returned.",
      noRawAnswer: "Raw answer has not been generated.",
      correctedPending: "Anchor-corrected answer will appear after the run finishes.",
      noTextReturned: "No text returned.",
      flaggedClaims: "Flagged claims",
      correctedReferences: "Corrected-version references ({count})",
      noAnchorCitations: "No Anchor citations returned.",
      noExternalLink: "No external link",
      observedStageEvents: "Observed stage events",
      noStageEvents: "No streaming stage events were observed.",
      noneReturned: "None returned.",
      connectionPrefix: "Connection: {status}",
      questionRequired: "Question must not be empty.",
      requestFailed: "The request failed.",
      idle: "Idle",
      serverProcessing: "Server processing. Results will update as real stream events arrive.",
      completed: "Completed",
      failedFallback: "Request failed",
      verificationCompleted: "Verification completed.",
      apiInvalid: "API Base URL must be a valid http or https URL.",
      apiSaved: "API Base URL saved. Existing run results were cleared.",
      apiDefaultRestored: "Default API Base URL restored.",
      questionCopied: "Question copied.",
      rawCopied: "Raw answer copied.",
      correctedCopied: "Corrected answer copied.",
      queryIdCopied: "Query ID copied.",
      runDetailsCopied: "Run details copied.",
      keyCorrectionsCopied: "Key corrections copied.",
      nothingToCopy: "Nothing to copy.",
      copyUnavailable: "Copy is unavailable in this browser.",
      runBeforeExport: "Run a question before exporting.",
      markdownExported: "Markdown report exported.",
      auditJsonExported: "Audit JSON exported.",
      noMaterialCorrection: "No material correction was required.",
      runForCorrections: "Run a question to see material corrections.",
      materialCorrectionFallback: "No material correction was required.",
      stageRaw: "Raw answer",
      stageRetrieval: "Evidence search",
      stageExtraction: "Claim extraction",
      stageVerification: "Claim check",
      stageCorrection: "Correction",
      statusPending: "Pending",
      statusRunning: "Running",
      statusCompleted: "Completed",
      statusFailed: "Failed",
      statusSkipped: "Skipped",
      connectionConnected: "Connected",
      connectionDegraded: "Degraded",
      connectionDisconnected: "Disconnected",
      connectionChecking: "Checking",
      metricEvidenceStatus: "Evidence status",
      metricConfidence: "Confidence",
      metricCitations: "Citations",
      metricTotalClaims: "Total claims",
      metricSupportedClaims: "Supported claims",
      metricCorrectedClaims: "Corrected claims",
      metricUnsupportedClaims: "Unsupported claims",
      metricNotVerifiableClaims: "Not verifiable",
      metricTotalLatency: "Total latency",
      statSupported: "Supported",
      statCorrected: "Corrected",
      statUnsupported: "Unsupported",
      correctionModelSaid: "Original claim",
      correctionVerified: "Verification result",
      correctionWhy: "Reason",
      correctionSupportedPortion: "Supported portion",
      correctionUnsupportedPortion: "Unsupported portion",
      correctionCorrectedWording: "Corrected wording",
      correctionNoSubClause: "The backend did not return sub-clause verification for this claim.",
      correctionNothingVerified: "No part of this claim could be verified from the available Anchor evidence.",
      correctionNumbersNotVerified: "The exact numerical values could not be verified from the available Anchor evidence.",
      correctionPartialNumbers: "The available evidence supports the qualitative conclusion, but does not verify the exact effect sizes or p-value stated by the model.",
      correctionPartialGeneric: "The available evidence supports part of this claim. Anchor did not receive a sub-clause breakdown, so the supported part is not nominated here.",
      correctionEvidence: "Supporting evidence",
      correctionCitations: "Citation links",
      correctionStatus: "Verification status",
      citationEvidenceId: "Evidence ID",
      citationTitle: "Title",
      citationSource: "Source",
      citationAuthors: "Authors",
      citationYear: "Year",
      citationPmid: "PMID",
      citationDoi: "DOI",
      citationUsedBy: "Used by corrections",
      citationIssue: "Issue",
      openPmid: "Open PMID {pmid}",
      openDoi: "Open DOI",
      openSource: "Open source",
      runQueryId: "Query ID",
      runStartTime: "Start time",
      runEndTime: "End time",
      runTotalLatency: "Total latency",
      runProvider: "Provider",
      runModel: "Model",
      runEvidenceStatus: "Evidence status",
      runConfidence: "Confidence / calibration",
      runCorrectionPerformed: "Correction performed",
      runRawPreserved: "Raw answer preserved",
      runRetrievedEvidence: "Retrieved evidence count",
      runUsableEvidence: "Usable evidence count",
      warningsNotes: "Warnings / notes",
      viewRawResponse: "View raw response",
    },
    zh: {
      documentTitle: "AnchorAI | 证据核验工作台",
      pageName: "证据核验工作台",
      brandSubtitle: "基于证据的回答校正与审计",
      languageToggle: "页面语言",
      aboutButton: "关于 AnchorAI",
      aboutEyebrow: "关于 AnchorAI",
      workspaceGuideEyebrow: "工作台指南",
      whyEyebrow: "为什么 Anchor 重要",
      moatsEyebrow: "Anchor 的 3 大差异化",
      settings: "设置",
      export: "导出",
      exportMarkdown: "导出 Markdown 报告",
      exportJson: "导出审计 JSON",
      copyKeyCorrections: "复制关键校正",
      copyQueryId: "复制 Query ID",
      copyRunDetails: "复制运行详情",
      taskTitleIdle: "实时证据核验",
      ready: "就绪",
      currentRun: "当前运行",
      serverConfiguredModel: "服务端配置模型",
      scopeNote: "Anchor KB 当前主要覆盖呼吸医学；超出范围的问题会保留未校正回答，并在 Anchor 无法核验时标记为证据不足。",
      medicalQuestion: "医学问题",
      questionPlaceholder: "输入需要 Anchor 核验的医学问题",
      runVerification: "运行核验",
      runningVerification: "正在核验...",
      cancel: "取消",
      retry: "重试",
      clear: "清空",
      copyQuestion: "复制问题",
      verificationMethod: "核验方法",
      methodPipeline: "流程：原始回答、证据检索、claim 抽取、claim 核验、校正。",
      methodScope: "知识库范围：呼吸医学，基于服务端 Anchor KB ready 状态。",
      methodSchema: "响应结构：API 返回的 AnchorChatResponse 字段；前端不暴露私有 system prompt。",
      summaryAria: "核验状态与摘要",
      pipelineAria: "流程阶段",
      frameworkAria: "框架检查",
      clinicalImpactAria: "临床影响警示",
      keyCorrections: "关键校正",
      workbenchAria: "证据核验工作台",
      workspacePanelsAria: "工作台面板",
      panelTabRaw: "A 原始",
      panelTabCorrected: "B 校正",
      panelTabAudit: "C 审计",
      rawTitle: "未校正回答",
      correctedTitle: "Anchor 校正回答",
      auditTitle: "审计 / 差异 / 引用",
      auditSubtitle: "校正记录、参考文献和运行详情",
      copyRawAnswer: "复制原始回答",
      copyCorrectedAnswer: "复制校正回答",
      kbGrounded: "KB 接地",
      confidenceLower: "置信度",
      correctedModeAria: "校正回答显示模式",
      clean: "干净版本",
      tracked: "显示修改",
      downloadAuditJson: "下载审计 JSON",
      auditTabsAria: "审计标签",
      corrections: "校正",
      citations: "引用",
      runDetails: "运行详情",
      categoryFilterAria: "按类别筛选校正",
      statusFilterAria: "按状态筛选校正",
      correctionSearchAria: "搜索校正",
      correctionSearchPlaceholder: "搜索 claim ID 或文本",
      citationFilterAria: "筛选引用",
      citationSearchAria: "搜索引用",
      citationSearchPlaceholder: "搜索 PMID、DOI、标题或 claim ID",
      selectAll: "全部",
      problematicOnly: "只看有问题",
      usedByCorrection: "校正版使用",
      "option.all": "全部",
      "option.stale_evidence": "过时证据",
      "option.wrong_citation": "错误引用",
      "option.unsupported_claim": "无证据支持 claim",
      "option.not_verifiable": "无法核验",
      "option.contradicted_claim": "被证据反驳 claim",
      "option.numerical_error": "数值错误",
      "option.missing_context": "缺少上下文",
      "option.excessive_certainty": "过度确定",
      "option.partial_support": "部分支持",
      "option.wording_calibration": "措辞校准",
      "option.other": "其他",
      "option.supported": "已支持",
      "option.partially_supported": "部分支持",
      "option.unsupported": "不支持",
      "option.conflicting": "冲突",
      "option.not_verifiable": "无法核验",
      "option.not_evaluated": "未评估",
      "verification.supported": "已支持",
      "verification.partially_supported": "部分支持",
      "verification.unsupported": "不支持",
      "verification.conflicting": "冲突",
      "verification.not_verifiable": "无法核验",
      "verification.not_evaluated": "未评估",
      "verification.verified": "已核验",
      "verification.partial": "部分核验",
      "verification.wrong_paper": "文献不匹配",
      "verification.unavailable": "不可用",
      "verification.unverified": "未核验",
      "verification.uncorrected": "未校正",
      "evidence.sufficient": "证据充分",
      "evidence.partial": "部分证据",
      "evidence.insufficient": "证据不足",
      "evidence.unavailable": "证据不可用",
      "severity.high": "高",
      "severity.medium": "中",
      "severity.low": "低",
      "severity.info": "信息",
      "dependency.database": "数据库",
      "dependency.retrieval": "检索",
      "dependency.llm": "LLM",
      "dependency.configuration": "配置",
      "dependency_status.ok": "正常",
      "dependency_status.configured": "已配置",
      "dependency_status.ready": "就绪",
      "dependency_status.error": "错误",
      "dependency_status.unavailable": "不可用",
      "framework_status.passed": "通过",
      "framework_status.warning": "警告",
      "framework_status.failed": "失败",
      "framework_status.not_evaluated": "未评估",
      keyMeta: "{severity}严重程度 | {claimId}",
      markerRetained: "保留",
      markerQualified: "已弱化",
      markerRemoved: "不被支持",
      markerConflicting: "证据冲突",
      markerNotVerifiable: "无法核验",
      markerOther: "已修改",
      previousClaim: "上一条 claim",
      nextClaim: "下一条 claim",
      claimPosition: "第 {index} 条 / 共 {total} 条",
      noClaimSelected: "未选中 claim",
      claimNavAria: "Claim 导航",
      citationIncompleteIssue: "API 响应中的 citation 元数据不完整。",
      boolTrue: "是",
      boolFalse: "否",
      expandAll: "全部展开",
      collapseAll: "全部折叠",
      closeSettings: "关闭设置",
      apiBaseUrl: "API Base URL",
      save: "保存",
      restoreDefault: "恢复默认",
      testConnection: "测试连接",
      readRawTitle: "未校正回答",
      readCorrectedTitle: "Anchor 校正回答",
      readAuditTitle: "审计 / 差异 / 引用",
      evidenceRisk: "证据风险",
      clinicalConsequence: "临床影响",
      verifiableCorrection: "可核验校正",
      structuredEvidenceKb: "结构化证据知识库",
      visibleCorrectionLayer: "可视化校正层",
      auditableTrace: "可审计追溯",
      noFrameworkChecks: "API 未返回结构化框架检查。",
      noRunCorrections: "尚未运行。",
      noCorrectionReturned: "本次运行未返回校正记录。",
      noCorrectionMatches: "没有校正记录匹配当前筛选条件。",
      noCitationReturned: "本次运行未返回引用记录。",
      noCitationMatches: "没有引用记录匹配当前筛选条件。",
      noRunDetails: "响应返回后会显示运行详情。",
      noRawAnswer: "尚未生成原始回答。",
      correctedPending: "运行完成后会显示 Anchor 校正回答。",
      noTextReturned: "未返回文本。",
      flaggedClaims: "标记的 claims",
      correctedReferences: "校正版参考文献（{count}）",
      noAnchorCitations: "未返回 Anchor citation。",
      noExternalLink: "无外部链接",
      observedStageEvents: "观察到的阶段事件",
      noStageEvents: "未观察到 streaming 阶段事件。",
      noneReturned: "未返回。",
      connectionPrefix: "连接：{status}",
      questionRequired: "问题不能为空。",
      requestFailed: "请求失败。",
      idle: "空闲",
      serverProcessing: "服务端处理中。结果会随真实 stream 事件更新。",
      completed: "已完成",
      failedFallback: "请求失败",
      verificationCompleted: "核验完成。",
      apiInvalid: "API Base URL 必须是有效的 http 或 https URL。",
      apiSaved: "API Base URL 已保存，已有运行结果已清理。",
      apiDefaultRestored: "已恢复默认 API Base URL。",
      questionCopied: "问题已复制。",
      rawCopied: "原始回答已复制。",
      correctedCopied: "校正回答已复制。",
      queryIdCopied: "Query ID 已复制。",
      runDetailsCopied: "运行详情已复制。",
      keyCorrectionsCopied: "关键校正已复制。",
      nothingToCopy: "没有可复制内容。",
      copyUnavailable: "当前浏览器不可用复制功能。",
      runBeforeExport: "请先运行一个问题再导出。",
      markdownExported: "Markdown 报告已导出。",
      auditJsonExported: "审计 JSON 已导出。",
      noMaterialCorrection: "无需实质性校正。",
      runForCorrections: "运行问题后查看实质性校正。",
      materialCorrectionFallback: "无需实质性校正。",
      stageRaw: "原始回答",
      stageRetrieval: "证据检索",
      stageExtraction: "Claim 抽取",
      stageVerification: "Claim 核验",
      stageCorrection: "校正",
      statusPending: "待处理",
      statusRunning: "运行中",
      statusCompleted: "已完成",
      statusFailed: "失败",
      statusSkipped: "已跳过",
      connectionConnected: "已连接",
      connectionDegraded: "部分可用",
      connectionDisconnected: "未连接",
      connectionChecking: "检查中",
      metricEvidenceStatus: "证据状态",
      metricConfidence: "置信度",
      metricCitations: "引用数",
      metricTotalClaims: "Claim 总数",
      metricSupportedClaims: "已支持 claims",
      metricCorrectedClaims: "已校正 claims",
      metricUnsupportedClaims: "不支持 claims",
      metricNotVerifiableClaims: "无法核验",
      metricTotalLatency: "总耗时",
      statSupported: "已支持",
      statCorrected: "已校正",
      statUnsupported: "不支持",
      correctionModelSaid: "原始 claim",
      correctionVerified: "核验结论",
      correctionWhy: "原因",
      correctionSupportedPortion: "被支持的部分",
      correctionUnsupportedPortion: "不被支持的部分",
      correctionCorrectedWording: "校正后表述",
      correctionNoSubClause: "后端未提供该 claim 的子句级验证结果。",
      correctionNothingVerified: "该表述没有任何部分能被 Anchor 现有证据核验。",
      correctionNumbersNotVerified: "Anchor 现有证据无法核验其中的具体数值。",
      correctionPartialNumbers: "现有证据支持其定性结论，但不能核验模型给出的具体效应量或 P 值。",
      correctionPartialGeneric: "现有证据支持该表述的一部分。后端未返回子句级拆分，因此此处不指认具体是哪一部分。",
      correctionEvidence: "支持证据",
      correctionCitations: "Citation 链接",
      correctionStatus: "核验状态",
      citationEvidenceId: "Evidence ID",
      citationTitle: "标题",
      citationSource: "来源",
      citationAuthors: "作者",
      citationYear: "年份",
      citationPmid: "PMID",
      citationDoi: "DOI",
      citationUsedBy: "用于哪些校正",
      citationIssue: "问题说明",
      openPmid: "打开 PMID {pmid}",
      openDoi: "打开 DOI",
      openSource: "打开来源",
      runQueryId: "Query ID",
      runStartTime: "开始时间",
      runEndTime: "结束时间",
      runTotalLatency: "总耗时",
      runProvider: "Provider",
      runModel: "模型",
      runEvidenceStatus: "证据状态",
      runConfidence: "置信度 / 校准",
      runCorrectionPerformed: "是否执行校正",
      runRawPreserved: "是否保留原始回答",
      runRetrievedEvidence: "检索证据数",
      runUsableEvidence: "可用证据数",
      warningsNotes: "警告 / 备注",
      viewRawResponse: "查看原始响应",
    },
  };

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
    initUiLanguage();
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
      refs.copyQuestionButton.addEventListener("click", () => copyValue(refs.questionInput.value, t("questionCopied")));
      refs.retryButton.addEventListener("click", () => {
        if (lastQuestion) refs.questionInput.value = lastQuestion;
        submitCurrentQuestion();
      });
      refs.cancelButton.addEventListener("click", cancelCurrentRun);

      refs.aboutButton.addEventListener("click", scrollToAbout);
      refs.langButtons.forEach((button) => {
        button.addEventListener("click", () => setUiLanguage(button.dataset.uiLang));
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
      refs.prevClaimButton.addEventListener("click", () => stepClaim(-1));
      refs.nextClaimButton.addEventListener("click", () => stepClaim(1));

      // Keyboard walking of the claim list. Alt is required so the shortcut cannot
      // steal plain arrow keys from the textarea, the selects or the scroll panels.
      root.addEventListener("keydown", (event) => {
        if (!event.altKey || event.ctrlKey || event.metaKey) return;
        if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
          event.preventDefault();
          stepClaim(-1);
        } else if (event.key === "ArrowRight" || event.key === "ArrowDown") {
          event.preventDefault();
          stepClaim(1);
        }
      });
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

    function initUiLanguage() {
      setUiLanguage(initialUiLanguage(), { persist: false, render: false });
    }

    function initialUiLanguage() {
      const storedLanguage = safeLocalStorageGet(UI_LANGUAGE_STORAGE_KEY) ||
        safeLocalStorageGet(LEGACY_ABOUT_LANGUAGE_STORAGE_KEY);
      if (UI_LANGUAGES.has(storedLanguage)) return storedLanguage;
      const browserLanguage = (window.navigator.languages && window.navigator.languages[0]) ||
        window.navigator.language ||
        "en";
      return String(browserLanguage).toLowerCase().startsWith("zh") ? "zh" : "en";
    }

    function setUiLanguage(language, options) {
      const nextLanguage = UI_LANGUAGES.has(language) ? language : "en";
      currentUiLanguage = nextLanguage;
      root.dataset.uiLanguage = nextLanguage;
      document.documentElement.lang = nextLanguage === "zh" ? "zh-CN" : "en";
      document.title = t("documentTitle");
      refs.langButtons.forEach((button) => {
        const isActive = button.dataset.uiLang === nextLanguage;
        button.classList.toggle("active", isActive);
        button.setAttribute("aria-pressed", isActive ? "true" : "false");
      });
      applyStaticTranslations();
      if (!options || options.persist !== false) {
        safeLocalStorageSet(UI_LANGUAGE_STORAGE_KEY, nextLanguage);
      }
      if (!options || options.render !== false) renderAll();
    }

    function applyStaticTranslations() {
      root.querySelectorAll("[data-i18n]").forEach((element) => {
        element.textContent = t(element.dataset.i18n);
      });
      root.querySelectorAll("[data-i18n-placeholder]").forEach((element) => {
        element.setAttribute("placeholder", t(element.dataset.i18nPlaceholder));
      });
      root.querySelectorAll("[data-i18n-aria-label]").forEach((element) => {
        element.setAttribute("aria-label", t(element.dataset.i18nAriaLabel));
      });
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
        renderInlineError(t("questionRequired"));
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
        showToast(t("verificationCompleted"));
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
        renderSettingsMessage(t("apiInvalid"), "error");
        return;
      }
      apiBase = normalized;
      safeLocalStorageSet(Api.API_STORAGE_KEY, apiBase);
      refs.apiBaseInput.value = apiBase;
      state = State.clearRun();
      renderAll();
      renderSettingsMessage(t("apiSaved"), "ok");
      checkConnection();
    }

    function resetApiBase() {
      apiBase = Api.DEFAULT_API_BASE_URL;
      refs.apiBaseInput.value = apiBase;
      safeLocalStorageSet(Api.API_STORAGE_KEY, apiBase);
      state = State.clearRun();
      renderAll();
      renderSettingsMessage(t("apiDefaultRestored"), "ok");
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
      // Re-apply after every render: the panels rebuild their nodes, so the selected
      // claim would otherwise lose its marking and the position readout would go stale.
      applyClaimSelection();
    }

    function renderConnection() {
      const label = connectionLabel(connection.status);
      refs.connectionBadge.className = `aw-connection aw-connection-${connection.status}`;
      refs.connectionBadge.textContent = label;
      refs.apiHost.textContent = Api.apiHostLabel(apiBase);
    }

    function renderQuestionHeader() {
      const vm = state.viewModel;
      refs.taskTitle.textContent = vm ? vm.query.title : t("taskTitleIdle");
      refs.topicTag.textContent = vm ? t("currentRun") : t("ready");
      refs.modelTag.textContent = vm ? `${vm.provider} / ${vm.model}` : t("serverConfiguredModel");
    }

    function renderRunControls() {
      const question = refs.questionInput.value.trim();
      const running = state.status === "running";
      refs.runButton.disabled = running || !question;
      refs.runButton.textContent = running ? t("runningVerification") : t("runVerification");
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
          create("span", { className: "aw-stage-label", text: phaseLabel(phase) }),
          create("span", { className: "aw-stage-state", text: statusLabel(phase.status) }),
        );
        refs.pipeline.appendChild(item);
      });
    }

    function renderSummary() {
      const vm = state.viewModel;
      const raw = state.rawAnswer;
      refs.summaryGrid.replaceChildren(
        metric(t("metricEvidenceStatus"), vm ? evidenceStatusLabel(vm.evidenceStatus) : "-"),
        metric(t("metricConfidence"), vm && vm.confidence !== null ? vm.confidence : "-"),
        metric(t("metricCitations"), vm ? vm.metrics.citationCount : "-"),
        metric(t("metricTotalClaims"), vm ? vm.metrics.totalClaims : "-"),
        metric(t("metricSupportedClaims"), vm ? vm.metrics.supportedClaims : "-"),
        metric(t("metricCorrectedClaims"), vm ? vm.metrics.correctedClaims : "-"),
        metric(t("metricUnsupportedClaims"), vm ? vm.metrics.unsupportedClaims : "-"),
        metric(t("metricNotVerifiableClaims"), vm ? vm.metrics.notVerifiableClaims : "-"),
        metric(t("metricTotalLatency"), vm ? Adapter.formatLatency(vm.latency.totalMs || vm.latency.observedMs) : "-"),
      );
      refs.modelTag.textContent = vm
        ? `${vm.provider} / ${vm.model}`
        : raw
          ? `${Adapter.valueOrDash(raw.provider)} / ${Adapter.valueOrDash(raw.model)}`
          : t("serverConfiguredModel");
    }

    function renderFrameworkChecks() {
      const vm = state.viewModel;
      const checks = vm && Array.isArray(vm.frameworkChecks) ? vm.frameworkChecks : [];
      replaceChildren(refs.frameworkChecks);
      if (!checks.length) {
        refs.frameworkChecks.appendChild(create("p", {
          className: "aw-empty-inline",
          text: t("noFrameworkChecks"),
        }));
        return;
      }
      checks.forEach((check) => {
        const button = create("button", {
          className: `aw-check-chip aw-check-${check.status.toLowerCase().replace(/\s+/g, "-")}`,
          type: "button",
          text: `${check.label}: ${frameworkStatusLabel(check.status)}`,
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
        create("h2", { className: "aw-section-title", text: t("keyCorrections") }),
        create("button", {
          className: "aw-ghost-button",
          type: "button",
          text: t("copyKeyCorrections"),
          onClick: () => copyCurrent("keyCorrections"),
        }),
      );
      refs.keyCorrections.appendChild(title);

      if (!vm) {
        refs.keyCorrections.appendChild(create("p", { className: "aw-empty-inline", text: t("runForCorrections") }));
        return;
      }
      if (!vm.keyCorrections.length) {
        refs.keyCorrections.appendChild(create("p", { className: "aw-empty-inline", text: t("noMaterialCorrection") }));
        return;
      }
      const list = create("div", { className: "aw-key-list" });
      vm.keyCorrections.forEach((item) => {
        const button = create("button", {
          className: `aw-key-card aw-severity-${item.severity}`,
          type: "button",
        });
        button.append(
          create("span", { className: "aw-key-type", text: categoryLabel(item.category) }),
          create("span", { className: "aw-key-summary", text: item.summary }),
          create("span", { className: "aw-key-meta", text: t("keyMeta", { severity: severityLabel(item.severity), claimId: claimLabel(item.claimId) }) }),
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
      refs.rawVerification.textContent = verificationStatusLabel(raw.verificationStatus || "uncorrected");
      refs.copyRawButton.disabled = !(vm || state.rawAnswer);
      const markers = vm ? rawMarkers(vm) : [];
      const matched = renderMarkdown(refs.rawText, raw.text || t("noRawAnswer"), {
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
      const flagged = vm.claims.filter(isFlaggedClaim);
      const unmatched = flagged.filter((claim) => !matched.has(claim.id));
      if (!unmatched.length) return;
      refs.flaggedClaims.appendChild(create("h3", { className: "aw-mini-heading", text: t("flaggedClaims") }));
      unmatched.forEach((claim) => {
        const button = create("button", {
          className: `aw-flagged-claim aw-status-${safeClass(claim.verificationStatus)}`,
          type: "button",
          text: `${claimLabel(claim.id)} | ${verificationStatusLabel(claim.verificationStatus)}: ${claim.text}`,
        });
        button.addEventListener("click", () => focusByClaimOnly(claim.id));
        refs.flaggedClaims.appendChild(button);
      });
    }

    function renderCorrectedPanel() {
      const vm = state.viewModel;
      refs.correctedEvidence.textContent = vm ? evidenceStatusLabel(vm.evidenceStatus) : "-";
      // Section 3.4: confidence stays null until Anchor has a real calibration method,
      // and a bare "confidence -" in the panel header reads like a missing value rather
      // than a deliberate absence. Hide the field instead, and never invent one.
      const hasConfidence = !!vm && vm.confidence !== null && vm.confidence !== undefined && vm.confidence !== "";
      refs.confidenceWrap.hidden = !hasConfidence;
      refs.correctedConfidence.textContent = hasConfidence ? String(vm.confidence) : "";
      refs.copyCorrectedButton.disabled = !vm;
      refs.correctedModeButtons.forEach((button) => {
        const active = button.dataset.mode === state.correctedMode;
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", active ? "true" : "false");
      });
      const text = vm ? vm.correctedAnswer.text : t("correctedPending");
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
      const summary = create("summary", { text: t("correctedReferences", { count: vm ? vm.citations.length : 0 }) });
      refs.correctedReferences.appendChild(summary);
      if (!vm || !vm.citations.length) {
        refs.correctedReferences.appendChild(create("p", { className: "aw-empty-inline", text: t("noAnchorCitations") }));
        return;
      }
      const list = create("ol", { className: "aw-reference-list" });
      vm.citations.forEach((citation) => {
        const item = create("li");
        appendText(item, `${citation.id}: ${citation.title} | ${citation.source || citation.journal} | `);
        if (citation.href) {
          const link = safeLink(citation.href, citation.pmid ? `PMID ${citation.pmid}` : citation.doi ? `DOI ${citation.doi}` : t("citationSource"));
          item.appendChild(link);
        } else {
          appendText(item, t("noExternalLink"));
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
        refs.correctionsSummary.appendChild(create("p", { className: "aw-empty-inline", text: t("noRunCorrections") }));
        refs.correctionsList.appendChild(emptyBlock(t("noCorrectionReturned")));
        return;
      }

      refs.correctionsSummary.append(
        smallStat(t("statSupported"), vm.metrics.supportedClaims),
        smallStat(t("statCorrected"), vm.metrics.correctedClaims),
        smallStat(t("statUnsupported"), vm.metrics.unsupportedClaims),
      );

      const corrections = filteredCorrections(vm.corrections)
        .slice()
        .sort((a, b) => byClaimOrder(a.claimId, b.claimId));
      if (!corrections.length) {
        refs.correctionsList.appendChild(emptyBlock(t("noCorrectionMatches")));
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
          create("span", { className: "aw-category-chip", text: categoryLabel(correction.category) }),
          create("span", { className: `aw-severity-chip aw-severity-${correction.severity}`, text: severityLabel(correction.severity) }),
          create("span", { className: "aw-correction-title", text: `${claimLabel(correction.claimId)} | ${verificationStatusLabel(correction.verificationStatus)}` }),
        );
        details.appendChild(summary);
        appendCorrectionFields(details, correction);
        // Opening or clicking a card is a selection, not just a highlight: it has to
        // drive the same selectedClaimId that A and B read.
        details.addEventListener("toggle", () => {
          if (details.open) selectClaimFromAudit(correction.claimId, correction.id);
        });
        details.addEventListener("click", (event) => {
          if (event.target.tagName !== "SUMMARY") selectClaimFromAudit(correction.claimId, correction.id);
        });
        refs.correctionsList.appendChild(details);
      });
    }

    /* Section 3.1-3.3 of the UI audit. The old card put the backend's corrected_claim
       under a heading reading "Verified", falling back to the original claim when it was
       empty. For an unsupported claim the backend's text is
       "Anchor evidence does not support this claim: <claim>", so every unverified number
       in the claim was reprinted directly beneath the word "Verified".

       Rows are now named for what they hold, empty ones are dropped instead of stacking
       dashes, and the verification result is derived from the status rather than echoed. */
    function appendCorrectionFields(details, correction) {
      const status = String(correction.verificationStatus || "").toLowerCase();
      const rows = [];
      const push = (label, value, className) => {
        if (value === null || value === undefined || value === "" || value === "-") return;
        rows.push(correctionRow(label, value, className));
      };

      push(t("correctionModelSaid"), correction.originalClaim);
      push(t("correctionVerified"), verificationResultText(correction, status), "aw-row-result");
      push(t("correctionSupportedPortion"), correction.supportedPortion);
      push(t("correctionUnsupportedPortion"), correction.unsupportedPortion, "aw-row-unsupported");
      if (status === "partially_supported" && !correction.subClauseVerified) {
        push(t("correctionSupportedPortion"), t("correctionNoSubClause"), "aw-row-note");
      }
      push(t("correctionWhy"), correction.reason);
      push(t("correctionEvidence"), correction.supportingEvidenceIds.join(", "));
      push(t("correctionCitations"), correction.citationIds.join(", "));
      push(t("correctionCorrectedWording"), correction.correctedClaim);
      push(t("correctionStatus"), verificationStatusLabel(correction.verificationStatus));
      details.append(...rows);
    }

    /* What the evidence actually established, stated from the status. Never the claim
       text itself: repeating it here is what made unverified numbers look confirmed. */
    function verificationResultText(correction, status) {
      if (status === "supported") return correction.originalClaim;
      if (status === "partially_supported") {
        return correction.carriesNumerics ? t("correctionPartialNumbers") : t("correctionPartialGeneric");
      }
      if (status === "conflicting") return correction.reason || t("correctionNothingVerified");
      return correction.carriesNumerics ? t("correctionNumbersNotVerified") : t("correctionNothingVerified");
    }

    function renderCitationsTab() {
      const vm = state.viewModel;
      replaceChildren(refs.citationsList);
      refs.citationFilter.value = citationFilter;
      refs.citationSearch.value = citationSearch;
      if (!vm) {
        refs.citationsList.appendChild(emptyBlock(t("noCitationReturned")));
        return;
      }
      const citations = filteredCitations(vm.citations);
      if (!citations.length) {
        refs.citationsList.appendChild(emptyBlock(t("noCitationMatches")));
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
          create("span", { className: "aw-citation-status", text: verificationStatusLabel(citation.verificationStatus) }),
        );
        card.appendChild(head);
        card.append(
          citationRow(t("citationEvidenceId"), citation.evidenceId),
          citationRow(t("citationTitle"), citation.title),
          citationRow(t("citationSource"), citation.source || citation.journal),
          citationRow(t("citationAuthors"), citation.authors),
          citationRow(t("citationYear"), citation.year),
          citationRow(t("citationPmid"), citation.pmid || "-"),
          citationRow(t("citationDoi"), citation.doi || "-"),
          citationRow(t("citationUsedBy"), citation.usedByCorrectionIds.join(", ") || "-"),
          citationRow(t("citationIssue"), citationIssueLabel(citation.issue)),
        );
        if (citation.href) {
          const link = safeLink(citation.href, citation.pmid ? t("openPmid", { pmid: citation.pmid }) : citation.doi ? t("openDoi") : t("openSource"));
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
        refs.runDetails.appendChild(emptyBlock(t("noRunDetails")));
        return;
      }
      const details = vm.runDetails;
      refs.runDetails.append(
        keyValueGrid([
          [t("runQueryId"), vm.queryId],
          [t("runStartTime"), details.startTime],
          [t("runEndTime"), details.endTime],
          [t("runTotalLatency"), Adapter.formatLatency(vm.latency.totalMs || vm.latency.observedMs)],
          [t("runProvider"), details.provider],
          [t("runModel"), details.model],
          [t("runEvidenceStatus"), evidenceStatusLabel(details.evidenceStatus)],
          [t("runConfidence"), vm.confidence === null ? "-" : vm.confidence],
          [t("runCorrectionPerformed"), booleanLabel(details.correctionPerformed)],
          [t("runRawPreserved"), booleanLabel(details.rawAnswerPreserved)],
          [t("runRetrievedEvidence"), details.retrievedEvidenceCount],
          [t("runUsableEvidence"), details.usableEvidenceCount],
        ]),
        stageEventList(details.stageEvents),
        notesBlock(t("warningsNotes"), details.warnings),
      );
      if (isDebugMode()) {
        const rawDetails = create("details", { className: "aw-debug-details" });
        rawDetails.append(
          create("summary", { text: t("viewRawResponse") }),
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
        text: t("connectionPrefix", { status: connectionLabel(connection.status) }),
      }));
      if (connection.error) {
        refs.settingsStatus.appendChild(create("p", { className: "aw-error-text", text: connection.error.message }));
      }
      const deps = connection.dependencies || {};
      const list = create("div", { className: "aw-dependency-grid" });
      ["database", "retrieval", "llm", "configuration"].forEach((key) => {
        list.appendChild(create("span", { className: "aw-dependency-chip", text: `${dependencyLabel(key)}: ${dependencyStatusLabel(deps[key])}` }));
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
      refs.errorBox.textContent = message || t("requestFailed");
    }

    function clearInlineError() {
      refs.errorBox.hidden = true;
      refs.errorBox.textContent = "";
    }

    function statusText() {
      if (state.status === "idle") return t("idle");
      if (state.status === "running") return t("serverProcessing");
      if (state.status === "completed") return t("completed");
      if (state.status === "failed" && state.error) return `${state.error.code || "FAILED"}: ${state.error.message || t("failedFallback")}`;
      return state.status;
    }

    function copyCurrent(kind) {
      const vm = state.viewModel;
      if (kind === "raw") return copyValue(vm && vm.rawAnswer ? vm.rawAnswer.text : "", t("rawCopied"));
      if (kind === "corrected") return copyValue(vm && vm.correctedAnswer ? vm.correctedAnswer.text : "", t("correctedCopied"));
      if (kind === "queryId") return copyValue(vm ? vm.queryId : "", t("queryIdCopied"));
      if (kind === "runDetails") return copyValue(vm ? JSON.stringify(Exporter.buildAuditJson(vm).run_details, null, 2) : "", t("runDetailsCopied"));
      if (kind === "keyCorrections") {
        const text = vm && vm.keyCorrections.length
          ? vm.keyCorrections.map((item) => `${item.category} (${item.severity}): ${item.summary} [${claimLabel(item.claimId)}]`).join("\n")
          : t("materialCorrectionFallback");
        return copyValue(text, t("keyCorrectionsCopied"));
      }
      return Promise.resolve(false);
    }

    async function copyValue(value, successMessage) {
      const text = String(value || "").trim();
      if (!text) {
        showToast(t("nothingToCopy"));
        return false;
      }
      let ok = false;
      try {
        ok = await Exporter.copyText(text);
      } catch (_error) {
        ok = false;
      }
      showToast(ok ? successMessage : t("copyUnavailable"));
      return ok;
    }

    function exportMarkdown() {
      const vm = state.viewModel;
      if (!vm) {
        showToast(t("runBeforeExport"));
        return;
      }
      const text = Exporter.buildMarkdownReport(vm);
      const filename = Exporter.makeReportFilename(vm, "md");
      Exporter.downloadText(filename, text, "text/markdown;charset=utf-8");
      showToast(t("markdownExported"));
    }

    function exportJson() {
      const vm = state.viewModel;
      if (!vm) {
        showToast(t("runBeforeExport"));
        return;
      }
      const text = JSON.stringify(Exporter.buildAuditJson(vm), null, 2);
      const filename = Exporter.makeReportFilename(vm, "json");
      Exporter.downloadText(filename, text, "application/json;charset=utf-8");
      showToast(t("auditJsonExported"));
    }


    /* Section 3.6. selectedClaimId was already stored by the state machine but nothing
       ever read it, so selecting a claim left no visible trace in any panel. One
       selection now drives A, B and C together, and Previous/Next walk the same order
       the corrections list is sorted in. */
    function navigableClaims() {
      const vm = state.viewModel;
      if (!vm) return [];
      return vm.claims.slice().sort((a, b) => byClaimOrder(a.id, b.id));
    }

    function applyClaimSelection() {
      const claimId = state.selectedClaimId;
      root.querySelectorAll(".aw-is-selected").forEach((node) => node.classList.remove("aw-is-selected"));
      root.querySelectorAll("[data-claim-id]").forEach((node) => {
        node.setAttribute("aria-current", "false");
      });
      if (claimId) {
        root.querySelectorAll(`[data-claim-id="${cssEscape(claimId)}"]`).forEach((node) => {
          node.classList.add("aw-is-selected");
          node.setAttribute("aria-current", "true");
        });
      }
      renderClaimPosition();
    }

    function renderClaimPosition() {
      const claims = navigableClaims();
      const index = claims.findIndex((claim) => claim.id === state.selectedClaimId);
      // With nothing selected yet, Next must still be able to enter the list at claim 1.
      refs.prevClaimButton.disabled = claims.length === 0 || index <= 0;
      refs.nextClaimButton.disabled = claims.length === 0 || index >= claims.length - 1;
      refs.claimPosition.textContent = index < 0
        ? (claims.length ? t("noClaimSelected") : "-")
        : t("claimPosition", { index: index + 1, total: claims.length });
    }

    function stepClaim(delta) {
      const claims = navigableClaims();
      if (!claims.length) return;
      const index = claims.findIndex((claim) => claim.id === state.selectedClaimId);
      const nextIndex = index < 0 ? (delta > 0 ? 0 : claims.length - 1) : index + delta;
      if (nextIndex < 0 || nextIndex >= claims.length) return;
      focusByClaimOnly(claims[nextIndex].id);
    }

    /* The corrected answer marks the same claim ids, so scrolling B is the same lookup. */
    function revealInCorrectedPanel(claimId) {
      if (!claimId) return;
      const marker = refs.correctedText.querySelector(`[data-claim-id="${cssEscape(claimId)}"]`);
      if (!marker) return;
      marker.scrollIntoView({ block: "center", behavior: reducedMotion() ? "auto" : "smooth" });
      marker.classList.add("aw-focus-pulse");
      window.setTimeout(() => marker.classList.remove("aw-focus-pulse"), 1200);
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
      applyClaimSelection();
      revealInCorrectedPanel(claimId);
    }

    /* Selection coming from the C panel. It must not re-scroll C to itself, which is
       what makes the page jump when a reader is already reading the card. */
    function selectClaimFromAudit(claimId, correctionId) {
      state = State.selectClaim(state, claimId || null);
      highlightLinked(claimId, correctionId);
      applyClaimSelection();
      revealInCorrectedPanel(claimId);
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
      langButtons: Array.from(root.querySelectorAll(".aw-lang-button")),
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
      confidenceWrap: required(root, "#aw-confidence-wrap"),
      prevClaimButton: required(root, "#aw-prev-claim"),
      nextClaimButton: required(root, "#aw-next-claim"),
      claimPosition: required(root, "#aw-claim-position"),
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
      container.appendChild(create("p", { className: "aw-empty-inline", text: t("noTextReturned") }));
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
        // Section 3.7 and section 7: a marked span must not rely on colour alone, so it
        // carries a glyph and a spoken label as well as its status class.
        const affix = markerAffix(next.marker.status);
        const button = create("button", {
          className: `aw-claim-marker aw-status-${safeClass(next.marker.status)}`,
          type: "button",
          title: `${claimLabel(next.marker.id)} | ${affix.label} | ${next.marker.category || "other"} | ${next.marker.reason || ""}`,
          dataClaimId: next.marker.id,
        });
        button.setAttribute("aria-label", `${affix.label}: ${next.text}`);
        button.append(
          create("span", { className: "aw-marker-glyph", text: affix.glyph, ariaHidden: "true" }),
          create("span", { className: "aw-marker-text", text: next.text }),
          create("span", { className: "aw-marker-tag", text: affix.label }),
        );
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

  /* Panel A shows the UNCORRECTED answer. Only statuses Anchor actually judged
     against evidence belong here. "not_verifiable" means Anchor could not check
     the claim at all, and "partially_supported" means it IS supported with
     caveats - neither is a finding about the raw answer, and marking them made
     Anchor look like it had condemned claims it never evaluated. */
  const FLAGGED_STATUSES = new Set(["unsupported", "conflicting"]);

  function isFlaggedClaim(claim) {
    return FLAGGED_STATUSES.has(String(claim.verificationStatus || "").toLowerCase());
  }

  function rawMarkers(vm) {
    const correctionByClaim = new Map(vm.corrections.map((correction) => [correction.claimId, correction]));
    return vm.claims
      .filter(isFlaggedClaim)
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
      text: raw && raw.text ? raw.text : t("noRawAnswer"),
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

  /* Section 3.5. Internally a claim keeps the backend's id ("claim_6"); the reader sees
     "Claim 6". Sorting is numeric so claim_10 does not land before claim_2. */
  function claimLabel(claimId) {
    const raw = String(claimId || "").trim();
    if (!raw || raw === "-") return "-";
    const match = raw.match(/^claim[_\s-]*(\d+)$/i);
    return match ? `Claim ${Number(match[1])}` : raw;
  }

  function claimOrdinal(claimId) {
    const match = String(claimId || "").match(/(\d+)/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
  }

  function byClaimOrder(a, b) {
    const diff = claimOrdinal(a) - claimOrdinal(b);
    return diff !== 0 ? diff : String(a).localeCompare(String(b));
  }

  /* Glyph plus words for each verdict, so a marked span reads the same to someone who
     cannot separate the red from the green. */
  const MARKER_AFFIX = {
    supported: { glyph: "\u2713", key: "markerRetained" },
    partially_supported: { glyph: "\u2248", key: "markerQualified" },
    unsupported: { glyph: "\u2715", key: "markerRemoved" },
    conflicting: { glyph: "\u26A0", key: "markerConflicting" },
    not_verifiable: { glyph: "?", key: "markerNotVerifiable" },
  };

  function markerAffix(status) {
    const entry = MARKER_AFFIX[String(status || "").toLowerCase()] || { glyph: "\u2022", key: "markerOther" };
    return { glyph: entry.glyph, label: t(entry.key) };
  }

  function correctionRow(label, value, className) {
    const row = create("div", { className: `aw-correction-row${className ? " " + className : ""}` });
    row.append(create("span", { text: label }), create("p", { text: value }));
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
    details.appendChild(create("summary", { text: t("observedStageEvents") }));
    if (!Array.isArray(events) || !events.length) {
      details.appendChild(create("p", { className: "aw-empty-inline", text: t("noStageEvents") }));
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
      details.appendChild(create("p", { className: "aw-empty-inline", text: t("noneReturned") }));
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
    replaceChildren(select);
    values.forEach((value) => {
      const option = create("option", { text: optionLabel(value) });
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
    if (status === "connected") return t("connectionConnected");
    if (status === "degraded") return t("connectionDegraded");
    if (status === "disconnected") return t("connectionDisconnected");
    return t("connectionChecking");
  }

  function phaseLabel(phase) {
    const key = phase && phase.key;
    if (key === "raw_generation") return t("stageRaw");
    if (key === "retrieval") return t("stageRetrieval");
    if (key === "claim_extraction") return t("stageExtraction");
    if (key === "verification") return t("stageVerification");
    if (key === "correction") return t("stageCorrection");
    return phase && phase.label ? phase.label : "-";
  }

  function statusLabel(status) {
    if (status === "pending") return t("statusPending");
    if (status === "running") return t("statusRunning");
    if (status === "completed") return t("statusCompleted");
    if (status === "failed") return t("statusFailed");
    if (status === "skipped") return t("statusSkipped");
    return status || "-";
  }

  function optionLabel(value) {
    return enumLabel("option", value);
  }

  function categoryLabel(value) {
    return enumLabel("option", value);
  }

  function verificationStatusLabel(value) {
    return enumLabel("verification", value);
  }

  function evidenceStatusLabel(value) {
    return enumLabel("evidence", value);
  }

  function frameworkStatusLabel(value) {
    return enumLabel("framework_status", value);
  }

  function severityLabel(value) {
    return enumLabel("severity", value);
  }

  function dependencyLabel(value) {
    return enumLabel("dependency", value);
  }

  function dependencyStatusLabel(value) {
    return enumLabel("dependency_status", value);
  }

  function citationIssueLabel(value) {
    if (value === "Citation metadata is incomplete in the API response.") {
      return t("citationIncompleteIssue");
    }
    return value || "-";
  }

  function booleanLabel(value) {
    if (value === true) return t("boolTrue");
    if (value === false) return t("boolFalse");
    return value === null || value === undefined ? "-" : String(value);
  }

  function enumLabel(prefix, value) {
    if (value === null || value === undefined || value === "") return "-";
    const raw = String(value);
    const key = `${prefix}.${raw.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "")}`;
    const translated = t(key);
    return translated === key ? raw : translated;
  }

  function t(key, params) {
    const source = UI_TEXT[currentUiLanguage] || UI_TEXT.en;
    const fallback = UI_TEXT.en;
    const raw = source[key] || fallback[key] || key;
    return String(raw).replace(/\{([^}]+)\}/g, (_match, name) => {
      const value = params && Object.prototype.hasOwnProperty.call(params, name) ? params[name] : "";
      return value === null || value === undefined ? "" : String(value);
    });
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

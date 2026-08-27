(function () {
  "use strict";

  const DASH = "-";
  const MATERIAL_STATUSES = new Set(["partially_supported", "unsupported", "conflicting", "not_verifiable"]);
  const CORRECTION_CATEGORIES = new Set([
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
  ]);

  function normalizeResponse(payload, context) {
    const safePayload = payload && typeof payload === "object" ? payload : {};
    const safeContext = context && typeof context === "object" ? context : {};
    const raw = safePayload.raw_answer || {};
    const corrected = safePayload.corrected_answer || {};
    const claims = normalizeClaims(safePayload.claims);
    const corrections = normalizeCorrections(safePayload.corrections, claims);
    const citations = normalizeCitations(safePayload.citations, corrections);
    const metrics = buildMetrics(claims, corrections, citations);
    const audit = normalizeAudit(safePayload.audit);
    const queryId = valueOrDash(safePayload.query_id);
    const question = valueOrDash(safePayload.question || safeContext.question);
    const evidenceStatus = statusOrDash(corrected.evidence_status || audit.evidenceStatus);

    return {
      query: {
        id: queryId,
        text: question,
        title: topicTitle(question),
        submittedAt: safeContext.startedAt || null,
        completedAt: safeContext.completedAt || null,
      },
      topic: topicTitle(question),
      provider: valueOrDash(raw.provider),
      model: valueOrDash(raw.model),
      queryId,
      rawAnswer: {
        text: valueOrDash(raw.text),
        provider: valueOrDash(raw.provider),
        model: valueOrDash(raw.model),
        groundedByAnchor: raw.grounded_by_anchor === false ? false : null,
        verificationStatus: valueOrDash(raw.verification_status || "uncorrected"),
      },
      correctedAnswer: {
        text: valueOrDash(corrected.text),
        evidenceStatus,
        confidence: safePayload.confidence === null || safePayload.confidence === undefined ? null : safePayload.confidence,
        calibration: evidenceStatus === DASH ? DASH : evidenceStatus,
      },
      latency: {
        totalMs: numberOrNull(safePayload.latency_ms),
        observedMs: numberOrNull(safeContext.observedLatencyMs),
        stageEvents: Array.isArray(safeContext.stageEvents) ? safeContext.stageEvents.slice() : [],
      },
      evidenceStatus,
      confidence: safePayload.confidence === null || safePayload.confidence === undefined ? null : safePayload.confidence,
      claims,
      corrections,
      citations,
      keyCorrections: buildKeyCorrections(corrections),
      frameworkChecks: normalizeFrameworkChecks(safePayload),
      warnings: audit.notes,
      runDetails: {
        queryId,
        startTime: safeContext.startedAt || null,
        endTime: safeContext.completedAt || null,
        provider: valueOrDash(raw.provider),
        model: valueOrDash(raw.model),
        evidenceStatus,
        confidence: safePayload.confidence === null || safePayload.confidence === undefined ? null : safePayload.confidence,
        correctionPerformed: audit.correctionPerformed,
        rawAnswerPreserved: audit.rawAnswerPreserved,
        retrievedEvidenceCount: deriveRetrievedEvidenceCount(claims, citations),
        usableEvidenceCount: citations.length || null,
        stageLatency: null,
        stageEvents: Array.isArray(safeContext.stageEvents) ? safeContext.stageEvents.slice() : [],
        warnings: audit.notes,
        errors: [],
      },
      metrics,
      rawPayload: safePayload,
    };
  }

  function normalizeClaims(claims) {
    if (!Array.isArray(claims)) return [];
    return claims.map((claim, index) => ({
      id: valueOrDash(claim && claim.claim_id) === DASH ? `claim-${index + 1}` : String(claim.claim_id),
      text: valueOrDash(claim && claim.text),
      type: valueOrDash(claim && claim.type),
      verificationStatus: valueOrDash(claim && claim.verification_status),
      evidenceIds: safeStringList(claim && claim.evidence_ids),
      supportingEvidenceIds: safeStringList(claim && claim.supporting_evidence_ids),
      conflictingEvidenceIds: safeStringList(claim && claim.conflicting_evidence_ids),
    }));
  }


  // A claim that quotes effect sizes, confidence intervals or p-values. Used only to
  // choose wording - "the numbers were not verified" is a restatement of the status,
  // never a new medical judgement.
  const NUMERIC_CLAIM_RE = /\d+(?:\.\d+)?\s*(?:%|mL|ml|mg|kg|年|weeks?|months?)|p\s*[<>=]|95%\s*CI|CI\s*[:：]/i;

  function carriesNumerics(claim) {
    return NUMERIC_CLAIM_RE.test(String(claim || ""));
  }

  function supportedPortion(status, original) {
    // Only "supported" means the evidence reached the whole claim. For
    // partially_supported the backend tells us some of it holds but not which part,
    // so we must not nominate one.
    return String(status || "").toLowerCase() === "supported" ? original : null;
  }

  function unsupportedPortion(status, original) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "unsupported" || normalized === "not_verifiable") return original;
    return null;
  }

  function normalizeCorrections(corrections, claims) {
    if (!Array.isArray(corrections)) return [];
    const claimByText = new Map();
    claims.forEach((claim) => claimByText.set(normalizeComparableText(claim.text), claim));
    return corrections.map((correction, index) => {
      const original = valueOrDash(correction && correction.original_claim);
      const corrected = correction && correction.corrected_claim ? String(correction.corrected_claim) : "";
      const claim = claimByText.get(normalizeComparableText(original)) || claimByOrdinal(correction, claims);
      const status = valueOrDash(correction && correction.verification_status);
      const reason = valueOrDash(correction && correction.correction_reason);
      const category = normalizeCorrectionCategory(correction && correction.category, status, reason, original);
      const material = isMaterialCorrection(status, original, corrected);
      return {
        id: valueOrDash(correction && correction.correction_id) === DASH ? `correction-${index + 1}` : String(correction.correction_id),
        claimId: claim ? claim.id : valueOrDash(correction && correction.claim_id),
        category,
        severity: deriveSeverity(status, material),
        originalClaim: original,
        correctedClaim: corrected || null,
        verificationStatus: status,
        // Which part of the claim the evidence actually reached. The backend does not
        // return sub-clause verdicts, so anything it cannot tell us stays null and the
        // UI says so rather than guessing which half of a compound claim survived.
        supportedPortion: supportedPortion(status, original),
        unsupportedPortion: unsupportedPortion(status, original),
        subClauseVerified: false,
        carriesNumerics: carriesNumerics(original),
        reason,
        supportingEvidenceIds: safeStringList(correction && correction.supporting_evidence_ids),
        conflictingEvidenceIds: safeStringList(correction && correction.conflicting_evidence_ids),
        citationIds: safeStringList(correction && correction.citation_ids),
        material,
      };
    });
  }

  function normalizeCitations(citations, corrections) {
    if (!Array.isArray(citations)) return [];
    const usedByCorrection = new Map();
    corrections.forEach((correction) => {
      correction.citationIds.forEach((citationId) => {
        if (!usedByCorrection.has(citationId)) usedByCorrection.set(citationId, []);
        usedByCorrection.get(citationId).push(correction.id);
      });
    });
    return citations.map((citation, index) => {
      const id = valueOrDash(citation && citation.citation_id) === DASH ? `citation-${index + 1}` : String(citation.citation_id);
      const pmid = sanitizedPmid(citation && citation.pmid);
      const doi = sanitizedDoi(citation && citation.doi);
      const href = citationHref({ pmid, doi, url: citation && citation.url });
      const status = citationStatus(citation, pmid, doi);
      return {
        id,
        evidenceId: valueOrDash(citation && citation.evidence_id),
        title: valueOrDash(citation && citation.title),
        authors: valueOrDash(citation && citation.authors),
        journal: valueOrDash(citation && citation.journal),
        year: valueOrDash(citation && citation.year),
        source: valueOrDash(citation && citation.source),
        pmid,
        doi,
        url: safeHttpUrl(citation && citation.url),
        href,
        verificationStatus: status,
        issue: status === "verified" ? DASH : "Citation metadata is incomplete in the API response.",
        usedByCorrectionIds: usedByCorrection.get(id) || [],
        usedInCorrectedAnswer: usedByCorrection.has(id),
      };
    });
  }

  function buildMetrics(claims, corrections, citations) {
    return {
      citationCount: citations.length,
      totalClaims: claims.length,
      supportedClaims: claims.filter((claim) => claim.verificationStatus === "supported").length,
      correctedClaims: corrections.filter((correction) => correction.material).length,
      unsupportedClaims: claims.filter((claim) => (
        claim.verificationStatus === "unsupported" ||
        claim.verificationStatus === "conflicting"
      )).length,
      notVerifiableClaims: claims.filter((claim) => (
        claim.verificationStatus === "not_verifiable"
      )).length,
    };
  }

  function buildKeyCorrections(corrections) {
    return corrections
      .filter((correction) => correction.material)
      .sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      .slice(0, 3)
      .map((correction) => ({
        id: correction.id,
        claimId: correction.claimId,
        category: correction.category,
        severity: correction.severity,
        summary: keyCorrectionSummary(correction),
      }));
  }

  function normalizeFrameworkChecks(payload) {
    const checks = payload && payload.framework_checks;
    if (!Array.isArray(checks)) return [];
    return checks.map((check, index) => ({
      id: valueOrDash(check && check.id) === DASH ? `check-${index + 1}` : String(check.id),
      label: valueOrDash(check && check.label),
      status: normalizeCheckStatus(check && check.status),
      detail: valueOrDash(check && check.detail),
      claimId: valueOrDash(check && check.claim_id),
      correctionId: valueOrDash(check && check.correction_id),
    }));
  }

  function normalizeAudit(audit) {
    const source = audit && typeof audit === "object" ? audit : {};
    return {
      rawAnswerPreserved: typeof source.raw_answer_preserved === "boolean" ? source.raw_answer_preserved : null,
      correctionPerformed: typeof source.correction_performed === "boolean" ? source.correction_performed : null,
      evidenceStatus: valueOrDash(source.evidence_status),
      notes: Array.isArray(source.notes) ? source.notes.map(String).filter(Boolean) : [],
    };
  }

  function claimByOrdinal(correction, claims) {
    const id = String(correction && correction.correction_id || "");
    const match = id.match(/(\d+)$/);
    if (!match) return null;
    const ordinal = Number(match[1]);
    return claims.find((claim) => claim.id === `claim_${ordinal}` || claim.id === `claim-${ordinal}`) || null;
  }

  function normalizeCorrectionCategory(explicitCategory, status, reason, originalClaim) {
    const explicit = String(explicitCategory || "").trim().toLowerCase();
    if (CORRECTION_CATEGORIES.has(explicit)) return explicit;
    const text = `${reason || ""} ${originalClaim || ""}`.toLowerCase();
    const normalizedStatus = String(status || "").toLowerCase();
    if (/citation|reference|pmid|doi|wrong paper|引用|文献/.test(text) && normalizedStatus !== "supported") {
      return "wrong citation";
    }
    if (/mortality|hazard|risk ratio|odds ratio|confidence interval|\b(?:rr|or|hr)\b|%|percent|数值|置信区间|死亡/.test(text) && normalizedStatus !== "supported") {
      return "numerical error";
    }
    if (/certainty|confidence|overstat|definitive|always|never|确定|绝对|一定/.test(text) && normalizedStatus !== "supported") {
      return "excessive certainty";
    }
    if (/stale|outdated|ongoing|已读出|过时|时效/.test(text)) {
      return "stale evidence";
    }
    if (/context|population|subgroup|scope|applicab|适用|人群|范围/.test(text) && normalizedStatus !== "supported") {
      return "missing context";
    }
    if (normalizedStatus === "conflicting") return "contradicted claim";
    // not_verifiable means Anchor could not check the claim, which is a different
    // finding from "the evidence does not support it". Folding them together told
    // the reader Anchor had refuted claims it never evaluated.
    if (normalizedStatus === "not_verifiable") return "not verifiable";
    if (normalizedStatus === "unsupported") return "unsupported claim";
    if (normalizedStatus === "partially_supported") return "partial support";
    if (/narrow|weaker|cautious|calibrat|谨慎|弱化|缩小/.test(text)) return "wording calibration";
    return "other";
  }

  function deriveSeverity(status, material) {
    const normalized = String(status || "").toLowerCase();
    if (normalized === "unsupported" || normalized === "conflicting") return "high";
    if (normalized === "not_verifiable" || normalized === "partially_supported") return "medium";
    return material ? "low" : "info";
  }

  function isMaterialCorrection(status, original, corrected) {
    const normalized = String(status || "").toLowerCase();
    if (MATERIAL_STATUSES.has(normalized)) return true;
    const originalText = normalizeComparableText(original);
    const correctedText = normalizeComparableText(corrected);
    return Boolean(correctedText && originalText && correctedText !== originalText);
  }

  function citationStatus(citation, pmid, doi) {
    const evidenceId = valueOrDash(citation && citation.evidence_id);
    if (evidenceId === DASH) return "unverified";
    if (pmid || doi || valueOrDash(citation && citation.title) !== DASH || valueOrDash(citation && citation.source) !== DASH) {
      return "verified";
    }
    return "partial";
  }

  function citationHref(citation) {
    const pmid = sanitizedPmid(citation && citation.pmid);
    if (pmid) return `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`;
    const doi = sanitizedDoi(citation && citation.doi);
    if (doi) return `https://doi.org/${encodeURI(doi)}`;
    return safeHttpUrl(citation && citation.url);
  }

  function sanitizedPmid(value) {
    const text = String(value || "").trim();
    return /^\d{4,12}$/.test(text) ? text : null;
  }

  function sanitizedDoi(value) {
    const text = String(value || "").trim();
    if (!text || /\s/.test(text)) return null;
    return /^10\.\S+\/\S+$/i.test(text) ? text : null;
  }

  function safeHttpUrl(value) {
    const text = String(value || "").trim();
    if (!text) return null;
    try {
      const parsed = new URL(text);
      return parsed.protocol === "http:" || parsed.protocol === "https:" ? parsed.href : null;
    } catch (_error) {
      return null;
    }
  }

  function keyCorrectionSummary(correction) {
    const claim = correction.originalClaim && correction.originalClaim !== DASH
      ? truncateText(correction.originalClaim, 120)
      : "A returned claim";
    if (correction.verificationStatus === "supported") return `Confirmed: ${claim}`;
    if (correction.verificationStatus === "partially_supported") return `Partially supported: ${claim}`;
    if (correction.verificationStatus === "conflicting") return `Conflicting evidence: ${claim}`;
    if (correction.verificationStatus === "unsupported") return `Unsupported: ${claim}`;
    if (correction.verificationStatus === "not_verifiable") return `Not verifiable: ${claim}`;
    return claim;
  }

  function topicTitle(question) {
    const text = normalizeComparableText(question);
    if (!text) return "Live evidence verification";
    const words = text.split(/\s+/).filter(Boolean);
    if (words.length <= 10 && text.length <= 80) return text;
    return truncateText(text, 80);
  }

  function normalizeCheckStatus(status) {
    const value = String(status || "").trim().toLowerCase();
    if (value === "passed" || value === "pass") return "Passed";
    if (value === "warning" || value === "warn") return "Warning";
    if (value === "failed" || value === "fail") return "Failed";
    return "Not evaluated";
  }

  function deriveRetrievedEvidenceCount(claims, citations) {
    const ids = new Set();
    claims.forEach((claim) => {
      claim.evidenceIds.forEach((id) => ids.add(id));
      claim.supportingEvidenceIds.forEach((id) => ids.add(id));
      claim.conflictingEvidenceIds.forEach((id) => ids.add(id));
    });
    citations.forEach((citation) => {
      if (citation.evidenceId !== DASH) ids.add(citation.evidenceId);
    });
    return ids.size || null;
  }

  function statusOrDash(value) {
    const text = String(value || "").trim();
    return text || DASH;
  }

  function valueOrDash(value) {
    if (value === null || value === undefined || value === "") return DASH;
    return String(value);
  }

  function numberOrNull(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
  }

  function safeStringList(value) {
    return Array.isArray(value) ? value.map(String).filter(Boolean) : [];
  }

  function normalizeComparableText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function truncateText(value, maxLength) {
    const text = String(value || "");
    if (text.length <= maxLength) return text;
    return `${text.slice(0, Math.max(0, maxLength - 1)).trim()}...`;
  }

  function severityRank(severity) {
    if (severity === "high") return 4;
    if (severity === "medium") return 3;
    if (severity === "low") return 2;
    return 1;
  }

  function formatLatency(ms) {
    const number = numberOrNull(ms);
    if (number === null) return DASH;
    if (number >= 1000) return `${(number / 1000).toFixed(1)}s`;
    return `${Math.round(number)}ms`;
  }

  const exported = {
    DASH,
    normalizeResponse,
    normalizeClaims,
    normalizeCorrections,
    normalizeCitations,
    buildMetrics,
    buildKeyCorrections,
    normalizeCorrectionCategory,
    deriveSeverity,
    citationHref,
    sanitizedPmid,
    sanitizedDoi,
    safeHttpUrl,
    topicTitle,
    formatLatency,
    valueOrDash,
    normalizeComparableText,
    truncateText,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
  if (typeof window !== "undefined") {
    window.AnchorWorkspaceAdapter = exported;
  }
})();

(function () {
  "use strict";

  function buildMarkdownReport(viewModel, generatedAt) {
    const vm = viewModel || {};
    const generated = generatedAt || new Date().toISOString();
    const lines = [];
    lines.push(`# AnchorAI Evidence Verification Report`);
    lines.push("");
    lines.push(`Generated: ${generated}`);
    lines.push(`Question: ${plain(vm.query && vm.query.text)}`);
    lines.push(`Provider/model: ${plain(vm.provider)} / ${plain(vm.model)}`);
    lines.push(`Query ID: ${plain(vm.queryId)}`);
    lines.push(`Evidence status: ${plain(vm.evidenceStatus)}`);
    lines.push(`Confidence: ${vm.confidence === null || vm.confidence === undefined ? "-" : plain(vm.confidence)}`);
    lines.push(`Total latency: ${formatLatency(vm.latency && vm.latency.totalMs)}`);
    lines.push("");

    lines.push("## Raw Answer");
    lines.push("");
    lines.push(plain(vm.rawAnswer && vm.rawAnswer.text));
    lines.push("");

    lines.push("## Anchor-Corrected Answer");
    lines.push("");
    lines.push(plain(vm.correctedAnswer && vm.correctedAnswer.text));
    lines.push("");

    lines.push("## Key Corrections");
    lines.push("");
    const keyCorrections = Array.isArray(vm.keyCorrections) ? vm.keyCorrections : [];
    if (!keyCorrections.length) {
      lines.push("No material correction was required.");
    } else {
      keyCorrections.forEach((item) => {
        lines.push(`- ${plain(item.category)} (${plain(item.severity)}): ${plain(item.summary)} [${plain(item.claimId)}]`);
      });
    }
    lines.push("");

    lines.push("## Claim Audit");
    lines.push("");
    const claims = Array.isArray(vm.claims) ? vm.claims : [];
    if (!claims.length) {
      lines.push("No claim records were returned for this run.");
    } else {
      claims.forEach((claim) => {
        lines.push(`- ${plain(claim.id)} | ${plain(claim.verificationStatus)} | ${plain(claim.type)}: ${plain(claim.text)}`);
      });
    }
    lines.push("");

    lines.push("## Corrections");
    lines.push("");
    const corrections = Array.isArray(vm.corrections) ? vm.corrections : [];
    if (!corrections.length) {
      lines.push("No correction records were returned for this run.");
    } else {
      corrections.forEach((correction) => {
        lines.push(`### ${plain(correction.id)} | ${plain(correction.category)} | ${plain(correction.severity)}`);
        lines.push(`Claim ID: ${plain(correction.claimId)}`);
        lines.push(`Status: ${plain(correction.verificationStatus)}`);
        lines.push(`Model said: ${plain(correction.originalClaim)}`);
        lines.push(`Verified: ${plain(correction.correctedClaim || correction.originalClaim)}`);
        lines.push(`Why: ${plain(correction.reason)}`);
        lines.push(`Supporting evidence: ${plainList(correction.supportingEvidenceIds)}`);
        lines.push(`Citations: ${plainList(correction.citationIds)}`);
        lines.push("");
      });
    }

    lines.push("## Citations");
    lines.push("");
    const citations = Array.isArray(vm.citations) ? vm.citations : [];
    if (!citations.length) {
      lines.push("No citation records were returned for this run.");
    } else {
      citations.forEach((citation) => {
        lines.push(`- ${plain(citation.id)} | evidence_id: ${plain(citation.evidenceId)} | status: ${plain(citation.verificationStatus)}`);
        lines.push(`  Title: ${plain(citation.title)}`);
        lines.push(`  Source: ${plain(citation.source || citation.journal)}`);
        lines.push(`  PMID: ${plain(citation.pmid)}`);
        lines.push(`  DOI: ${plain(citation.doi)}`);
        lines.push(`  URL: ${plain(citation.href || citation.url)}`);
      });
    }
    lines.push("");

    lines.push("## Run Metadata");
    lines.push("");
    const details = vm.runDetails || {};
    lines.push(`Start time: ${plain(details.startTime)}`);
    lines.push(`End time: ${plain(details.endTime)}`);
    lines.push(`Correction performed: ${plain(details.correctionPerformed)}`);
    lines.push(`Raw answer preserved: ${plain(details.rawAnswerPreserved)}`);
    lines.push(`Retrieved evidence count: ${plain(details.retrievedEvidenceCount)}`);
    lines.push(`Usable evidence count: ${plain(details.usableEvidenceCount)}`);
    lines.push("");
    lines.push("Warnings / notes:");
    const warnings = Array.isArray(vm.warnings) ? vm.warnings : [];
    if (!warnings.length) {
      lines.push("- None returned.");
    } else {
      warnings.forEach((warning) => lines.push(`- ${plain(warning)}`));
    }

    return `${lines.join("\n").trim()}\n`;
  }

  function buildAuditJson(viewModel) {
    const vm = viewModel || {};
    return {
      generated_at: new Date().toISOString(),
      query: vm.query || null,
      provider: vm.provider || null,
      model: vm.model || null,
      query_id: vm.queryId || null,
      evidence_status: vm.evidenceStatus || null,
      confidence: vm.confidence === undefined ? null : vm.confidence,
      latency: vm.latency || null,
      raw_answer: vm.rawAnswer || null,
      corrected_answer: vm.correctedAnswer || null,
      metrics: vm.metrics || null,
      key_corrections: vm.keyCorrections || [],
      claims: vm.claims || [],
      corrections: vm.corrections || [],
      citations: vm.citations || [],
      framework_checks: vm.frameworkChecks || [],
      warnings: vm.warnings || [],
      run_details: vm.runDetails || null,
    };
  }

  function makeReportFilename(viewModel, extension, now) {
    const vm = viewModel || {};
    const date = (now || new Date()).toISOString().replace(/[:.]/g, "-").slice(0, 19);
    const topic = safeFilenamePart(vm.topic || (vm.query && vm.query.title) || "anchor-report").slice(0, 48) || "anchor-report";
    const queryId = safeFilenamePart(vm.queryId || "no-query").slice(0, 12) || "no-query";
    const ext = String(extension || "txt").replace(/[^a-z0-9]/gi, "").toLowerCase() || "txt";
    return `${date}-${topic}-${queryId}.${ext}`;
  }

  async function copyText(text) {
    const value = String(text || "");
    if (typeof navigator !== "undefined" && navigator.clipboard && navigator.clipboard.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        return true;
      } catch (_error) {
        // Fall through to the legacy textarea copy path when browser permission is denied.
      }
    }
    if (typeof document === "undefined") return false;
    const textarea = document.createElement("textarea");
    textarea.value = value;
    textarea.setAttribute("readonly", "readonly");
    textarea.style.position = "fixed";
    textarea.style.left = "-9999px";
    document.body.appendChild(textarea);
    textarea.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } finally {
      textarea.remove();
    }
    return ok;
  }

  function downloadText(filename, text, type) {
    if (typeof document === "undefined" || typeof URL === "undefined" || typeof Blob === "undefined") return false;
    const blob = new Blob([String(text || "")], { type: type || "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    return true;
  }

  function plain(value) {
    if (value === null || value === undefined || value === "") return "-";
    return String(value).replace(/\r\n/g, "\n");
  }

  function plainList(value) {
    return Array.isArray(value) && value.length ? value.map(plain).join(", ") : "-";
  }

  function safeFilenamePart(value) {
    return String(value || "")
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^a-zA-Z0-9._-]/g, "")
      .replace(/-+/g, "-");
  }

  function formatLatency(ms) {
    const number = Number(ms);
    if (!Number.isFinite(number)) return "-";
    return number >= 1000 ? `${(number / 1000).toFixed(1)}s` : `${Math.round(number)}ms`;
  }

  const exported = {
    buildMarkdownReport,
    buildAuditJson,
    makeReportFilename,
    copyText,
    downloadText,
    plain,
    safeFilenamePart,
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = exported;
  }
  if (typeof window !== "undefined") {
    window.AnchorWorkspaceExport = exported;
  }
})();

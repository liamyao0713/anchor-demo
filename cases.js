/* AnchorAI · migrated v40 case gallery behaviour.
 *
 * Source: inline <script> of index.html.backup-20260825-before-workspace-clean.html.
 * The handler bodies are kept as they were, because the migrated markup still calls
 * them through inline onclick/onchange attributes. Two things are deliberately new:
 *
 *   1. setPage() scrolls to the top of the case gallery instead of the top of the
 *      document. On the old page the gallery was the whole page; here it sits below
 *      the workspace, so scrolling to 0 would throw the reader out of the section.
 *   2. Language follows the workspace toggle. The old page owned document.body's
 *      class list; that is now the workspace's, so the gallery mirrors
 *      #anchor-workspace[data-ui-language] onto #anchor-cases[data-lang] instead.
 *
 * No global name here is defined by workspace-*.js or live-chat.js.
 */
(function () {
  "use strict";

  var CASES_ID = "anchor-cases";
  var WORKSPACE_ID = "anchor-workspace";

  function gallery() {
    return document.getElementById(CASES_ID);
  }

  /* ---------- case paging ---------- */

  window.setPage = function setPage(q) {
    var root = gallery();
    if (!root) return;
    root.querySelectorAll(".page").forEach(function (p) {
      p.classList.toggle("active", p.id === "page-" + q);
    });
    root.querySelectorAll(".pnav").forEach(function (b) {
      b.classList.toggle("active", b.dataset.q === q);
    });
    root.scrollIntoView({ block: "start", behavior: "smooth" });
    scheduleEqualize();
  };

  /* ---------- LLM tab switching ---------- */

  window.setModel = function setModel(q, m) {
    var root = gallery();
    if (!root) return;
    root.querySelectorAll('.mwrap[data-q="' + q + '"]').forEach(function (w) {
      w.classList.toggle("active", w.dataset.m === m);
    });
    root.querySelectorAll('.mtab[data-q="' + q + '"]').forEach(function (t) {
      t.classList.toggle("active", t.dataset.m === m);
    });
    scheduleEqualize();
  };

  /* ---------- corrected-answer view switch (track / clean) ---------- */

  window.setCorrView = function setCorrView(btn, view) {
    var blk = btn.closest(".anchor-corr-block");
    if (!blk) return;
    blk.dataset.view = view;
    blk.querySelectorAll(".corr-view").forEach(function (v) {
      v.classList.toggle("active", v.classList.contains("corr-view-" + view));
    });
    blk.querySelectorAll(".cvbtn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.view === view);
    });
  };

  /* ---------- copy helpers ---------- */

  /* Read an element the way the reader sees it. innerText already skips the
     hidden half of a .zh-only / .en-only pair, but it falls back to textContent
     when the element is not being rendered -- which is exactly the case for the
     system prompt while its <details> is closed -- so pick the visible language
     explicitly instead of trusting the fallback. */
  function visibleText(el) {
    if (!el) return "";
    var lang = (gallery() && gallery().dataset.lang) === "zh" ? "zh" : "en";
    var scoped = el.querySelector(lang === "zh" ? ".zh-only" : ".en-only");
    var source = scoped || el;
    return (source.innerText || source.textContent || "").trim();
  }

  function flashCopied(btn, text) {
    navigator.clipboard.writeText(text).then(function () {
      var orig = btn.innerHTML;
      btn.innerHTML = "✓ Copied";
      setTimeout(function () { btn.innerHTML = orig; }, 1600);
    }).catch(function (e) {
      alert("Copy failed: " + e);
    });
  }

  /* The question alone. The label above these blocks promises exactly this, so
     it must not drag the ~19 lines of system prompt along with it. */
  window.copyQuestion = function copyQuestion(btn) {
    var box = btn.closest(".prompt-box");
    if (!box) return false;
    var user = box.querySelector(".prompt-user");
    if (!user) return false;
    var clone = user.cloneNode(true);
    clone.querySelectorAll(".copy-btn").forEach(function (b) { b.remove(); });
    var lang = (gallery() && gallery().dataset.lang) === "zh" ? "zh" : "en";
    var scoped = clone.querySelector(lang === "zh" ? ".zh-only" : ".en-only");
    flashCopied(btn, ((scoped || clone).textContent || "").trim());
    return false;
  };

  /* The locked prompt plus the question, for reproducing a case in another LLM. */
  window.copyPrompt = function copyPrompt(btn) {
    var box = btn.closest(".prompt-box");
    if (!box) return false;
    var sys = visibleText(box.querySelector(".prompt-sys-full"));
    var user = box.querySelector(".prompt-user");
    var usr = "";
    if (user) {
      var clone = user.cloneNode(true);
      clone.querySelectorAll(".copy-btn").forEach(function (b) { b.remove(); });
      var lang = (gallery() && gallery().dataset.lang) === "zh" ? "zh" : "en";
      var scoped = clone.querySelector(lang === "zh" ? ".zh-only" : ".en-only");
      usr = ((scoped || clone).textContent || "").trim();
    }
    flashCopied(btn, "[SYSTEM PROMPT]\n" + sys + "\n\n[USER QUESTION]\n" + usr);
    return false;
  };

  /* ---------- column sizing ---------- */

  /* A/B/C panel bodies use CSS fixed heights and internal scrolling. Keep this hook to
     clear stale inline sizing from older versions after page/model/lang changes. */
  window.v7EqualizeCols = function v7EqualizeCols() {
    var root = gallery();
    if (!root) return;
    root.querySelectorAll(".v7-cols .v7-col-body").forEach(function (b) {
      b.style.height = "";
      b.style.overflowY = "";
    });
  };

  window.v7Slide = function v7Slide(cb) {
    var c = cb.closest(".v7-col-b");
    if (c) c.classList.toggle("show-clean", cb.checked);
    window.v7EqualizeCols();          // clean/track differ in length -> re-fit
  };

  function scheduleEqualize() {
    setTimeout(window.v7EqualizeCols, 0);
  }

  /* ---------- language: follow the workspace toggle ---------- */

  function applyLanguage(lang) {
    var root = gallery();
    if (root) root.dataset.lang = lang === "zh" ? "zh" : "en";
  }

  function workspaceLanguage() {
    var ws = document.getElementById(WORKSPACE_ID);
    return (ws && ws.dataset.uiLanguage) || "en";
  }

  function watchLanguage() {
    var ws = document.getElementById(WORKSPACE_ID);
    if (!ws || typeof MutationObserver !== "function") return;
    new MutationObserver(function () {
      applyLanguage(workspaceLanguage());
      scheduleEqualize();
    }).observe(ws, { attributes: true, attributeFilter: ["data-ui-language"] });
  }

  /* ---------- init ---------- */

  function init() {
    applyLanguage(workspaceLanguage());
    watchLanguage();
    setTimeout(window.v7EqualizeCols, 60);
  }

  var rz;
  window.addEventListener("resize", function () {
    clearTimeout(rz);
    rz = setTimeout(window.v7EqualizeCols, 150);
  });

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
  window.addEventListener("load", init);
})();

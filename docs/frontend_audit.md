# Anchor AI Frontend Audit

Date: 2026-08-20

## Repository State

- Local path: `/Users/achieve/anchorAI-demo`
- GitHub Pages URL: `https://liamyao0713.github.io/anchorAI-demo/`
- Git remote: `https://github.com/liamyao0713/anchorAI-demo.git`
- Source branch inspected: `main`
- Latest commit inspected: `9d1cc44 Fix: high/low-RISK no longer GRADE-colored; confirmed-correct cites render green (no red strikethrough)`
- Backup tag created before frontend changes: `demo-static-backup-20260820`
- Development branch created: `feat/live-anchor-chat`

## Project Structure

```text
anchorAI-demo/
├── index.html
└── docs/
    └── frontend_audit.md
```

The published demo is currently a single static HTML file. CSS and JavaScript are embedded inline in `index.html`; there are no separate JS, CSS, package, build, or data files.

## Current Runtime Behavior

The page is a pre-rendered static comparison demo. It does not call a backend, does not call `/api/chat`, and does not use `fetch`, `XMLHttpRequest`, `axios`, a form submit, or external JSON data.

The current JavaScript only toggles already-rendered DOM:

- `setLang(l)`: switches Chinese/English text visibility.
- `setPage(q)`: switches the selected case page.
- `setModel(q, m)`: switches the selected model block inside a case.
- `copyPrompt(btn)`: copies the hardcoded system prompt and hardcoded user question.
- `v7Slide(cb)`: toggles Anchor corrected answer between track and clean views.
- `v7EqualizeCols()`: equalizes the three comparison column heights on wide screens.

## Important Files And Entrypoints

- HTML entry: `index.html`
- CSS entry: inline `<style>` in `index.html`, roughly lines 3-513.
- JavaScript entry: inline `<script>` in `index.html`, roughly lines 515-550.
- Main static content: line 556 contains most pre-rendered page/case/model HTML.

## Current Page Model

The demo contains 6 static case pages:

- `page-N1`: Case 1, IPF / nerandomilast
- `page-O`: Case 2, OSA / CPAP
- `page-ICS`: Case 3, ICS pneumonia/candidiasis risk
- `page-CFMOD`: Case 4, CFTR modulators
- `page-MESOIO`: Case 5, mesothelioma immunotherapy
- `page-CAPSTEROID`: Case 6, severe CAP corticosteroids

Model tabs are hardcoded `button.mtab` elements. Most cases have 5 model blocks: DeepSeek, Gemini, OpenEvidence, ChatGPT, Claude. `ICS` currently has 4 model blocks.

Each model block is a hardcoded `div.mwrap[data-q][data-m]` containing a three-column layout:

- Column A: `div.v7-col.v7-col-a`
- Column B: `div.v7-col.v7-col-b`
- Column C: `div.v7-col.v7-col-c`

## UI Element Audit

### User Question Input

No live user question input exists.

The current "User question" is displayed as static text in `div.prompt-user` inside each case. It is not an `<input>`, `<textarea>`, or editable field.

Current behavior:

- One `div.prompt-user` per case.
- The content is hardcoded in `index.html`.
- `copyPrompt(btn)` reads `.prompt-user.innerText` only for copying the demo prompt.

Future live chat implication:

- A real question input must be added later, probably as a `<textarea>` or equivalent controlled input.
- The new input should map to the backend request field `question`.

### Send Button

No live Send button exists.

Current buttons are only:

- Language buttons: `button.lang-btn`
- Case navigation buttons: `button.pnav`
- Prompt copy buttons: `button.copy-btn`
- Model tab buttons: `button.mtab`
- Track/clean toggles: checkbox inputs inside `label.v7-switch`

There is no form submit button and no button that sends a question to a backend.

Future live chat implication:

- A real Send button must be added later.
- It should call the backend `POST /api/chat` endpoint.

### A: Raw / Uncorrected AI Answer Area

Current selector:

- `div.v7-col.v7-col-a`
- Header class: `div.v7-col-h.v7-h-a`
- Body class: first `div.v7-col-body` inside column A
- Answer body class: `div.v7-body.v7-ans`

Current label:

- Chinese: `未矫正 · 原话`
- English: `Uncorrected · {model}`

Current data source:

- Fully hardcoded model output stored in static HTML under each `div.mwrap[data-q][data-m]`.
- Yellow highlights are pre-rendered `mark` elements inside the static Raw Answer.

Future API mapping:

- A <- `raw_answer`
- `raw_answer.text` should fill the A body.
- `raw_answer.provider` and `raw_answer.model` should fill the model/provider label.
- `raw_answer.grounded_by_anchor` must remain visibly false/not Anchor-verified.
- `raw_answer.verification_status` should be displayed as `uncorrected`.

### B: Anchor Corrected Answer Area

Current selector:

- `div.v7-col.v7-col-b`
- Header class: `div.v7-col-h.v7-h-b`
- Track view: `div.v7-track-view`
- Clean view: `div.v7-clean-view`
- Corrected references: `details.refs-block.anchor-refs.refs-collapse`
- Track/clean toggle: checkbox with `onchange="v7Slide(this)"`

Current label:

- Chinese: `Anchor 校正版 · KB 锚定`
- English: `Anchor-corrected · KB-grounded`

Current data source:

- Fully hardcoded Anchor-corrected prose in `div.v7-track-view` and `div.v7-clean-view`.
- Inline edit annotations use classes such as `ed`, `ed-del`, `ed-ins`, and `ed-tag`.
- Corrected references are hardcoded list items inside `details.refs-block.anchor-refs.refs-collapse`.

Future API mapping:

- B <- `corrected_answer`
- `corrected_answer.text` should fill the clean corrected answer.
- `corrected_answer.evidence_status` should drive status display: `sufficient`, `partial`, `insufficient`, `conflicting`, or `unavailable`.
- If `evidence_status` is `insufficient` or `unavailable`, B must not copy Raw Answer as if verified. It should show the backend's explicit insufficient/unavailable corrected-answer message.

### C: Audit / Difference / Citation Area

Current selectors:

- Main column: `div.v7-col.v7-col-c`
- Header class: `div.v7-col-h.v7-h-c`
- Correction cards: `div.card` and `div.v7-autocard`
- Citation verification table: `table.ctab`
- Outcome comparison table: `table.octab`

Current label:

- Chinese: `对比审计 · 矫正轴`
- English: `Diff audit · correction axes`

Current data source:

- Correction cards are hardcoded in HTML.
- Citation verification rows are hardcoded `table.ctab` rows with PubMed links.
- Larger LLM-vs-KB outcome comparisons are hardcoded `table.octab` tables.

Future API mapping:

- C <- `corrections / claims / citations / audit`
- `corrections[]` should fill the correction cards.
- `claims[]` should fill claim status rows or cards.
- `citations[]` should fill the citation/reference list and PubMed/evidence links.
- `audit` should fill diff/audit metadata: what changed, why, evidence IDs, status, and latency/errors where relevant.

## A/B/C API Mapping Summary

```text
A Raw / Uncorrected AI Answer
  <- response.raw_answer

B Anchor Corrected Answer
  <- response.corrected_answer

C Audit / Difference / Citation
  <- response.corrections
  <- response.claims
  <- response.citations
  <- response.audit
```

## Current Hardcoded Demo Data Flow

The current static data is embedded directly in the DOM:

1. Case buttons call `setPage(q)`.
2. Model buttons call `setModel(q, m)`.
3. The selected `section.page` and `div.mwrap` are shown by toggling the `active` class.
4. Column A shows hardcoded LLM verbatim text.
5. Column B shows hardcoded Anchor corrected text and hardcoded corrected references.
6. Column C shows hardcoded correction cards, citation checks, and LLM-vs-KB comparison tables.
7. No network request is made at any point.

## Risks Before Live API Integration

- There is no live input and no send action yet.
- The existing HTML is large and mostly pre-rendered on one line, so targeted edits must be careful.
- The UI already expresses the correct product model with A/B/C columns, but the data is static.
- Future work should preserve the visual layout while replacing or supplementing the static demo blocks with a live chat mode.
- The frontend must not expose API keys or direct SQLite access.

## Recommended Next Frontend Strategy

For the MVP, add a live chat panel that reuses the existing visual language:

- Add a real question textarea and Send button near the top of the page.
- Keep A/B/C as the live response layout.
- Add a small frontend config constant for backend API URL, to be replaced later by deployment-specific config.
- Call `POST /api/chat` with `{ "question": "..." }`.
- Render `raw_answer.text` in A.
- Render `corrected_answer.text` and `evidence_status` in B.
- Render `claims`, `corrections`, `citations`, and `audit` in C.
- Handle `429`, `LLM_UNAVAILABLE`, `DATABASE_UNAVAILABLE`, and `RETRIEVAL_UNAVAILABLE` using the backend's unified error shape.

This step did not change `index.html` or page visuals.

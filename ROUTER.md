> Historical routing record. Root AGENTS.md was removed at the user's request; the current story-generation milestone does not activate the old agent workflow.

# Yahari Script — P1-d routing

## Objective and source
Harden the existing hosted authoring journey at 360–430 px. Canonical source is the Sites repository; the P1-c archive is a divergent historical snapshot and must not overwrite existing draft, preview, or import-safety work.

## Runtime
W2: independent child contexts and explicit model-selection arguments are exposed. A2 read-only review requested `gpt-6-sol`; spawn accepted, actual backend identity/effort is not independently reported. Parallel subagents supported by interface; this milestone uses one reviewer. Main agent owns all Site edits and publishing.

## Boundaries
Keep Core and Adapter semantics, portable format, local drafts, asset preview and import guards. Preserve current green chat visual design. No new Adapter, cloud persistence, or renderer redesign.

## Tasks and ownership
- A3 lead: resolve source divergence, acceptance, integration.
- A2 lead: mobile shell, navigator/diagnostics sheets, visual viewport sizing, picker focus and touch controls.
- A2 child `mobile_review`: bounded read-only review; no writable ownership.
- T0 lead: compile, regression and static smoke; browser journey when runtime permits.

## Acceptance
Reachable navigation, undo/redo, diagnostics and export at mobile widths; picker can close without document mutation; IME completion must not issue editor commands; normal desktop shortcuts preserved. Existing preview/import regression remains green. Physical soft-keyboard validation is a separate unverified gate unless actually performed.

## Escalation
Re-enter A3 if changes require document semantics or format changes, lost existing features, or tests reveal source divergence. Never label an environmental browser failure as a product failure.

## Active increment — character recovery
User explicitly requests merging omitted cast/actions and completing missing imagery. Recover five-character pack and showcase from P1-c while keeping live editor/preview/import code. A2 asset worker `recover_character_assets` (requested gpt-6-sol; backend identity not reported) may download and inspect pinned source assets outside Site. Main agent owns Site files and deployment. Additive pack IDs remain 0.1.0 for portable compatibility; never overwrite existing cast IDs or document text. Acceptance: every declared pose/reaction has mapped loadable art, five-role showcase validates and compiles, existing project identities survive, legacy/custom projects can access added cast, source provenance and checksums retained.

## 2026-09-26 correction
User requests single-agent execution. Root owns remaining implementation, asset verification and publishing; no child agents. Previous cast recovery was unfinished and never published. Completion requires all 26 action resources resolving and successful deployment.

## Dialogue opening synchronization
Root-only execution. Derive each paragraph opening from cast binding and leading actions without changing portable authoring schema. Reset transient poses at speaker boundaries, preserve explicit background cues, prepare decoded visuals before text or timed waits. Reject stale asynchronous completion on rewind/restart/close. Acceptance includes delayed image readiness, inline actions, reveal-all, repeat speakers and cancellation regressions.

## Whole-rehearsal preload
Root only. Collect plan resources, deduplicate and preload with bounded concurrency and actual decoded-asset progress before any playback. Reuse decoded local assets within this session. Failure exposes retry/explicit partial playback; close cancels pending loads and must never start playback. Keep line-level readiness as fallback.

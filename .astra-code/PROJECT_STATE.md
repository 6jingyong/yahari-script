# Yahari Script — current project state

Updated 2026-09-29. Canonical mutable working state is this Google Drive project folder. GitHub is a version-control/publication target and may intentionally lag until an explicit sync is requested.

## Goal and milestone
Adapter-bound rich script authoring and Courtroom performance compilation.
This milestone hardens portable project import before further feature expansion.

## Current architecture
- Core: portable project envelope, typed dialogue/cue/token data, normalization and core diagnostics; no Courtroom renderer rules.
- Adapter: capability registry, context-aware action candidates, validation/quick fixes and deterministic Courtroom instruction plan.
- Editor core: model-first mutations, grouped undo/redo.
- Browser app: chat composer, editable dialogue, action chips, inspectors, import/export, device-local drafts and project persistence.
- Preview: Courtroom assets and paragraph playback, grapheme-aware text, waits and cancellation.
- Static TypeScript output; no server-side project database or cross-device synchronization.

## Invariants
- Project chooses a versioned Adapter and Content Pack before authoring.
- Invalid semantic actions remain data; diagnostics and strict compilation expose errors.
- Missing installed dependencies open structurally sound projects read-only.
- Structural corruption and ambiguous identity are rejected before replacing active state.
- Block/token identity uniqueness is per document, not global across documents.

## Evidence and responsibilities
Owner implemented and integrated. A separate read-only agent investigated and reviewed the import boundary. Deterministic verification uses strict TypeScript, Node tests and browser-module smoke checks. See IMPLEMENTATION_STATUS.md and contracts/import-safety.md.

## Remaining limits / next milestone
No UI automation was performed in this import-focused change. Current tests do not establish browser editing feel or cross-browser IME behavior. Next recommended milestone is a focused authoring journey acceptance pass (Chinese IME, draft/action insertion, undo, import/export and reload) before new adapters or a large editor rewrite. Multi-document archives are preserved, but only the entry document is editable. localStorage is device-local and can fail or be cleared.

## Mobile increment
Root AGENTS.md was removed at the user's request for the story-generation milestone. Prior routing policy is historical, not an active instruction. P1-d controls and IME guard are implemented, preserving the hosted preview/import/draft features. P1-c zip is divergent; never wholesale overwrite canonical source from it. Automated checks: 47 passing, 26 browser modules. Phone acceptance pending; supervised browser preview failed due to missing live-server.

## 2026-09-26 cast recovery (supersedes earlier counts)
- Root completed integration directly; no subagent execution in this correction. Previous recovery remained uncommitted and unpublished.
- Five actors: Phoenix, Edgeworth, Maya, Judge and Larry (witness); 26 actions with local images, three scenes and correct stations. Witness shocked and nervous intentionally share the source nervous expression; actions are not claimed as 26 unique animations.
- Built-in old sample cast upgrades additively; custom/imported cast identities remain intact, and missing built-in characters are now selectable directly from the speaker picker. Existing dialogue, aliases and drafts remain intact. Five-person showcase opens independently.
- Verification: 52 passing tests, 28 resolved modules, 34 images verified for source hash and crop bounds; composited all 26 actions for manual asset inspection. Browser/mobile interaction remains unverified (previous managed preview infrastructure unavailable).
- Preview uses representative frames; full animation and audio playback are not implemented.

## 2026-09-26 dialogue opening synchronization
Each paragraph resolves cast-bound default station, camera and normal pose; leading pose/reaction/focus tokens override that opening. Explicit scene cues persist. Transient poses reset at every dialogue boundary, including repeated speakers. Decoded image layers are prepared before revealing text, timed waits, or reveal-all completion. Slow/failed assets have a 10-second terminal timeout and explicit failure status; old asynchronous callbacks cannot revive a rewound or closed playback. No project schema changes or authored-text rewrites.
Verification: 57 tests pass, 29 browser modules and 34 source-checked assets pass. New regressions cover first-frame readiness, click bypass, inline image delays, final reveal, cancellation, defaults and explicit overrides. Browser/mobile interaction not verified.

## 2026-09-26 whole-rehearsal preload
Preload the deduplicated plan image set before playback with four concurrent requests and completed-image progress. Decoded representative frames are reused across dialogs in the current page session. Failed images expose retry or explicit partial playback; closing cancels active loads and prevents queued work/start. Existing per-line readiness remains a fallback. 60 tests pass; 30 browser modules and all 34 content assets verified. Browser/mobile interaction remains unverified.


## 2026-09-29 speaker picker simplification
- Speaker selection now exposes every built-in Courtroom character directly. Existing project cast identities remain visible first; built-in characters not yet in the manifest are shown from the content pack and are added automatically when selected. Narration remains available.
- Removed the separate “添加角色” button/dialog. The speaker grid has a bounded height and vertical scrolling for larger casts.
- Removed obsolete milestone/handoff Markdown: root `TASKS.md`, root `ROUTER.md`, `docs/P1A_REVIEW_CHECKLIST.md`, `docs/P1B_RELEASE_NOTES.md`, `docs/P1D_VERIFICATION.md`, and `docs/Yahari_Script_Project_Handoff_v0.6.md`. Current architecture/status/roadmap/story-generation/assets documentation is retained.
- Local validation before Drive write-back: TypeScript parse/transpile succeeds; isolated `tsc --noResolve` reports only expected unresolved project imports plus pre-existing DOM iterable lib warnings; HTML IDs are unique; removed control IDs/functions are absent; speaker list scroll rules are present. Full repository `npm run check` was not rerun from the temporary sandbox because the complete Drive tree was not materialized locally.

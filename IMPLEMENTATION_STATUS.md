## Automatic deployment increment (2026-09-27)

- Static URLs are now subpath-safe, so the same build can run under the legacy root-hosted Site or a GitHub Pages project path.
- `Verify` remains the quality gate; a successful `main` run triggers `Deploy Pages`, which rebuilds `out` and publishes through the official Pages artifact/deploy actions.
- Until Pages is enabled once in repository Settings, deployment exits cleanly with setup guidance instead of making the repository verification red.
- Current verified state: 75 tests pass, 34 browser modules resolve, and 58 local images cover 9 bindable characters / 46 actions / 7 scenes with source hashes and crop bounds.
- The built-in “凌晨的通行证” now exercises all four newly added investigation scenes, including the detention interview room.\n- The material library adds Apollo Justice, Klavier Gavin, Ema Skye and Trucy Wright as opt-in presets while preserving the historical five-person default demo cast.

## Direct Chat edit increment (2026-09-27)

- Directory navigation now enters from the left side of the writing header; directory-only authoring shortcuts for stage cues and blank dialogue were removed so the directory remains navigation/project management.
- Courtroom content pack now exposes seven usable scenes. Four new repository-local original SVG scenes cover a law office, detention interview room, police records room and night corridor; provenance/hash checks include SVG assets.
- Added the built-in case “凌晨的通行证” to exercise all four new scenes through the normal chapter/scene/editor/rehearsal path.
- Presentation picker now exposes previously unreachable adapter capabilities: 1 s wait, emphasis, soft/strong flash, soft/strong shake, and camera focus for every bound cast member.
- Added GitHub Actions verification for direct Chat-to-repository edits. CI availability still depends on repository Actions settings.

## Story generation milestone (2026-09-27)

Implemented chapter/scene hierarchy, editable fold summaries, scene switching and isolated drafts, two-stage BYOK compatible model generation, scene validation, resumable drafts and reversible import. See docs/STORY_GENERATION.md for boundaries and verification. Real provider calls await a user-supplied API key. Root AGENTS.md removed per user request.

# Yahari Script — implementation status (2026-09-23)

## Current delivery
Chat-style structured authoring, contextual action picker, deterministic Courtroom compiler, portable project import/export and asset-backed Courtroom preview are implemented. The preview includes paragraph navigation, progressive grapheme text, explicit waits, and pending-update cancellation.

Architecture: Core document/project types → Adapter capability registry and validation → model-first EditorStore → browser authoring; the Courtroom-specific compiled plan feeds the preview. Core contains no renderer or Courtroom-specific semantics.

## Import safety milestone
- Deep cast-reference shape checks and optional field guards.
- Safe handling of malformed manifest document references.
- Supported schema and identity validation before legacy-document binding.
- Reject duplicate block/token IDs within a document and duplicate manifest identities; never silently renumber.
- Activation validates before changing active project state or persistence.
- Preserve unknown token types, invalid capability references, missing-dependency read-only opening, extension metadata and all project documents.

## Verification
45 Node tests pass, 0 fail (29 existing + 16 new).
Strict TypeScript build passes. Browser-module smoke resolves 26 modules; editor entry syntax check passes. Static publication output built.
A separate read-only agent investigated the boundary and reviewed the resulting patch.
No browser UI or localStorage integration automation was performed; data-flow review establishes that failed validation returns before activation side effects.

## Known limits
Only the entry document is editable. Storage is local to the browser. No branching, collaborative editing, dependency installation, project library or general renderer SDK. Existing UI does not expose text marks. Authoring feel and cross-browser IME acceptance remain the next useful checkpoint.

## 2026-09-24 mobile increment

See docs/P1D_VERIFICATION.md for current evidence: 47 tests and 26 browser modules pass; mobile directory/diagnostics/picker and IME guard implemented. Browser preview infrastructure blocked visual QA. Physical phone and five-character acceptance remain open. Latest Work AGENTS.md and W2 routing evidence are in repository root.

## 2026-09-26 cast recovery (supersedes earlier counts)
- Root completed integration directly; no subagent execution in this correction. Previous recovery remained uncommitted and unpublished.
- Five actors: Phoenix, Edgeworth, Maya, Judge and Larry (witness); 26 actions with local images, three scenes and correct stations. Witness shocked and nervous intentionally share the source nervous expression; actions are not claimed as 26 unique animations.
- Built-in old sample cast upgrades additively; custom/imported casts can use + Role. Existing dialogue, aliases and drafts remain intact. Five-person showcase opens independently.
- Verification: 52 passing tests, 28 resolved modules, 34 images verified for source hash and crop bounds; composited all 26 actions for manual asset inspection. Browser/mobile interaction remains unverified (previous managed preview infrastructure unavailable).
- Preview uses representative frames; full animation and audio playback are not implemented.

## 2026-09-26 dialogue opening synchronization
Each paragraph resolves cast-bound default station, camera and normal pose; leading pose/reaction/focus tokens override that opening. Explicit scene cues persist. Transient poses reset at every dialogue boundary, including repeated speakers. Decoded image layers are prepared before revealing text, timed waits, or reveal-all completion. Slow/failed assets have a 10-second terminal timeout and explicit failure status; old asynchronous callbacks cannot revive a rewound or closed playback. No project schema changes or authored-text rewrites.
Verification: 57 tests pass, 29 browser modules and 34 source-checked assets pass. New regressions cover first-frame readiness, click bypass, inline image delays, final reveal, cancellation, defaults and explicit overrides. Browser/mobile interaction not verified.

## 2026-09-26 whole-rehearsal preload
Preload the deduplicated plan image set before playback with four concurrent requests and completed-image progress. Decoded representative frames are reused across dialogs in the current page session. Failed images expose retry or explicit partial playback; closing cancels active loads and prevents queued work/start. Existing per-line readiness remains a fallback. 60 tests pass; 30 browser modules and all 34 content assets verified. Browser/mobile interaction remains unverified.

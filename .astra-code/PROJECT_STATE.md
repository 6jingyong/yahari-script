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

## 2026-09-29 scene extension and editor image loading
- Added two new 4:3 generated scenes: apartment stairwell at night and courthouse consultation room. The content pack now exposes 16 characters, 128 actions and 23 backgrounds; existing resource IDs and project files remain compatible. Original PNGs are retained in `art-source/`, with 768×576 JPEGs in `assets/`.
- The editor now shares a 1024×512 action thumbnail atlas for action chips and built-in speaker avatars. This 665,423-byte PNG replaces eager full-resolution action-sheet requests in the authoring view. Rehearsal still loads the full sheets through its deduplicated progress-controlled preload.
- Rebuild the thumbnail atlas with `python scripts/build-action-thumbnails.py` after changing action sheets, then update the hash in `assets/sources.json`. Scene rebuilding uses `scripts/build-chibi-art.py`; `ART_DIRECTION.md` records both paths.
- Local verification: `npm run check` passed (91 tests, 44 browser modules, 89 local assets with hashes and crop bounds); `scripts/build-static.mjs` copied new assets. Browser interaction was not verified because this runtime had no Chromium executable and the browser download failed. GitHub publication was not requested, so the hosted page may still show an older revision.

## 2026-09-29 character expansion
- Added two opt-in Courtroom characters: Godot (prosecution station) and Dahlia Hawthorne (witness station), each with an original transparent 4×2 eight-action sheet and a separate portrait. No existing cast ID, action mapping, scene, or sample dialogue was changed. The pack now contains 18 characters, 144 character actions, 23 backgrounds and 192 resources.
- New source sheets and portraits are in `content-packs/courtroom-demo/art-source/`; shipped PNGs are in `assets/`. `action-sheets.json`, `catalog.json` and `sources.json` include the new identities, frames and hashes. The editor thumbnail atlas was rebuilt to 1152×512; its CSS scale is now derived from the pack character count instead of a fixed 16 columns.
- Local verification: `npm run check` passed (91 tests, 44 browser modules, 93 content assets); visual inspection of both eight-cell sheets, derived portraits and thumbnail atlas; all old character, background and resource definitions were compared against the previous Drive snapshot and remain equal. Browser/mobile UI interaction remains unverified in this runtime.

## 2026-09-29 six-character expansion
- Added six opt-in characters: Athena Cykes (希月心音), Simon Blackquill (夕神迅), Kristoph Gavin (牙琉雾人), Winston Payne (亚内武文), Adrian Andrews (华宫雾绪), and Iris (绫芽). Each has one transparent 4×2 sheet with eight independently drawn poses and a separate 512×384 portrait. New total: 24 characters, 192 actions, 23 scenes and 246 resource mappings.
- Athena and Kristoph use the defense station; Blackquill and Payne use prosecution; Adrian and Iris use witness. The existing sample cast is unchanged. All 18 earlier character definitions, 23 backgrounds and 192 earlier resource mappings were compared against the pre-change Drive snapshot and are unchanged.
- Original PNGs and portraits are retained in art-source; shipped assets, action-sheets.json, catalog.json, sources.json and documentation are updated. Editor thumbnails rebuilt to 1536×512 (1,032,047 bytes), using the existing dynamic character-count sizing. Full-resolution sheets remain rehearsal-preloaded on demand.
- Validation: npm run check passed (91 tests, 44 browser modules, 105 local images with valid hashes and crop bounds). All 48 new crops contain nonempty alpha and are distinct within their character. Generated sheets and the rebuilt thumbnail atlas were visually inspected; static output rebuilt. Browser/mobile interaction remains unverified because this runtime has no installed browser executable. GitHub was not changed or published by this task.

## 2026-09-29 authoring reliability follow-up
- Character action captions now resolve from the active character's Content Pack definitions, including picker, dialogue chips, and inspector, with legacy labels retained as a fallback. This avoids new action IDs leaking into user-facing labels and respects character-specific wording.
- Failed action-thumbnail decoding no longer permanently caches a rejected promise: a later interaction can retry while existing fallback icons remain visible. No automatic retry loop was added.
- Added action-label regressions covering all 192 installed actions and character-specific label overrides. Full npm run check and static output build passed; 44 browser modules and 105 images passed reference/hash/crop validation.
- The 24-character catalog was compared byte-for-byte with the current Drive file. Changed source files were read back from Drive before write-back to check for concurrent edits.
- Browser/mobile journey and load-time measurements remain unverified: this runtime has no browser executable. No GitHub synchronization or publication was performed.


## 2026-09-29 non-mobile priority completion
- Completed the remaining non-phone priorities from the current authoring pass. The Courtroom pack remains at 24 characters, 192 character actions and 23 scenes.
- Replaced the nine remaining vector-atlas character runtime sheets with generated raster/WebP derivatives while preserving stable character/action/resource IDs and keeping editable source art.
- Runtime image delivery is reduced to referenced WebP assets plus the compact shared action-thumbnail atlas; original PNG/JPEG source assets remain available for editing and provenance checks.
- Added dialogue-level “rehearse from here”, “replay current paragraph”, and “edit current paragraph” flows while preserving preceding persistent scene/audio state and avoiding replay of earlier transient effects.
- Added an explicit model connection probe that sends no story text, shows elapsed request time, supports cancellation, and ignores cancelled/late/malformed responses. No live paid provider call was made because no user API key was available in this execution environment.
- Latest deterministic verification recorded in `IMPLEMENTATION_STATUS.md`: `npm run check` passes with 96 tests and zero failures; current content/material checks remain green. Browser/physical-phone acceptance is intentionally left to the user.
- GitHub was not synchronized or published in this pass. Google Drive remains the canonical working state until an explicit GitHub sync is requested.


## 2026-09-29 model-source semantics correction
- One-click story adaptation now distinguishes ChatGPT account quota from API billing. The authoring UI exposes only `OpenRouter API` and `ChatGPT 账户额度` as primary model sources; the previous ordinary OpenAI API-key/custom-provider choices are removed from the main flow.
- OpenRouter remains the verified direct browser transport. Its API key remains memory-only.
- ChatGPT-account mode never accepts an OpenAI API key and instead targets a same-origin `/api/chatgpt/responses` account bridge. When that bridge is absent, the UI fails explicitly and tells the user to use OpenRouter rather than silently changing billing semantics.
- As of 2026-09-29, official ChatGPT Sites documentation exposes authenticated identity to Site server code but does not document general Plus/Pro inference quota delegation. The bridge is therefore an explicit integration boundary, not a claim of currently available official inference.
- Local validation for this change: `model.ts` standalone TypeScript check passes; `story-dialog.ts` `--noResolve` validation reports only the expected unresolved project imports. Full repository `npm run check` could not be rerun because the complete canonical Drive tree is not materialized in this chat sandbox.
- ChatGPT Sites publication was requested next; deployment itself requires the Sites workflow available in ChatGPT Work or desktop Codex. This chat surface does not expose a Sites deployment action.

## 2026-09-29 Drive cleanup and GitHub sync
- Removed 114 old PNG/JPEG/SVG derivatives from `assets/` and five superseded low-resolution draft files; editable source art remains in `art-source/`. `sources.json` now registers only 77 active WebP images. `build-web-assets.py` prunes intermediates after a rebuild. A truncated `art-source/yogi-actions.png` was restored from its verified, same-dimension generated PNG derivative; a fresh source-to-WebP rebuild and full check passed in an isolated copy.
- Current local deterministic check: 98 tests / 0 failures, 44 browser modules and 77 source-checked runtime images; static output builds. Browser/phone acceptance and a live provider request remain open.
- GitHub-only `.github` Drive sync tooling is preserved. The GitHub commit and Pages result are recorded separately after the push is verified.

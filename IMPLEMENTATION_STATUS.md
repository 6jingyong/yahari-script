## 2026-10-14 — Character callouts bound to actions

Added 17 local Japanese recordings from Court Records for nine built-in characters, with source URLs, durations and SHA-256 provenance. Objection gestures automatically match the visual character rather than story names; unavailable voices use the original chip effect. Gesture tokens support per-use sound/silence and cast defaults, audition, persistence and undo. The voice library exposes browsing, audition and downloads without irrelevant synthesis controls.

Recorded clips are pre-decoded, cached and played with the gesture, followed by an explicit voice-duration wait. Direct voice tokens also wait. Fast-forward, replay, rewind, mute and close cancel speech without queued bursts. Offline HTML embeds the recordings. Validation: 188 tests / 71 browser modules, 17 distinct recording hashes/embedded bytes and browser decoding pass; desktop/mobile binding, role matching, order, skip/replay/mute, defaults/undo and offline export are verified. [Action sounds](docs/ACTION_SOUNDS.md).

## 2026-10-14 — Automatic dialogue blips and cleanup

Every dialogue and narration line inherits an original low 8Bit text blip. Work defaults, cast overrides and per-line metadata support switching and deliberate silence, and compilation carries the resolved voice on each paragraph. Audio follows grapheme reveal, ignores punctuation/whitespace and pauses, emits no skipped-text burst, reuses buffers and stops on mute/close. Fresh playback starts with sound enabled where the browser permits it; explicit mute preferences survive reopening and scene changes. Avatar settings and a per-line select control are visible in the writer; 375px dialogs retain their return button.

Validation: 181 tests / 69 browser modules plus existing asset/export checks pass. Browser verification covers low/high audible-buffer signatures, inheritance, override/silence, reveal-all, cache reuse, save/reload, portable bundles and offline HTML. Removed the superseded hidden structure dialog, 93 unused CSS rules and old local QA artifacts; retained works, art sources, accounts and recovery data. [Cleanup inventory](docs/CLEANUP_20261014.md).

## 2026-10-14 — Permanent flow workspace and categorized 8Bit audio

Work management uses a single flow diagram without dialogue lists or character lanes. Work/chapter/scene forms and continuation settings are visible, common actions are permanent, and one save action/Ctrl+S saves all forms. Removed scene-card view, form tabs, duplicate titles/entry points/save buttons and irrelevant actions. Interaction remains optional, including multiple options sharing one continuation; reader choices stay inside the stage.

Audio now contains 35 original 8Bit effects and 16 music loops categorized by narrative use. Pulse/triangle/noise voices, usage descriptions, category/search filters, a persistent settings panel, shared library/player synthesis and mono 8-bit WAV downloads are implemented. Existing sound IDs, custom settings and hidden entries remain compatible; full old libraries gain new presets up to the existing 80-item limit. Category, usage and mixed-voice data travel with works and parameter packs.

Validation: 174 tests, 67 browser modules, asset/export fixtures and static build pass. Browser checks cover permanent forms, Ctrl+S/reload, 51 voices, filtering, live WebAudio buffers, sound edit/apply/bundle and WAV downloads, 375px layouts, offline stage choices and an ending. Windows sandbox loopback/browser restrictions required running the isolated browser and local integration checks outside the sandbox. Earlier milestones below remain historical.

## 2026-10-14 — Independent work management and branching player

Replaced the directory with a full work/chapter/scene/dialogue management workspace. Scene exits support ordered continuation, explicit jumps, 2–8 reader choices, convergence and named endings. Core validates references and diagnoses unreachable/endless routes; adapter-neutral narrative sessions validate saved paths and remove choices on backtracking. Branching files use version 0.9 while 0.7/0.8 remain readable; character/asset installation preserves that version. The independent player opens work files or local works, stores content-specific progress and exposes no editing controls. HTML export embeds runtime modules and used images for offline sharing; static output includes the player.

Story generation discards model-suggested visual bindings and requires each author selection, showing portrait/name correspondence. Confirmation is tied to story IDs/names/material IDs, so stale/legacy flags cannot bypass it. Mock end-to-end generation preserves story names after import. Added the hand-written six-scene, two-choice, two-ending sample [雨停之前](examples/branching-story/README.md).

Validation: **162 tests, 65 browser modules**, existing assets and real exported examples pass; static output builds. Edge checks cover metadata/branch saving, Ctrl+S, reload, chapter/scene addition, dialogue navigation, canceled unsaved departure, both endings, backtracking and progress restore. Real `.yahari` export/import works in a fresh context. The ~2 MB HTML plays to an ending while offline with no HTTP requests. Management/choice screens fit 375px. No real model request was sent. Scene-end branches are implemented; evidence conditions, hidden choices and AI branch planning remain future work. See [branching documentation](docs/BRANCHING_STORIES.md).

## 2026-10-13 — Unified built-in asset management

All 24 built-in characters / 192 actions / 23 scenes and 16 synthesized audio presets are available in the independent **素材管理** workspace. Built-in editing lazily crops atlas frames, preserves source identity, supports replacement/addition/removal and persistent hide/default restore. Optional character stage and scene foreground layers travel with standalone packs. Project adjustments aggregate into one embedded pack containing changed image bytes, preserving historical cast/action/background references; copied project IDs reuse their existing adjustment pack. Existing referenced actions and sounds are protected when applying changes. Audio supports labels, waveform, relative volume/tempo, additions, preview and portable JSON parameter packs; audio files and complete theme installation remain pending.

Centralized image policy and [authoring/format documentation](docs/素材制作与格式说明.md) specify supported PNG/JPEG/WebP, recommended canvases, bounds, WebP quality 0.76, size fallback and the separate built-in release encoding. IndexedDB v2 migration preserves prior material. Browser acceptance covers editing and rehearsal, unchanged bindings, remove/reload/restore, default restore retaining work copies, all four export types, fresh-context import/rehearsal, audio controls and 375px layouts. Actual exports validate and compile without credentials. Fixed composer action insertion to capture the current selection before focusing. Full check: **147 tests, 58 browser modules**, source crop/hash validation and prior exported-script comparisons pass. No image API call was made in this increment.

## 2026-10-12 — Independent asset workspace

Implemented character settings, editable multi-action images, reusable scene metadata, independent IndexedDB pack/Blob storage, bounded portable character/scene pack export/import, rights metadata, legacy owned-material collection and explicit installation into works. Browser mock generation tested portrait and reference-action output through save/export/new-context import/rehearsal, cancellation/402, deduplication, identity preservation and 375px layout. No actual image model was called. See [asset workspace](docs/ASSET_WORKSPACE.md) and [portable mock examples](examples/mock-image-assets/README.md). Full check: 137 tests and 54 browser modules. Complete theme packs, built-in role action overlays and story AI binding to original material remain pending.

# Current status — 2026-10-12

Project files and saving increment: multi-work IndexedDB library; SHA-256 keyed image Blobs; atomic project/assets/restore-point writes; auto/manual save and eight restore points; browser file saving or download; bounded CRC-checked `.yahari` ZIP STORE container with JSON compatibility and import preview. Duplicate imports create copies. The active editing scene is separate from the work's entry scene, fixing a historical scene-switch mutation caught by comparing actual exports. Browser migration retains the original localStorage draft. See [saving and files](docs/PROJECT_FILES_AND_SAVING.md).

Latest verification: 125 tests pass; 51 browser modules and all asset checks pass. Three actual free-model scripts (6 scenes / 40 dialogue lines, 3,677 successful-result tokens, reported cost 0) were imported/rehearsed/exported through the browser, then their bundles opened in a fresh context. Exact manifest/document and compile comparisons pass. Browser tests also cover own-image Blob migration/bundling, corrupt import preserving the work, failed-save rollback, restore/reload, the eight-point cap and IndexedDB-unavailable fallback. Real downloads were exercised; native picker/write flows used a mock OS picker. Earlier entries below describe prior checkpoints.

ChatGPT account increment: official local OAuth/PKCE, validated identity, separate account registrations, Windows DPAPI persistence, token refresh/revocation, account models and a Responses text bridge. The user completed real consent: identity and subscription scope checks passed, seven models were discovered, a restart restored credentials, and a gpt-6.1-sol short JSON inference completed successfully. Fixed the initial HTTP 400 by including JSON instructions in the input message as required by JSON mode. No OpenAI API key was used. Static hosting and subscription image generation remain unsupported. See [account login](docs/CHATGPT_ACCOUNT_LOGIN.md).

Current local increment: shared OpenRouter connection settings with optional browser persistence, dynamic text/image model catalogs and forget controls; project-owned background upload, scene selection, rehearsal and portable export. Character/background pack logic is in `apps/editor/src/project-assets.ts`; model discovery is in `packages/ai-providers/`. Independent asset-library UI, character setting/action editing and theme-pack installation remain planned. See [当前进度](docs/当前进度.md).

Verification (2026-10-12): `npm run check` passed all 109 tests, 47 browser modules and all content-asset checks; static output built. Real browser created two original characters plus an owned background, authored dialogue, rehearsed, reloaded and exported; a fresh browser context imported and rehearsed both speakers without failed-image diagnostics. Mocked browser provider tests verified remembered connections, text/image catalogs, refresh failure retaining the list, shared generation settings, session-only save and forget. The only provider console error in that run was the deliberately injected HTTP 503.

Live provider evidence (2026-10-12): one user-authorized `openrouter/free` JSON request succeeded, routed to `cohere/north-mini-code:free`, with 69 tokens and reported cost 0. The key was supplied only to that request in memory and was not installed in browser settings or written to project/source files. Live image and full-story quality acceptance remain open. Current changes are local, not yet pushed.

The following dated entries are historical checkpoints.

Local launcher handoff (2026-09-30): repeated Windows launch requests the prior server from the same checkout to close through a loopback instance endpoint, then takes over the fixed port. A pre-handoff server from the same folder is reused and serves the newly built files. An unrelated listener is reported without being stopped. Verified with live server processes on isolated ports for takeover, legacy reuse and foreign-process refusal.

Original character authoring (2026-09-30): manual PNG/JPEG/WebP upload and OpenRouter image generation feed the same preview, compression, project-owned character pack, editor action picker and rehearsal resolver. Embedded images travel in portable project file 0.8; 0.7 remains readable. ChatGPT-account image mode requires a same-origin image bridge unavailable in the static deployment. Automated checks: 102 tests passed; real browser exercised upload, save, action picker, dialogue, reload and rehearsal. No paid provider request was made.

Local development migration (2026-09-30): the local Git checkout replaces the cloud working folder as the working source. Windows launchers are included in the repository, with a fixed local port for draft persistence and a portable build cleanup command. Obsolete cloud hosting metadata and nine unused SVG action sheets were removed; the import contract and current workflow now live in `docs/`. The locally retained source PNGs missing from GitHub are included in this synchronization. Older entries below remain historical evidence.

- 24 characters / 192 actions / 23 scenes. All current action mappings use generated raster art; nine remaining vector-atlas characters have been replaced, with stable IDs.
- WebP runtime images, original art retained in art-source; the working assets directory contains only 77 referenced WebP images, including the shared thumbnail atlas. PNG/JPEG/SVG derivatives are generated when rebuilding.
- Dialogue-level rehearsal entry, replay current paragraph, return to its source editor; preceding persistent scene/audio state preserved.
- Model connection probe, elapsed request time, safe handling of cancelled/late/malformed responses.
- Browser and physical-phone acceptance is delegated to the user. No live model API call was made without a user key.

## Model-source semantics correction (2026-09-29)
- The one-click adaptation UI no longer treats “OpenAI” as an OpenAI API-key provider. Primary choices are now **OpenRouter API** and **ChatGPT account quota**.
- At this historical checkpoint OpenRouter was memory-only. The 2026-10-12 connection settings add optional browser persistence isolated from project/draft/export data.
- ChatGPT-account mode is a distinct same-origin `/api/chatgpt/responses` bridge contract and never requests an OpenAI API key. Missing bridge support fails explicitly and points back to OpenRouter.
- Official ChatGPT Sites Sign in with ChatGPT currently documents identity forwarding, not a general hosted inference entitlement; therefore the repository does not claim that Plus/Pro quota is already callable from a deployed Site.
- Transport regression coverage now includes same-origin account-bridge routing and the missing-bridge failure path.

Cleanup and sync preparation (2026-09-29): Removed 114 unreferenced intermediate images from assets and five superseded draft files; updated provenance and the WebP build step to prune intermediates. Recovered one pre-existing truncated Yogi source PNG from its valid same-dimension derivative and passed an isolated source-to-WebP rebuild. Full `npm run check`: 98 tests, 0 failures; 44 browser modules; 24 characters, 192 actions, 23 scenes, 77 images with verified hashes and crops. Static output built. Real browser/phone and live model requests remain unverified.

The entries below are historical checkpoints, not the current feature inventory.
## Additional investigation backgrounds (2026-09-28, local preview)

- Added police interview room, forensics lab, apartment living room and rainy courthouse entrance as generated empty 4:3 backgrounds. Source PNGs, 768×576 JPEGs, resource IDs and SHA-256 provenance are retained with the pack.
- The directory scene selector and story generation material list now expose 19 scenes without changing existing Resource IDs or the content-pack version.
- Current verification: 91 tests pass; 44 browser modules resolve; 15 characters, 120 actions, 19 scenes and 82 local images pass content checks.

## Avatar-first dialogue and scene authoring (2026-09-28)

- Dialogue cards no longer show a speaker-name select above the text. A miniature portrait sits to the left of each dialogue; clicking it opens the speaker picker and changes that block's speaker.
- The composer uses the same single active portrait instead of a persistent identity strip. The speaker picker directly exposes the full built-in character catalog; selecting a built-in character not yet present in the project adds it implicitly, so there is no separate add-character step.
- Authoring candidates are current-speaker-only at the Adapter layer. Ordinary dialogue authoring no longer exposes other cast members' pose/reaction/focus candidates.
- The composer-level Scene button and action-target selector are removed.
- Background is now authored as a Scene property from the directory. Each Work → Chapter → Scene entry has a stage selector. The portable 0.7 format remains compatible by normalizing that selection into exactly one leading `courtroom.background` CueBlock, which is hidden from the chat transcript.
- New scenes inherit the active scene's background (or the pack default); unset legacy scenes are shown explicitly as "选择舞台…" rather than pretending a background is active.
- Added four repository-original vector scenes (boathouse, records basement, parking garage, hospital room) and five new original stand-in actions for von Karma, Gumshoe, Lotta, Yogi and Mia.
- At this earlier checkpoint: 14 characters, 66 character actions, 15 scenes, 87 local image files / 88 resource IDs.
- At this earlier checkpoint: 88 tests passed and 44 browser modules resolved.

## Original synthesized rehearsal audio (2026-09-28)

- Courtroom content packs can now declare `previewAudio` synthesis metadata for named SFX/BGM resources; build generation validates waveform, note timing, gain and loop values.
- Rehearsal provides an explicit sound toggle (off by default). When enabled, Web Audio synthesizes repository-defined cues without bundling CAPCOM music, voice clips or sound files.
- BGM is reconstructed as persistent playback state, so rewind/restart selects the BGM valid at that script position. SFX is edge-triggered and only fires when playback crosses its token.
- The long built-in case now exercises `courtroom.sfx` and `courtroom.bgm` alongside pose/reaction/focus/emphasis/flash/shake/wait.
- Current demo pack includes original procedural cues for Objection/Hold It/desk slam/gavel/impact and four deliberately simple rehearsal loops (trial/cross-examination/suspense/pursuit). They are functional placeholders, not recreations of game audio.
- Verification: 83 tests pass and 43 browser modules resolve; material checks remain 14 characters / 61 actions / 11 scenes / 78 local images.

## Rehearsal presentation effects (2026-09-28)

- Rehearsal now renders flash, shake, emphasis and explicit focus as visible effects rather than text-only state hints.
- Added an edge-triggered presentation layer: persistent paragraph presentation state is separated from transient effect events, so character-by-character re-renders do not replay flash/shake.
- Focus now performs a short visual camera cut while continuing to use the existing ResourceRef-driven character/stage resolution.
- Shake/flash intensity and duration are clamped; `prefers-reduced-motion` suppresses shake and reduces flash/focus motion.
- Preview action labels now come from the active content pack instead of a hard-coded action dictionary, fixing new actions such as von Karma `accuse/breakdown` and Yogi `broken`.
- Existing wait semantics remain unchanged and covered by playback tests; project schema is unchanged.
- Verification: 81 tests pass, 42 browser modules resolve, and the 14-character / 61-action / 11-scene material check remains green.

## Long-form material stress test (2026-09-28)

- Built-in samples are reduced to one case: **《告别逆转 · 最后的异议》**, an original fan-demo inspired by the AA1-4 endgame structure without reproducing the original transcript.
- Scale: 4 chapters, 8 scenes, 123 dialogue blocks and 10 speaking roles. The case deliberately combines investigation scenes, witness transitions and a dense final courtroom sequence.
- Added original repository-local vector stand-ins for Manfred von Karma, Dick Gumshoe, Lotta Hart, Yanni Yogi and Mia Fey, plus four original scenes: lake dock, evidence room, prosecutor office and elevator hall.
- Material catalog now exposes 14 bindable characters, 61 actions and 11 scenes. Verification covers 78 unique local image files through 79 resource IDs, with provenance/hash/crop checks.
- The stress case explicitly compiles focus, emphasis, flash, shake and wait tokens. This makes a remaining renderer gap visible: flash/shake/emphasis are represented in the performance plan and preview state, but are not yet fully animated as visual effects; audio remains declared but not played.
- First CI pass caught an invalid Edgeworth pose that shorter examples never exercised, validating the long-case approach as an architecture/material compatibility test.
- Verification: 77 tests pass, 40 browser modules resolve, content/material checks pass.

## 0.9 architecture foundation (2026-09-27)

- Portable project/file schema remains unchanged at file version 0.7; this is an internal boundary refactor rather than a migration.
- Courtroom material metadata now has one declarative source in `content-packs/courtroom-demo/catalog.json`. Build generation produces the typed runtime registry instead of manually maintaining separate pack and visual-path tables.
- Added generic `packages/presentation` ResourceRef resolution. Courtroom preview no longer contains the `official.courtroom-demo` special case and is regression-tested with a second synthetic content pack.
- Story AI is split into adapter-neutral outline/model/plan layers and Courtroom-specific scene emission under the Courtroom Adapter.
- Editor entry responsibilities started splitting into dedicated project persistence/export and Work → Chapter → Scene outline modules.
- Verification: 77 tests pass, 40 browser modules resolve, 9 bindable characters expose 46 actions across 7 scenes, and 59 unique local image files pass provenance/hash/crop checks through 60 resource IDs.

## Automatic deployment increment (2026-09-27)

- Static URLs are subpath-safe and the build outputs a portable `out` directory.
- Deployment is consolidated back onto GitHub Pages for the public-repository path. The `Verify` workflow gates deployment: only a successful push to `main` proceeds to build `out` and publish it.
- After repository visibility is changed to Public and Pages Source is set to `GitHub Actions` once, subsequent verified `main` pushes deploy automatically without an external hosting account.
- Current verified state: 75 tests pass, 34 browser modules resolve, and 58 local images cover 9 bindable characters / 46 actions / 7 scenes with source hashes and crop bounds.
- The built-in “凌晨的通行证” exercises all four newly added investigation scenes, including the detention interview room.
- The material library adds Apollo Justice, Klavier Gavin, Ema Skye and Trucy Wright as opt-in presets while preserving the historical five-person default demo cast.
- Public-release documentation now separates original code from CAPCOM-owned prototype artwork via `THIRD_PARTY_ASSETS.md`, and includes a bilingual `docs/CAPCOM_PITCH.md` for presenting the authoring/compiler concept to the rights holder.

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

At this historical checkpoint, 47 tests and 26 browser modules passed; mobile directory/diagnostics/picker and the IME guard were implemented. Browser preview infrastructure blocked visual QA. Physical phone acceptance remained open. The old milestone-specific verification and routing notes have since been consolidated into the current project state/status documents.

## 2026-09-26 cast recovery (supersedes earlier counts)
- Root completed integration directly; no subagent execution in this correction. Previous recovery remained uncommitted and unpublished.
- Five actors: Phoenix, Edgeworth, Maya, Judge and Larry (witness); 26 actions with local images, three scenes and correct stations. Witness shocked and nervous intentionally share the source nervous expression; actions are not claimed as 26 unique animations.
- Built-in old sample cast upgrades additively; custom/imported cast identities remain intact, while missing built-in characters are selected directly from the speaker picker. Existing dialogue, aliases and drafts remain intact. Five-person showcase opens independently.
- Verification: 52 passing tests, 28 resolved modules, 34 images verified for source hash and crop bounds; composited all 26 actions for manual asset inspection. Browser/mobile interaction remains unverified (previous managed preview infrastructure unavailable).
- Preview uses representative frames; full animation and audio playback are not implemented.

## 2026-09-26 dialogue opening synchronization
Each paragraph resolves cast-bound default station, camera and normal pose; leading pose/reaction/focus tokens override that opening. Explicit scene cues persist. Transient poses reset at every dialogue boundary, including repeated speakers. Decoded image layers are prepared before revealing text, timed waits, or reveal-all completion. Slow/failed assets have a 10-second terminal timeout and explicit failure status; old asynchronous callbacks cannot revive a rewound or closed playback. No project schema changes or authored-text rewrites.
Verification: 57 tests pass, 29 browser modules and 34 source-checked assets pass. New regressions cover first-frame readiness, click bypass, inline image delays, final reveal, cancellation, defaults and explicit overrides. Browser/mobile interaction not verified.

## 2026-09-26 whole-rehearsal preload
Preload the deduplicated plan image set before playback with four concurrent requests and completed-image progress. Decoded representative frames are reused across dialogs in the current page session. Failed images expose retry or explicit partial playback; closing cancels active loads and prevents queued work/start. Existing per-line readiness remains a fallback. 60 tests pass; 30 browser modules and all 34 content assets verified. Browser/mobile interaction remains unverified.
# 2026-09-28 — Q-style art pass

The Courtroom pack now maps 14 characters, 66 action IDs and 15 scenes to generated chibi illustration assets. Three distinct transparent expressions per character, generated courtroom and investigation backgrounds, and separate courtroom foregrounds replace the previously bundled game images and vector stand-ins. Stable Resource IDs preserve authored scripts; similar action IDs still share one of three art variants per character. Source atlases, crop recipe, mapping and hashes are retained in the content pack. The mobile payload is about 9 MB of referenced images, with scene backgrounds stored as JPEG and transparent layers as PNG. `npm run check` passes 88 tests, static smoke and full asset integrity checks. Physical mobile acceptance remains open.

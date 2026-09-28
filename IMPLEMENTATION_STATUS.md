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

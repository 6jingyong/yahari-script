# Project state — 2026-10-14

Latest UI: work management uses one flow diagram with persistent work/chapter/scene and continuation forms, visible common actions and one save action. Dialogue lists, character lanes, scene cards, inner tabs and duplicate actions are removed. Several choices can continue the same next scene, and reader choice buttons appear inside the stage. Audio has 35 original 8Bit effects / 16 loops by narrative use, persistent settings, shared synthesis, WAV downloads and portable metadata. Validation: **188 tests, 71 modules**, export fixtures and static output pass; desktop/mobile save/reload, audition and offline playback are browser-verified. See [work usage](BRANCHING_STORIES.md) and [audio](8BIT_AUDIO.md).

Dialogue now has default automatic 8Bit typewriter blips with work → character → line precedence, silence, grapheme timing, punctuation filtering and cached PCM buffers. Voice settings round-trip in works and offline exports; audio starts enabled for fresh readers/rehearsals and respects subsequent mute preferences. Obsolete management UI, styles and local QA artifacts have been cleaned; see [cleanup](CLEANUP_20261014.md).

Action sounds add 17 locally sourced Japanese callouts with correct visual-character matching, per-action overrides / silence, cast defaults, gesture → voice → text timing, pre-decoding, skip/replay/mute cancellation, audition/download and offline embedding. All recordings are distinct and browser-decodable; source URLs and hashes are retained. [Usage and provenance](ACTION_SOUNDS.md).

The current local increment adds an independent work/chapter/scene/dialogue workspace, scene exits with choices/jumps/endings, a standalone reader with path history and local progress, and self-contained offline HTML export. Branching work files use version 0.9; existing 0.7/0.8 remain readable. Story characters must be manually mapped to built-in visual characters, with portrait previews and confirmation tied to names/material IDs. [Usage and verification](BRANCHING_STORIES.md) includes desktop/mobile browser flows and an offline exported sample. The scene-end branching slice is complete; conditions/variables and AI branch planning are not implemented.

The local Git checkout is the working source. GitHub (`6jingyong/yahari-script`, branch `main`) stores shared history and deploys the public preview through GitHub Pages. Google Drive / ChatGPT Work snapshots are historical copies, not the source for ongoing edits.

Workspace entry: `D:\qiany\Documents\Yahari Script · 矢张剧本\project`. The workspace root contains only this checkout; previous duplicate entries are preserved in the adjacent `Yahari Script · 矢张剧本 旧备份-20260930` folder. See [当前进度](当前进度.md) for a Chinese inventory. Current feature changes are local and have not been pushed.

## Local workflow

- Windows: run `双击启动本地版.cmd` from the repository root. It installs missing build dependencies, compiles the source and opens the editor.
- Terminal: `npm ci`, `npm run check`, then `npm run serve`.
- Local editor: `http://127.0.0.1:4173/apps/editor/`. Keep this origin stable because browser drafts are stored per origin, including the port.
- The Windows launcher replaces a previous local server from the same checkout through its loopback instance endpoint. A pre-handoff release is reused for one launch; a different process on 4173 remains untouched and is reported clearly.
- Before syncing: review `git diff`, run `npm run check` and `node scripts/build-static.mjs`, commit, then push `main`. GitHub Actions verifies the source before deploying Pages.
- `node_modules/`, `dist/`, `out/` and generated content-pack TypeScript are reproducible outputs and are ignored by Git.

## Current implementation

- Adapter-neutral project contracts, validation, structured editing and portable project import/export.
- Courtroom content pack: 24 characters, 192 actions, 23 scenes and 77 runtime WebP images.
- Chapter/scene navigation, local browser drafts, dialogue-level rehearsal and replay.
- Multiple works in IndexedDB, separate deduplicated image Blobs, automatic/manual save and eight restore points; `.yahari` bundles, JSON compatibility, import preview and file save/download. The active editing scene is stored separately from the work's entry scene. See [PROJECT_FILES_AND_SAVING.md](PROJECT_FILES_AND_SAVING.md).
- OpenRouter story/character generation shares one connection setting. The user can remember it in this browser or keep it in page memory; model catalogs are refreshed by text/image purpose, with manual model IDs supported. Keys are isolated from project/draft/export data. The separate ChatGPT account bridge requires a server implementation; neither the local static server nor GitHub Pages provides it.
- Runtime assets and editable source art are both retained. The source PNGs referenced by the art manifest and build scripts are needed for rebuilding the assets.
- Original characters can be created by manual image upload or OpenRouter image generation. Each accepted image is compressed and embedded in the project file, so export/import carries the character resources. The optional ChatGPT-account image bridge has a client contract but is not hosted by the local/static server.
- Own backgrounds can be uploaded, previewed and applied to scenes; they are reusable inside the work and embedded in its portable file.
- Project files with embedded content use version 0.8; existing version 0.7 files remain readable. Older editor builds reject 0.8 instead of silently dropping embedded images during export.

## Architecture and remaining evidence

Core owns portable project contracts; adapters own capabilities and performance compilation; editor-core owns mutations and history; presentation resolves content resources; the browser app handles interaction and rehearsal. See `../ARCHITECTURE_DECISIONS.md`, `IMPORT_SAFETY.md`, and `../IMPLEMENTATION_STATUS.md`.

Malformed structure must fail before replacing active data. Repairable semantic errors remain available to the author, and missing dependencies preserve read-only access. Browser storage is device-local; use export/import to share or back up works.

Automated checks cover compilation, module references, project contracts and runtime asset integrity. Three real free-model scripts (6 scenes / 40 dialogue lines) were imported/rehearsed/exported in the browser and opened in a fresh context; exported structure and compilation match the source. Browser checks cover save failure rollback, restoration, own-image Blobs and old-draft migration. Native file-picker interaction is simulated; file downloads are real. Long-story output quality, live image generation and physical-phone interaction still require separate acceptance.

## Cleanup

Removed the obsolete cloud hosting pointer and nine superseded SVG action sheets. The import contract moved from `.astra-code/contracts/` to `docs/IMPORT_SAFETY.md`; old chronological handoff notes are recoverable from Git history. Original source atlases remain because the asset build scripts still use them. No application or runtime image was removed.

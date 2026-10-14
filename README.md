# Yahari Script

Adapter-bound structured rich script editor and performance compiler, with a Courtroom adapter and browser preview. Public previews are [GitHub Pages](https://6jingyong.github.io/yahari-script/) and [GPT Sites](https://yahari-script-qyc.qyc001.chatgpt.site/apps/editor/). Both are published from the current local source; browser drafts remain separate for each origin.

## Current capabilities

- Independent **素材管理** workspace for built-in and original material: 24 characters / 192 actions / 23 scenes, editable stage layers, persistent remove/restore, stable project-scoped built-in overrides, and 35 original 8Bit effects / 16 music loops grouped by narrative use. Sound settings are visible beside the library; audition and playback share pulse/triangle/noise synthesis, with 8-bit WAV downloads and portable parameter packs. See [asset workspace](docs/ASSET_WORKSPACE.md), [8Bit audio](docs/8BIT_AUDIO.md) and [formats](docs/素材制作与格式说明.md).
- For a short Chinese inventory, local entry point and next priorities, see [当前进度](docs/当前进度.md).
- Action sounds now include 17 local Japanese character callouts from Court Records. Objection gestures use the bound character's voice; each action can choose another callout, an 8Bit effect or silence, with optional character defaults. The voice library offers audition/download and offline HTML carries the recordings. See [action sounds](docs/ACTION_SOUNDS.md).
- Chat-style composer and editable dialogue with atomic action chips.
- Context-aware actions derived from the same registry used for validation and compilation.
- Explicit speaker-following or fixed-cast subjects; invalid actions preserved with diagnostics and quick fixes.
- Model-first editing, grouped undo/redo, local project and draft persistence.
- Independent work management with one flow diagram, persistent work/chapter/scene forms and a separate conversation editor.
- Story-to-script generation with OpenRouter API or the local Sign in with ChatGPT account bridge. The local bridge supports official OAuth, Windows protected credentials, account model discovery and text inference with eligible subscription authorization; real user sign-in, restart persistence and a short JSON inference have been verified. The author confirms every detected character's visual binding before scenes are generated; a fact ledger and scene contracts constrain the output.
- Versioned `.yahari-project.json` import/export; legacy binding and missing-dependency read-only opening.
- Multi-work IndexedDB library with deduplicated image Blobs, automatic save, manual save/Ctrl+S and eight restore points. Portable `.yahari` bundles include own media; import preview preserves the current work and creates a copy for duplicate IDs. File saving uses a browser file picker where supported and otherwise downloads the bundle. See [saving and files](docs/PROJECT_FILES_AND_SAVING.md).
- Asset-backed Courtroom preview with paragraph navigation, progressive text, waits, visible emphasis/flash/shake/focus cuts, default 8Bit typewriter blips with work/character/line settings, and original synthesized SFX/BGM controlled by the sound switch.
- Avatar-first dialogue editing: click the miniature portrait beside a message to change its speaker; action authoring is constrained to that speaker. Scene backgrounds are selected in work management rather than inserted as chat actions.
- Project-owned original characters: upload a PNG/JPEG/WebP portrait (and optionally a second expression), or generate one image through OpenRouter's image API. The author previews and explicitly saves it; compressed image data travels with project export/import. The official ChatGPT subscription route currently does not support image generation.
- Project-owned backgrounds: upload a PNG/JPEG/WebP image, preview it and apply it to the current scene. It remains selectable in other scenes and travels with the exported project.
- Shared OpenRouter connection settings with optional browser persistence, separate dynamic text/image model catalogs, manual model IDs and a forget-connection control. Story and character generation reuse the connection.
- One built-in long-form stress case, **《告别逆转 · 最后的异议》**: 4 chapters / 8 scenes / 123 dialogue blocks / 10 speaking roles. It is an original fan-demo inspired by the final confrontation shape of Turnabout Goodbyes rather than a transcript reproduction, and deliberately exercises focus, emphasis, flash, shake and wait tokens.

The portable import boundary rejects malformed structure and ambiguous identities before activation. Semantic errors remain available for repair. Multi-document files round-trip intact, and the UI can switch between scenes.

## Work management and branching

The local build now has **作品管理 / 对话编辑 / 素材管理** workspaces. Work management uses one story flow diagram with persistent work, chapter and scene forms; common actions are visible and the top save button/Ctrl+S saves all management forms. Dialogue stays in its editor. Interaction is optional: newly added choices default to the same next scene, and different options may share a continuation. Reader choice buttons appear inside the performance stage. **从开头阅读** opens a separate reader; **导出 HTML** creates one file with the runtime and used images for offline sharing. Works with explicit flow settings use file version 0.9; old 0.7/0.8 files remain readable. Story generation requires the author's individual built-in visual bindings and preserves story names. See [usage](docs/BRANCHING_STORIES.md) and the [six-scene sample](examples/branching-story/README.md).

## Run and verify
Requires Node.js >=22.6.

For friends, the simplest way is to open the [online editor](https://6jingyong.github.io/yahari-script/) in a browser. No installation is needed. Projects are saved in that browser; use **导出项目** and **导入项目** to move a project between devices or share it with someone else. The online shortcut `打开在线版.url` is in the repository root.

On Windows, double-click `双击启动本地版.cmd` in the repository root to run this local copy. Node.js >=22.6 is required. The first launch also needs internet access to install dependencies. The launcher builds the current source, starts a local server at the stable address `http://127.0.0.1:4173/apps/editor/`, and opens the editor in the default browser. Double-clicking again asks the previous server from this checkout to exit and starts the refreshed version on the same port. A server from an older release is reused for that launch while serving the freshly built files. Keep the active server window open while using the local editor; closing it stops the server. This local address is only for the current computer. Each browser keeps its own drafts, so export projects before clearing browser data or switching browsers.

```sh
npm install
npm run build
npm run serve
```

Open http://127.0.0.1:4173/apps/editor/ . For checks:

```sh
npm run check
```

This runs strict compilation, Node tests, browser module resolution and entry JavaScript syntax checks, plus all 192 action image mappings, file hashes, WebP container checks, crop bounds and 17 recorded-callout checks. It also compares three real OpenRouter-generated examples with their browser-exported bundles. See [当前进度](docs/当前进度.md) for 188 tests / 71 modules; 77 runtime images are shipped. Static deployment uses `node scripts/build-static.mjs`. A successful `main` verification is followed by the GitHub Pages deployment job in `.github/workflows/verify.yml`. GPT Sites uses the same application files in its separate source repository. [Before sharing with CAPCOM or fans](docs/SHARING_CHECKLIST.md).

## Architecture
Core owns adapter-agnostic project/document contracts; the Courtroom adapter owns capabilities, semantic diagnostics, Courtroom scene generation and its performance plan. Story AI owns adapter-neutral outlining, fact/scene contracts and model transport. Presentation resources are resolved from ResourceRef through the generic presentation resolver. EditorStore owns document mutations/history. DOM is an input surface, never canonical script data.

See IMPLEMENTATION_STATUS.md for current scope/evidence, ARCHITECTURE_DECISIONS.md for invariants, [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for the local development workflow, and [the asset library and AI architecture proposal](docs/ASSET_LIBRARY_AND_AI_ARCHITECTURE.md) for the planned general theatre expansion. The local Git checkout is the working copy; GitHub is the shared history and Pages publication target. Old cloud workspace settings are no longer part of the project.

## Assets, trademarks and privacy

Yahari Script is an independent, unofficial technical prototype. The Courtroom demo's character/scene/action declarations live in `content-packs/courtroom-demo/catalog.json`, while provenance and file hashes live in `content-packs/courtroom-demo/assets/sources.json`. The current pack uses generated Q-style depictions of Ace Attorney characters and generated environment art. Source atlases and a reproducible cutting recipe live alongside the pack.

CAPCOM and the respective rights holders retain all rights in Ace Attorney characters, artwork, names and trademarks. No affiliation, endorsement or license from CAPCOM is claimed. Any license applied to Yahari Script's original code does not grant rights to third-party assets. See [THIRD_PARTY_ASSETS.md](./THIRD_PARTY_ASSETS.md) for the full boundary and [docs/CAPCOM_PITCH.md](./docs/CAPCOM_PITCH.md) for the project's technical introduction aimed at CAPCOM or other rights holders.

OpenRouter API keys can be remembered in a separate browser connection entry when “记住在此浏览器” is selected; otherwise they stay in page memory. They are never included in project exports or project/story drafts. “忘记此设备” removes the saved connection. Clearing site data also removes it. This is browser storage. ChatGPT credentials are held separately by the local account bridge and protected by Windows DPAPI; see [ChatGPT account sign-in](docs/CHATGPT_ACCOUNT_LOGIN.md). The static deployment has no account bridge.

Original character and background images are stored as deduplicated Blobs in the IndexedDB project library and included in exported `.yahari` bundles. JSON export embeds image data URLs for compatibility; browser-draft fallback remains available when IndexedDB cannot open. Browser storage quotas vary; if local saving fails, export the project. The independent asset workspace supports multiple editable poses and expressions, with standalone pack import/export and an IndexedDB library separate from works. Image and reference-action generation were validated with simulated provider responses; real image output quality remains unverified. Story-to-script generation still binds to the built-in Courtroom catalog rather than project-owned characters.

The current demo material catalog exposes 24 bindable character presets, 192 character actions and 23 scenes. Every character has an eight-state action sheet, while portraits stay separate and older base variants remain available. The latest character additions are Athena Cykes, Simon Blackquill, Kristoph Gavin, Winston Payne, Adrian Andrews and Iris, each with eight distinct poses and a separate portrait; the two newest scenes are a rainy apartment stairwell and a courthouse consultation room. All 24 characters now use generated eight-pose raster sheets. Editor icons and avatars share a compact WebP thumbnail atlas; rehearsal loads WebP derivatives of the full-resolution sheets. Original PNGs remain available for editing. See [ART_DIRECTION.md](./content-packs/courtroom-demo/ART_DIRECTION.md).

## Mobile authoring increment (2026-09-24)

Directory and diagnostics have dedicated mobile surfaces; undo/redo stay reachable; the composer and picker follow the visible keyboard viewport. Touch pickers open without forcing search focus and restore cue opener focus. A composition lifecycle guard protects against completion Enter issuing commands. Current evidence is consolidated in `IMPLEMENTATION_STATUS.md` and `docs/PROJECT_STATE.md`. Browser/physical phone acceptance remains open.

## Rehearse and revise
Each dialogue has “从这里排练”. Playback supports “重播本句” and “编辑本句”; jumping keeps earlier background and BGM state without replaying earlier transient effects. The toolbar rehearsal starts from the beginning.

Model setup includes an explicit one-request connection test which sends no story text. Cancellation is checked after response and body download, and malformed provider responses produce safe errors. On 2026-10-12, one real OpenRouter free-router JSON request succeeded with the user-authorized key: 69 tokens, reported cost 0. This establishes a minimal text connection; long-story generation and image generation still need separate live acceptance.

# Yahari Script

Adapter-bound structured rich script editor and performance compiler, with a Courtroom adapter and browser preview. The current public preview is [6jingyong.github.io/yahari-script](https://6jingyong.github.io/yahari-script/); the older chatgpt.site build is a legacy snapshot.

## Current capabilities
- Chat-style composer and editable dialogue with atomic action chips.
- Context-aware actions derived from the same registry used for validation and compilation.
- Explicit speaker-following or fixed-cast subjects; invalid actions preserved with diagnostics and quick fixes.
- Model-first editing, grouped undo/redo, local project and draft persistence.
- Work → chapter → scene navigation, with project import/export in the directory sidebar.
- Story-to-script generation through a user-supplied OpenAI-compatible API. The author confirms every detected character's visual binding before scenes are generated; a fact ledger and scene contracts constrain the output.
- Versioned `.yahari-project.json` import/export; legacy binding and missing-dependency read-only opening.
- Asset-backed Courtroom preview with paragraph navigation, progressive text, waits, visible emphasis/flash/shake/focus cuts, plus opt-in original synthesized rehearsal SFX/BGM.
- Avatar-first dialogue editing: click the miniature portrait beside a message to change its speaker; action authoring is constrained to that speaker. Scene backgrounds are selected from the directory rather than inserted as chat actions.
- One built-in long-form stress case, **《告别逆转 · 最后的异议》**: 4 chapters / 8 scenes / 123 dialogue blocks / 10 speaking roles. It is an original fan-demo inspired by the final confrontation shape of Turnabout Goodbyes rather than a transcript reproduction, and deliberately exercises focus, emphasis, flash, shake and wait tokens.

The portable import boundary rejects malformed structure and ambiguous identities before activation. Semantic errors remain available for repair. Multi-document files round-trip intact, and the UI can switch between scenes.

## Run and verify
Requires Node.js >=22.6.

```sh
npm install
npm run build
npm run serve
```

Open http://127.0.0.1:4173/apps/editor/ . For checks:

```sh
npm run check
```

This runs strict compilation, Node tests, browser module resolution and entry JavaScript syntax checks, plus all 66 action image mappings, file hashes, full PNG/JPEG integrity and crop bounds. Current milestone: 88 tests, zero failures. Static deployment uses `node scripts/build-static.mjs`. A successful `main` verification is followed by the GitHub Pages deployment job in `.github/workflows/verify.yml`. The older `chatgpt.site` preview remains an independent legacy deployment.

## Architecture
Core owns adapter-agnostic project/document contracts; the Courtroom adapter owns capabilities, semantic diagnostics, Courtroom scene generation and its performance plan. Story AI owns adapter-neutral outlining, fact/scene contracts and model transport. Presentation resources are resolved from ResourceRef through the generic presentation resolver. EditorStore owns document mutations/history. DOM is an input surface, never canonical script data.

See IMPLEMENTATION_STATUS.md for current scope/evidence, ARCHITECTURE_DECISIONS.md for invariants and `.astra-code/PROJECT_STATE.md` for continuation guidance. Historical v0.6/P1 documents describe earlier checkpoints and are not current feature inventories.

## Assets, trademarks and privacy

Yahari Script is an independent, unofficial technical prototype. The Courtroom demo's character/scene/action declarations live in `content-packs/courtroom-demo/catalog.json`, while provenance and file hashes live in `content-packs/courtroom-demo/assets/sources.json`. The current pack uses generated Q-style depictions of Ace Attorney characters and generated environment art. Source atlases and a reproducible cutting recipe live alongside the pack.

CAPCOM and the respective rights holders retain all rights in Ace Attorney characters, artwork, names and trademarks. No affiliation, endorsement or license from CAPCOM is claimed. Any license applied to Yahari Script's original code does not grant rights to third-party assets. See [THIRD_PARTY_ASSETS.md](./THIRD_PARTY_ASSETS.md) for the full boundary and [docs/CAPCOM_PITCH.md](./docs/CAPCOM_PITCH.md) for the project's technical introduction aimed at CAPCOM or other rights holders.

The browser keeps the model API Key in memory and does not include it in project exports or local drafts.

The current demo material catalog exposes 14 bindable character presets, 66 character actions and 15 scenes. Each character has three distinct generated images (neutral, gesture, reaction); related action IDs temporarily share these images. The next art pass can add dedicated poses without changing existing scripts. See [ART_DIRECTION.md](./content-packs/courtroom-demo/ART_DIRECTION.md).

## Mobile authoring increment (2026-09-24)

Directory and diagnostics have dedicated mobile surfaces; undo/redo stay reachable; the composer and picker follow the visible keyboard viewport. Touch pickers open without forcing search focus and restore cue opener focus. A composition lifecycle guard protects against completion Enter issuing commands. See `docs/P1D_VERIFICATION.md`, `ROUTER.md` and `TASKS.md`. Browser/physical phone acceptance remains open.

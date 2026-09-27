# Yahari Script

Adapter-bound structured rich script editor and performance compiler, with a Courtroom adapter and browser preview. The editor is available at [yahari-script-qyc.qyc001.chatgpt.site](https://yahari-script-qyc.qyc001.chatgpt.site).

## Current capabilities
- Chat-style composer and editable dialogue with atomic action chips.
- Context-aware actions derived from the same registry used for validation and compilation.
- Explicit speaker-following or fixed-cast subjects; invalid actions preserved with diagnostics and quick fixes.
- Model-first editing, grouped undo/redo, local project and draft persistence.
- Work → chapter → scene navigation, with project import/export in the directory sidebar.
- Story-to-script generation through a user-supplied OpenAI-compatible API. The author confirms every detected character's visual binding before scenes are generated; a fact ledger and scene contracts constrain the output.
- Versioned `.yahari-project.json` import/export; legacy binding and missing-dependency read-only opening.
- Asset-backed Courtroom preview with paragraph navigation, progressive text and waits.

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

This runs strict compilation, Node tests, browser module resolution and entry JavaScript syntax checks, plus all 26 action image mappings, file hashes and crop bounds. Current milestone: 73 tests, zero failures. Static deployment uses `node scripts/build-static.mjs` after compilation. GitHub source updates do not automatically redeploy the existing Site.

## Architecture
Core owns adapter-agnostic project/document contracts; the Courtroom adapter owns capabilities, semantic diagnostics and its performance plan. EditorStore owns document mutations/history. The browser UI and preview consume these layers. DOM is an input surface, never canonical script data.

See IMPLEMENTATION_STATUS.md for current scope/evidence, ARCHITECTURE_DECISIONS.md for invariants and `.astra-code/PROJECT_STATE.md` for continuation guidance. Historical v0.6/P1 documents describe earlier checkpoints and are not current feature inventories.

## Assets and privacy

The Courtroom demo includes CAPCOM game artwork collected through third-party projects. Provenance and file hashes are recorded in `content-packs/courtroom-demo/assets/sources.json`; possession of this repository does not grant a commercial license for that artwork. Keep the repository private until those rights are resolved or the assets are replaced. The browser keeps the model API Key in memory and does not include it in project exports or local drafts.

## Mobile authoring increment (2026-09-24)

Directory and diagnostics have dedicated mobile surfaces; undo/redo stay reachable; the composer and picker follow the visible keyboard viewport. Touch pickers open without forcing search focus and restore cue opener focus. A composition lifecycle guard protects against completion Enter issuing commands. See `docs/P1D_VERIFICATION.md`, `ROUTER.md` and `TASKS.md`. Browser/physical phone acceptance remains open.

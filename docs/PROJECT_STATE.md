# Project state — 2026-09-30

The local Git checkout is the working source. GitHub (`6jingyong/yahari-script`, branch `main`) stores shared history and deploys the public preview through GitHub Pages. Google Drive / ChatGPT Work snapshots are historical copies, not the source for ongoing edits.

## Local workflow

- Windows: run `双击启动本地版.cmd` from the repository root. It installs missing build dependencies, compiles the source and opens the editor.
- Terminal: `npm ci`, `npm run check`, then `npm run serve`.
- Local editor: `http://127.0.0.1:4173/apps/editor/`. Keep this origin stable because browser drafts are stored per origin, including the port.
- Before syncing: review `git diff`, run `npm run check` and `node scripts/build-static.mjs`, commit, then push `main`. GitHub Actions verifies the source before deploying Pages.
- `node_modules/`, `dist/`, `out/` and generated content-pack TypeScript are reproducible outputs and are ignored by Git.

## Current implementation

- Adapter-neutral project contracts, validation, structured editing and portable project import/export.
- Courtroom content pack: 24 characters, 192 actions, 23 scenes and 77 runtime WebP images.
- Chapter/scene navigation, local browser drafts, dialogue-level rehearsal and replay.
- OpenRouter story generation with a user-supplied key held in memory. The separate ChatGPT account bridge requires a server implementation; neither the local static server nor GitHub Pages provides it.
- Runtime assets and editable source art are both retained. The source PNGs referenced by the art manifest and build scripts are needed for rebuilding the assets.

## Architecture and remaining evidence

Core owns portable project contracts; adapters own capabilities and performance compilation; editor-core owns mutations and history; presentation resolves content resources; the browser app handles interaction and rehearsal. See `../ARCHITECTURE_DECISIONS.md`, `IMPORT_SAFETY.md`, and `../IMPLEMENTATION_STATUS.md`.

Malformed structure must fail before replacing active data. Repairable semantic errors remain available to the author, and missing dependencies preserve read-only access. Browser storage is device-local; use export/import to share or back up works.

Automated checks cover compilation, module references, project contracts and runtime asset integrity. Physical-phone interaction and real provider calls still require separate acceptance; unit tests do not establish those results.

## Cleanup

Removed the obsolete cloud hosting pointer and nine superseded SVG action sheets. The import contract moved from `.astra-code/contracts/` to `docs/IMPORT_SAFETY.md`; old chronological handoff notes are recoverable from Git history. Original source atlases remain because the asset build scripts still use them. No application or runtime image was removed.

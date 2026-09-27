# Yahari Script v0.8 P1-b — Project Lifecycle & Portable Persistence

## Outcome

P1-a was a document editor bound to hard-coded demo context. P1-b turns it into a portable Adapter-bound project workflow:

```text
New / Import
→ explicit Adapter + Content Pack binding
→ validate project envelope
→ edit entry document
→ validate + compile
→ persist locally / export complete project
```

## Project file

Exports now use:

```ts
interface YahariProjectFile {
  fileFormat: "yahari-project";
  fileVersion: "0.7";
  manifest: ProjectManifest;
  documents: ScriptDocument[];
  metadata?: { exportedAt?: string; generator?: string };
}
```

File format, document schema, Adapter version, and Content Pack versions remain independent.

## Import behavior

- A valid project with installed dependencies opens normally.
- A legacy P1-a bare document opens the binding dialog; it is never silently assigned an Adapter during explicit import.
- A structurally valid project with a missing Adapter or Content Pack opens read-only and can be re-exported without destroying its data.
- A malformed project, missing entry document, unknown schema version, or invalid JSON is rejected before current state is replaced.
- Import clears Undo / Redo history.

## Intentional limits

- Only `official.courtroom@0.1.0` and `official.courtroom-demo@0.1.0` are installed.
- The UI edits the entry document only, while preserving other documents during save/export.
- There is no multi-project browser yet.
- Missing dependencies cannot be installed from the editor yet.
- Renderer remains outside P1-b.

## Editor reliability changes folded into P1-b

- IME composition keystrokes no longer trigger `/`, `Ctrl+Space`, Enter, Escape, or global Undo commands.
- Closing the inline Picker restores the saved caret; inserting a Token rebuilds the model-first editor and then restores focus after the new chip.
- High-frequency typing uses debounced local persistence; storage failures surface a visible export warning instead of crashing silently.
- Mobile widths receive a persistent Dialogue / Cue / Import / Export action bar.
- Token chips and navigable diagnostics have basic keyboard activation semantics.

## Verification

```text
25 tests passed
0 tests failed
strict TypeScript build passed
22 browser ES modules resolved
editor HTML and compiled entry served successfully
```

The environment exposed Playwright but did not contain a Chromium executable, so real-browser E2E is still an explicit next verification item rather than a claimed pass.

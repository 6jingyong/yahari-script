# P1-d mobile authoring increment — 2026-09-24

## Source decision
Canonical source is the existing Sites Git repository, opened at aa5d86deaf465fea9112d5e6cfc1378259ea5e5e. The P1-c archive is divergent and omits already shipped structured drafts, asset preview and import hardening. It was inspected but not copied over live application code. Latest user Work AGENTS.md is installed at repository root.

## Implemented
- Directory access without the hidden desktop outline; focused source row on return.
- Direct diagnostics entry, full viewport mobile inspection, navigation back to source, focus after quick fixes.
- Undo/redo remain reachable; expanded toolbar has intrinsic height.
- VisualViewport height and offset track keyboard changes, with dvh fallback and no pinch-zoom compensation.
- Touch action sheet with searchable choices, explicit close, keyboard traversal containment and cue opener focus restoration.
- 16 px form inputs and larger mobile controls; dismissible first-run guidance.
- Shared composition lifecycle guard used by composer, inline editor and picker search. Suppresses Enter during composition and for 100 ms after compositionend to protect engines that end composition before dispatching the commit key. An intentional second Enter within that window is also suppressed; send button remains available.
- Preserved preview, structured draft persistence, current content pack, project import and compiler contracts.

## Verified
- `npm run check`: strict compilation, 47 passing Node tests, zero failures, 26 browser module dependencies resolved, editor JavaScript syntax valid.
- Two new regression tests cover composition lifecycle, early flag clearing, suppression window boundary, ordinary shortcuts and guard isolation.
- Independent read-only A2 review requested with gpt-6-sol and accepted by the runtime. Actual backend model identity is not independently reported. Reviewer identified focus gaps after directory/diagnostic navigation, cue replacement and quick fixes; owner repaired all three.
- Existing preview playback, import safety, deterministic compilation and document round-trip tests remain passing.

## Not verified
Supervised browser preview could not start. First attempt identified absent generated output; after generating it, second attempt failed because the preview service lacked `live-server`. This is an environment failure, not a UI result. No screenshot, browser interaction, mobile layout pass, physical keyboard or iOS/Android IME pass is claimed.

## Remaining phone acceptance gate
At 360/390/430 px on Android Chrome and iOS Safari:
1. Write, switch identity, insert action, cancel/reopen picker and send.
2. Confirm Chinese IME text with Enter; ensure no accidental send; intentionally send afterward.
3. Edit existing lines with keyboard visible and scroll without losing composer access.
4. Open directory, choose a cue/dialogue, return to the correct source row.
5. Open checks, navigate to invalid action, apply fix, return without losing writing context.
6. Use undo/redo; export/import; reload and verify document and unsent draft.
7. Open existing asset rehearsal and step/restart/close.

The full roadmap five-character journey is still open: current canonical hosted content pack exposes two characters. This release does not claim the complete P1-d gate or complete P2 playback coverage.

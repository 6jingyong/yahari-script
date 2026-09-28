# Yahari Script — Product Roadmap

> Status: reconciled with the Drive-first canonical working state, 2026-09-29
> Historical archives and GitHub may lag the current Google Drive project. Existing structured drafts, import hardening and asset-backed playback are preserved; phase labels below express product gates, not a reliable inventory of shipped code.  
> Product principle: make structured performance authoring feel like ordinary writing; expose structure only when it helps the author.

## 1. North star

Yahari Script should become an **Adapter-bound structured script authoring system** where an author can write primarily through a conversation-like editor, while the document remains deterministic, validatable and compilable into a target-specific performance plan.

The product is not trying to become a general game engine. The valuable layer is the bridge between:

```text
human-friendly writing
→ structured intent
→ target-aware validation
→ deterministic performance plan
→ renderer / exporter
```

The editor should hide this machinery during ordinary writing and reveal it only for precision editing, diagnosis, adaptation or export.

## 2. Product priorities

Prioritize in this order:

1. **Authoring feel** — writing must be fast enough that structure does not feel like database administration.
2. **Immediate feedback** — authors need to see or hear what their script means before adding more complexity.
3. **One source of truth** — Editor, AI, Validator and Compiler must share the same document and capability model.
4. **Content productivity** — adding a character or action should mostly be Content Pack work, not editor surgery.
5. **Adapter proof** — Core generality should be proven by a second genuinely different Adapter, not by speculative abstractions.
6. **AI assistance** — AI should manipulate structured intent through the same capabilities as the human editor, not bypass the model with raw prose generation.

## 3. Explicit non-goals for the next stages

Do not prioritize yet:

- a general-purpose game engine;
- a full nonlinear visual scripting graph;
- a DAW-like timeline as the primary authoring surface;
- multiplayer collaboration;
- plugin marketplace / cloud asset marketplace;
- branches, variables and macro languages merely because other narrative engines have them;
- a universal renderer IR shared by every future Adapter;
- broad backwards-compatibility promises before the file format is proven by real projects.

These may become relevant later, but they should not distort the current product.

---

# Phase P1-d — Mobile-first authoring hardening

## Goal

Make the current conversation-first authoring loop comfortable on a phone, not merely responsive enough to fit.

## Why now

P1-c established the right desktop interaction model. Mobile use is a useful stress test because it exposes every piece of unnecessary editor chrome and every interaction that still assumes a mouse, hover state or wide inspector.

## Scope

- Treat 360–430 px width as a first-class target.
- Keep the composer continuously reachable above the virtual keyboard and safe-area inset.
- Convert rehearsal/diagnostics into a bottom sheet or full-screen secondary surface on mobile.
- Provide a compact scene/block navigator because the desktop outline is hidden on mobile.
- Ensure all important controls meet comfortable touch-target sizing.
- Make Action / Scene pickers searchable and thumb-friendly.
- Verify Chinese IME composition, Enter/Shift+Enter behavior and focus restoration on mobile browsers.
- Add a short first-run hint rather than persistent instructional chrome.
- Preserve the same canonical `ScriptDocument`; no mobile-specific document model.

## Exit criteria

An author should be able to create a short five-character Courtroom scene, add actions/cues, fix one invalid token and export the project using only a phone without needing desktop recovery.

---

# Phase P2 — Narrow Courtroom playback

## Goal

Close the first complete author feedback loop:

```text
write → validate → compile → play → revise
```

## Scope

The hosted repository already includes a narrow asset-backed preview with paragraph navigation, grapheme-aware text, waits and cancellation. Extend that implementation after phone acceptance; do not replace it. The remaining scope is to make the full Courtroom Performance Plan observable:

- speaker / character stage slots;
- background changes;
- pose/reaction state changes;
- text reveal;
- wait / emphasis / flash / shake;
- SFX and BGM hooks;
- play / pause / restart / step controls;
- deterministic playback from the existing plan.

Use placeholder/open assets or simple generated primitives. Do not make asset fidelity the milestone.

## Architecture rule

Renderer consumes the adapter-specific Performance Plan. It must not reinterpret `ScriptDocument` directly.

## Exit criteria

The showcase scene can be authored and played end-to-end, and a compiler/renderer mismatch can be diagnosed without reading browser DOM state.

---

# Phase P2-b — Playback-aware authoring

## Goal

Use playback to improve writing without turning the editor into a timeline application.

## Scope

- play from selected Dialogue/Cue;
- highlight the currently executing block/token;
- jump from playback issue to source token;
- lightweight duration editing for wait/text pacing where the Adapter permits it;
- fast replay of the last changed segment;
- clear distinction between author intent and renderer-derived timing.

## Non-goal

No general freeform timeline. Timing controls should remain contextual unless real projects prove a timeline is necessary.

---

# Phase P3 — Content Pack workflow

## Goal

Make “add content” substantially cheaper than “change code.”

## Scope

- formal Content Pack schema and validation;
- character/cast editor;
- pose/reaction capability editor;
- background/audio resource registry;
- friendly missing-resource diagnostics;
- portable pack import/export;
- pack version/migration rules based on actual incompatibilities;
- test fixtures generated from pack declarations where practical.

## Exit criteria

A technically literate creator can add a new Courtroom character with several actions and resources without editing editor or compiler source files.

---

# Phase P4 — Structured AI co-authoring

## Goal

Let AI accelerate script work without creating a second, unvalidated representation of the project.

## Principle

AI must query the same Capability Registry and submit the same document operations as the editor.

## Initial workflows

- continue a dialogue while respecting cast and available actions;
- suggest 2–4 valid performance variants for a selected passage;
- convert plain dialogue into structured dialogue + token suggestions;
- explain diagnostics and propose explicit quick fixes;
- refactor pacing while preserving spoken text;
- summarize a scene's cast, state changes and unresolved diagnostics.

## Safety / product rule

AI suggestions should be previewable diffs or explicit operations. Do not silently rewrite authored intent.

---

# Phase P5 — Second Adapter proof

## Goal

Test whether the Core is actually general rather than merely Courtroom code with abstractions around it.

## Timing

Do this only after Courtroom authoring + playback is useful enough to reveal what abstractions matter.

## Recommended second Adapter

Use a deliberately different but still compact format, such as **chat drama / messaging conversation**:

- messages rather than stage poses;
- sender/avatar state;
- typing/wait/read cues;
- image/sticker/system-message events;
- different presentation plan and renderer.

This creates more architectural pressure than another visual-novel-like stage system while remaining small enough to finish.

## Exit criteria

The second Adapter can reuse Core/editor infrastructure without adding its semantics to Core, and any required Core changes are demonstrably generic.

---

# Phase P6 — Adapter SDK and external interoperability

## Goal

Turn the proven internal architecture into a stable extension surface.

Possible scope after P5:

- Adapter authoring SDK and templates;
- schema/version tooling;
- compatibility test harness;
- Content Pack tooling;
- target exporters/importers where they create real value;
- optional objection.lol or other ecosystem bridge if demand remains useful.

Do not freeze a public SDK before the second Adapter has forced the architecture to prove itself.

---

# Phase P7 — Project-scale workflow

Only after the core author/play loop is strong:

- project library;
- multi-document navigation;
- reusable cast/content dependencies;
- scene organization;
- search/references;
- project-wide diagnostics;
- migration UI;
- optional cloud sync/collaboration.

This is where Yahari Script becomes comfortable for real projects rather than demos.

---

## 4. Decision gates

### Gate A — after P1-d

Question: **Can a new user write and structure a short scene without learning the data model first?**

If no, keep fixing authoring UX. Do not start adding engine features to compensate.

### Gate B — after P2/P2-b

Question: **Does immediate playback materially improve script iteration?**

If yes, invest in content and AI around that loop. If not, diagnose whether the problem is renderer fidelity, authoring semantics or performance-plan design.

### Gate C — after P3

Question: **Can content grow independently from the editor/compiler codebase?**

If no, fix Content Pack architecture before building an ecosystem.

### Gate D — after P5

Question: **Did a genuinely different Adapter fit without contaminating Core?**

Only after this gate should the Adapter SDK be treated as a public product surface.

---

## 5. Current recommended sequence

```text
P1-c  Authoring UX + richer demo       DONE
  ↓
P1-d  Mobile-first authoring           IMPLEMENTED SLICE; PHONE GATE OPEN
  ↓
P2    Narrow Courtroom playback       PARTIAL IN HOSTED SOURCE
  ↓
P2-b  Playback-aware editing
  ↓
P3    Content Pack workflow
  ↓
P4    Structured AI co-authoring
  ↓
P5    Second Adapter proof
  ↓
P6    Adapter SDK / interoperability
  ↓
P7    Project-scale workflow
```

The important sequencing choice is **Renderer before AI, and second Adapter before public SDK**. Playback gives the author an objective feedback loop; the second Adapter gives the architecture an objective generality test.

## 2026-09-24 acceptance status

Mobile navigation, diagnostics surfaces, viewport compensation, touch picker and IME command guards are implemented in the canonical hosted source. 47 automated tests and the 26-module static check pass. Browser preview is blocked by its missing live-server dependency; no visual or physical-device acceptance is claimed. The five-character phone journey remains open: the current hosted pack exposes two characters. Expand the pack only after confirming present authoring controls, then complete the P1-d gate before broadening playback.

## 2026-09-26 cast recovery (supersedes earlier counts)
- Root completed integration directly; no subagent execution in this correction. Previous recovery remained uncommitted and unpublished.
- Five actors: Phoenix, Edgeworth, Maya, Judge and Larry (witness); 26 actions with local images, three scenes and correct stations. Witness shocked and nervous intentionally share the source nervous expression; actions are not claimed as 26 unique animations.
- Built-in old sample cast upgrades additively; custom/imported cast identities remain intact, while missing built-in characters are selected directly from the speaker picker. Existing dialogue, aliases and drafts remain intact. Five-person showcase opens independently.
- Verification: 52 passing tests, 28 resolved modules, 34 images verified for source hash and crop bounds; composited all 26 actions for manual asset inspection. Browser/mobile interaction remains unverified (previous managed preview infrastructure unavailable).
- Preview uses representative frames; full animation and audio playback are not implemented.

# Yahari Script architecture decisions — through P1-a

1. **Project is Adapter-bound.** `ProjectManifest.adapter` is required and versioned.
2. **Core is adapter-agnostic.** Core knows typed tokens, not Courtroom semantics.
3. **ScriptDocument stores intent.** It never stores sprite paths, DOM selectors, frame numbers, or renderer calls.
4. **Typed Token semantics are explicit.** Position in text does not change token type.
5. **Rich-node order is the MVP timeline.** No separate timeline is introduced.
6. **Capabilities are shared truth.** Picker, validator, AI tooling, and compiler query the same registry.
7. **Invalid tokens are data, not garbage.** Changing speaker preserves incompatible tokens and surfaces diagnostics.
8. **Compiler is strict.** It refuses invalid capability references rather than guessing substitutes.
9. **Courtroom Performance Plan is adapter-specific.** Core does not define a universal execution IR.
10. **Renderer still comes after authoring UX validation.** P1-a ends at a live Performance Plan inspector.
11. **Speaker-following is explicit.** `{ kind: "speaker" }` follows DialogueBlock speaker; fixed `{ kind: "cast", id }` does not.
12. **Insertion scope is explicit editor context.** Adapter candidate generation receives `inline` vs `block`, so impossible-scope choices are filtered before insertion.
13. **Editor is model-first.** Browser DOM is not canonical data. It round-trips into `ScriptDocument` and all derived state is recalculated from the model.
14. **EditorStore contains no Courtroom rules.** It applies generic document mutations and Adapter-produced Quick Fixes.
15. **Typing history is session-grouped.** Character-by-character input is not one undo step per keystroke.
16. **CueBlock is first-class authoring data.** Block-level actions are authored through the same Adapter candidate mechanism, not a separate hard-coded editor menu.
17. **Fixed-target actions must be visibly distinguishable.** Chips and picker metadata expose fixed cast targets so an action on Judge cannot masquerade as a speaker-relative action on Phoenix.

## Updates — 2026-09-23

18. Courtroom preview now exists in `apps/editor/src/preview.ts` with a separately testable playback controller; earlier renderer-absence statements are historical checkpoints.
19. Import structure and semantic validity are separate gates. Malformed structure or duplicate addressing IDs must not activate; structurally sound unknown/invalid actions remain repairable data.
20. Identity uniqueness for blocks and tokens is document-local. Cast, pack and document declarations are unique within their manifest.
21. Legacy bare documents receive schema and identity checks before the binding dialog. All explicit activation paths revalidate before mutating state or saving.

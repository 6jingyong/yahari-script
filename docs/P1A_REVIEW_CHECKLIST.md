# P1-a review checklist

Run:

```bash
npm run serve
```

Open `http://127.0.0.1:4173/apps/editor/`.

## 1. Normal writing

Click inside Phoenix's line and type before / between / after existing Token Chips.

Expected:

- Chips behave as atomic objects.
- Text remains ordinary direct input.
- The right-side Performance Plan updates from the document model.

## 2. Inline action picker

Place the caret in Phoenix's dialogue and press `/`.

Expected:

- Phoenix `normal`, `point`, and `sweat` are recommended.
- Other-character actions may still be available but explicitly show their fixed target.
- `Background` is absent because it is block-only.

Choose an action and verify it appears exactly at the caret position.

## 3. Invalid-token preservation

Change the first Dialogue speaker from Phoenix to Judge.

Expected:

- Phoenix's speaker-bound `point` Token is not deleted.
- It turns invalid/red.
- Diagnostics reports the missing capability.
- Performance Plan refuses to compile while the error remains.

Try the offered fixes:

- `Replace with normal`
- `Retarget to phoenix`
- `Remove token`

Both Replace and Retarget should restore compilability.

## 4. CueBlock authoring

Click `+ Cue`.

Expected:

- The Picker switches to block-level actions.
- `Background`, `BGM`, `SFX`, `Wait` are available.
- inline-only Pose/Reaction are absent.

Insert a Background or BGM cue and inspect the Plan order.

## 5. Undo / Redo

Type several characters in one focus session, then leave the editor and Undo.

Expected:

- The typing session reverses as one conceptual edit, not one character at a time.

Also test Undo/Redo for Token insertion, speaker changes, and Cue creation.

## 6. Persistence / export

Reload the page.

Expected:

- Local draft is preserved.

Use `Export JSON` and inspect that the output is a `ScriptDocument`, not DOM/renderer state.

Use `Reset demo` to clear the local draft and return to the fixture.

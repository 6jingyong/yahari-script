import assert from "node:assert/strict";
import test from "node:test";

import { isImeCompositionKey } from "../packages/editor-core/src/index.js";

test("IME composition keys are excluded from editor shortcuts", () => {
  assert.equal(isImeCompositionKey({ isComposing: true, keyCode: 13 }), true);
  assert.equal(isImeCompositionKey({ isComposing: false, keyCode: 229 }), true);
});

test("ordinary keyboard events remain available to editor shortcuts", () => {
  assert.equal(isImeCompositionKey({ isComposing: false, keyCode: 13 }), false);
  assert.equal(isImeCompositionKey({ isComposing: false, keyCode: 191 }), false);
});

import { CompositionGuard } from "../packages/editor-core/src/index.js";

test("composition lifecycle protects Enter even when browser flags end early", () => {
  const guard = new CompositionGuard();
  const enter = { key: "Enter", isComposing: false, keyCode: 13 };
  guard.start();
  assert.equal(guard.blocks(enter, 1000), true);
  guard.end(1000);
  assert.equal(guard.blocks(enter, 1001), true);
  assert.equal(guard.blocks(enter, 1099), true);
  assert.equal(guard.blocks(enter, 1100), false);
  assert.equal(guard.blocks({ ...enter, key: "/", keyCode: 191 }, 1001), false);
});

test("composition guards are isolated between editing surfaces", () => {
  const composer = new CompositionGuard();
  const picker = new CompositionGuard();
  const enter = { key: "Enter", isComposing: false, keyCode: 13 };
  composer.start();
  assert.equal(composer.blocks(enter, 0), true);
  assert.equal(picker.blocks(enter, 0), false);
  assert.equal(picker.blocks({ ...enter, keyCode: 229 }, 0), true);
});

import assert from "node:assert/strict";
import test from "node:test";

import { courtroomAdapter } from "../packages/adapters/courtroom/src/index.js";
import { EditorStore } from "../packages/editor-core/src/index.js";
import type { ScriptDocument } from "../packages/core/src/index.js";
import { demoDocument, demoProject } from "../examples/courtroom-demo-project/fixture.js";

test("editor store preserves speaker-bound token when speaker changes", () => {
  const store = new EditorStore(demoDocument);
  store.updateSpeaker("blk-1", { castId: "judge" });
  const block = store.document.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");
  assert.equal(block.speaker?.castId, "judge");
  assert.equal(
    block.content.some((node) => node.type === "token" && node.token.id === "tok-2"),
    true,
  );
});

test("typing edit session becomes one undo step", () => {
  const store = new EditorStore(demoDocument);
  const before = store.document;
  const block = before.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");

  store.beginEditSession();
  store.replaceDialogueContent("blk-1", [...block.content, { type: "text", text: " A" }], false);
  store.replaceDialogueContent("blk-1", [...block.content, { type: "text", text: " AB" }], false);
  store.commitEditSession();

  assert.equal(store.canUndo, true);
  store.undo();
  assert.deepEqual(store.document, demoDocument);
  assert.equal(store.canRedo, true);
  store.redo();
  assert.equal(JSON.stringify(store.document).includes(" AB"), true);
});

test("remove-token quick fix deletes inline token atomically", () => {
  const document: ScriptDocument = structuredClone(demoDocument);
  const store = new EditorStore(document);
  store.applyQuickFix("tok-2", { kind: "remove-token", label: "Remove token" });
  const block = store.document.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");
  assert.equal(block.content.some((node) => node.type === "token" && node.token.id === "tok-2"), false);
});

test("replace and retarget fixes from validator both restore compilability", () => {
  const changed: ScriptDocument = structuredClone(demoDocument);
  const block = changed.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");
  block.speaker = { castId: "judge" };

  const diagnostic = courtroomAdapter
    .validate(changed, demoProject)
    .find((item) => item.location?.tokenId === "tok-2" && item.code === "courtroom.capability.missing");
  assert.ok(diagnostic);

  const replace = diagnostic.fixes?.find((fix) => fix.kind === "replace-token");
  assert.ok(replace);
  const replaceStore = new EditorStore(changed);
  replaceStore.applyQuickFix("tok-2", replace);
  assert.equal(
    courtroomAdapter.validate(replaceStore.document, demoProject).some((item) => item.severity === "error"),
    false,
  );

  const retarget = diagnostic.fixes?.find((fix) => fix.kind === "retarget-token");
  assert.ok(retarget);
  const retargetStore = new EditorStore(changed);
  retargetStore.applyQuickFix("tok-2", retarget);
  assert.equal(
    courtroomAdapter.validate(retargetStore.document, demoProject).some((item) => item.severity === "error"),
    false,
  );
});


test("cue blocks are first-class editor-store operations", () => {
  const store = new EditorStore(demoDocument);
  store.addCueBlock({
    id: "cue-1",
    type: "cue",
    cue: {
      id: "tok-cue-1",
      type: "courtroom.background",
      params: { resource: { packId: "official.courtroom-demo", id: "background/courtroom" } },
    },
  }, "blk-1");
  assert.equal(store.document.blocks[1]?.type, "cue");
  store.replaceCueToken("cue-1", {
    id: "tok-cue-2",
    type: "courtroom.bgm",
    params: { resource: { packId: "official.courtroom-demo", id: "audio/bgm/trial" } },
  });
  const cue = store.document.blocks[1];
  if (cue?.type !== "cue") throw new Error("Expected cue block");
  assert.equal(cue.cue.type, "courtroom.bgm");
  store.removeBlock("cue-1");
  assert.equal(store.document.blocks.length, 1);
});

test("loading an imported document resets undo and redo history", () => {
  const store = new EditorStore(demoDocument);
  store.updateSpeaker("blk-1", { castId: "judge" });
  assert.equal(store.canUndo, true);

  const imported: ScriptDocument = structuredClone(demoDocument);
  imported.documentId = "imported";
  imported.title = "Imported";
  store.loadDocument(imported);

  assert.equal(store.document.documentId, "imported");
  assert.equal(store.canUndo, false);
  assert.equal(store.canRedo, false);
});

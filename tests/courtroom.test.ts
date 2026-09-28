import assert from "node:assert/strict";
import test from "node:test";

import { courtroomAdapter } from "../packages/adapters/courtroom/src/index.js";
import type { ScriptDocument } from "../packages/core/src/index.js";
import { demoDocument, demoProject } from "../examples/courtroom-demo-project/fixture.js";

function contextFor(speaker: string) {
  return {
    projectId: demoProject.manifest.projectId,
    documentId: demoDocument.documentId,
    adapterId: demoProject.manifest.adapter.id,
    adapterVersion: demoProject.manifest.adapter.version,
    speaker: { castId: speaker },
  } as const;
}

test("Phoenix pose picker recommends capabilities Phoenix actually has", () => {
  const candidates = courtroomAdapter.getTokenCandidates(
    contextFor("phoenix"),
    demoProject,
    { type: "courtroom.pose" },
  );

  const phoenixPoses = candidates
    .filter((candidate) => candidate.availability === "recommended")
    .map((candidate) => candidate.params.pose);

  assert.deepEqual(phoenixPoses.sort(), ["desk", "normal", "objection", "point", "smile", "think"]);
  assert.equal(candidates.every((candidate) => candidate.enabled), true);
});

test("Judge has normal but not point capability", () => {
  const registry = courtroomAdapter.buildCapabilityRegistry(demoProject);
  assert.equal(
    registry.supports({
      kind: "courtroom.pose",
      subject: { kind: "cast", id: "judge" },
      params: { pose: "normal" },
    }),
    true,
  );
  assert.equal(
    registry.supports({
      kind: "courtroom.pose",
      subject: { kind: "cast", id: "judge" },
      params: { pose: "point" },
    }),
    false,
  );
});

test("Changing speaker preserves invalid token and validator flags it", () => {
  const changed: ScriptDocument = structuredClone(demoDocument);
  const block = changed.blocks[0];
  if (block.type !== "dialogue") throw new Error("Expected dialogue block");
  block.speaker = { castId: "judge" };

  // Tokens are explicitly bound to `speaker`, so changing the block speaker
  // changes their resolved subject without mutating/deleting the tokens.
  const diagnostics = courtroomAdapter.validate(changed, demoProject);
  assert.equal(block.content.some((node) => node.type === "token" && node.token.params.pose === "point"), true);
  assert.equal(
    diagnostics.some(
      (item) => item.code === "courtroom.capability.missing" && item.location?.tokenId === "tok-2",
    ),
    true,
  );
});


test("Explicit cast-bound token does not follow later speaker changes", () => {
  const changed: ScriptDocument = structuredClone(demoDocument);
  const block = changed.blocks[0];
  if (block.type !== "dialogue") throw new Error("Expected dialogue block");
  const pointNode = block.content.find(
    (node) => node.type === "token" && node.token.params.pose === "point",
  );
  assert.ok(pointNode && pointNode.type === "token");
  pointNode.token.subject = { kind: "cast", id: "phoenix" };
  block.speaker = { castId: "judge" };

  const diagnostics = courtroomAdapter.validate(changed, demoProject);
  assert.equal(
    diagnostics.some((item) => item.location?.tokenId === "tok-2" && item.severity === "error"),
    false,
  );
});

test("Inline rich-node order lowers deterministically into performance order", () => {
  const plan = courtroomAdapter.compile(demoDocument, demoProject);
  assert.deepEqual(plan.instructions, [
    { op: "speaker", castId: "phoenix" },
    { op: "pose", castId: "phoenix", pose: "normal" },
    { op: "showText", text: "我认为——" },
    { op: "pose", castId: "phoenix", pose: "point" },
    { op: "showText", text: "真正的犯人就是你！" },
  ]);
});

test("Compiler refuses invalid capability rather than guessing", () => {
  const invalid: ScriptDocument = structuredClone(demoDocument);
  const block = invalid.blocks[0];
  if (block.type !== "dialogue") throw new Error("Expected dialogue block");
  const pointNode = block.content.find(
    (node) => node.type === "token" && node.token.params.pose === "point",
  );
  assert.ok(pointNode && pointNode.type === "token");
  pointNode.token.subject = { kind: "cast", id: "judge" };

  assert.throws(() => courtroomAdapter.compile(invalid, demoProject), /courtroom\.capability\.missing/);
});


test("inline picker excludes block-only token types", () => {
  const candidates = courtroomAdapter.getTokenCandidates(
    { ...contextFor("phoenix"), insertionScope: "inline" },
    demoProject,
  );
  assert.equal(candidates.some((candidate) => candidate.tokenType === "courtroom.background"), false);
  assert.equal(candidates.some((candidate) => candidate.tokenType === "courtroom.pose"), true);
});


test("missing capability offers replace, retarget, and remove quick fixes", () => {
  const changed: ScriptDocument = structuredClone(demoDocument);
  const block = changed.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");
  block.speaker = { castId: "judge" };

  const diagnostic = courtroomAdapter
    .validate(changed, demoProject)
    .find((item) => item.location?.tokenId === "tok-2" && item.code === "courtroom.capability.missing");
  assert.ok(diagnostic);
  assert.equal(diagnostic.fixes?.some((fix) => fix.kind === "replace-token"), true);
  assert.equal(diagnostic.fixes?.some((fix) => fix.kind === "retarget-token"), true);
  assert.equal(diagnostic.fixes?.some((fix) => fix.kind === "remove-token"), true);
});


test("block picker keeps non-scene block cues but background is directory-managed", () => {
  const candidates = courtroomAdapter.getTokenCandidates(
    {
      projectId: demoProject.manifest.projectId,
      documentId: demoDocument.documentId,
      adapterId: demoProject.manifest.adapter.id,
      adapterVersion: demoProject.manifest.adapter.version,
      insertionScope: "block",
      speaker: null,
    },
    demoProject,
  );
  assert.equal(candidates.some((candidate) => candidate.tokenType === "courtroom.background"), false);
  assert.equal(candidates.some((candidate) => candidate.tokenType === "courtroom.bgm"), true);
  assert.equal(candidates.some((candidate) => candidate.tokenType === "courtroom.pose"), false);
});


test("cue blocks lower in document order without inventing a speaker", () => {
  const withCue: ScriptDocument = structuredClone(demoDocument);
  withCue.blocks.push({
    id: "cue-bg",
    type: "cue",
    cue: {
      id: "tok-bg",
      type: "courtroom.background",
      params: { resource: { packId: "official.courtroom-demo", id: "background/courtroom" } },
    },
  });
  const plan = courtroomAdapter.compile(withCue, demoProject);
  assert.deepEqual(plan.instructions.at(-1), {
    op: "background",
    resource: { packId: "official.courtroom-demo", id: "background/courtroom" },
  });
});


test("authoring candidates never expose another character from the same dialogue",()=>{
  const candidates=courtroomAdapter.getTokenCandidates(
    {...contextFor("phoenix"),insertionScope:"inline"},
    demoProject,
  );
  assert.equal(candidates.some(candidate=>candidate.subject?.kind==="cast"),false);
  assert.equal(candidates.filter(candidate=>candidate.category==="Character").every(candidate=>candidate.subject?.kind==="speaker"),true);
  assert.equal(candidates.some(candidate=>candidate.tokenType==="courtroom.focus"&&candidate.subject?.kind==="speaker"),true);
});

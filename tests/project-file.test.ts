import assert from "node:assert/strict";
import test from "node:test";

import {
  createProjectFile,
  decodeProjectFile,
  type ProjectFileCatalog,
} from "../packages/core/src/index.js";
import { demoDocument, demoManifest } from "../examples/courtroom-demo-project/fixture.js";
import { courtroomAdapter } from "../packages/adapters/courtroom/src/index.js";
import { demoProject } from "../examples/courtroom-demo-project/fixture.js";

const catalog: ProjectFileCatalog = {
  adapters: [{ id: "official.courtroom", version: "0.1.0" }],
  contentPacks: [{ id: "official.courtroom-demo", version: "0.1.0" }],
};

test("portable project file round-trips with manifest binding intact", () => {
  const source = createProjectFile(demoManifest, [demoDocument]);
  const decoded = decodeProjectFile(JSON.parse(JSON.stringify(source)), catalog);
  assert.equal(decoded.ok && decoded.kind === "project", true);
  if (!decoded.ok || decoded.kind !== "project") return;
  assert.equal(decoded.project.manifest.adapter.id, "official.courtroom");
  assert.equal(decoded.project.documents[0]?.documentId, demoDocument.documentId);
  assert.deepEqual(decoded.project, source);
});

test("legacy bare document requires explicit binding before migration", () => {
  const unbound = decodeProjectFile(demoDocument, catalog);
  assert.equal(unbound.ok && unbound.kind === "unbound-document", true);
  if (unbound.ok && unbound.kind === "unbound-document") {
    assert.equal(unbound.requiresBinding, true);
    assert.equal(unbound.document.documentId, demoDocument.documentId);
  }
  const migrated = decodeProjectFile(demoDocument, catalog, demoManifest);
  assert.equal(migrated.ok && migrated.kind === "project", true);
  if (!migrated.ok || migrated.kind !== "project") return;
  assert.equal(migrated.migratedFrom, "document@0.6");
  assert.equal(migrated.project.manifest.entryDocumentId, demoDocument.documentId);
});

test("import preserves a project with unavailable Adapter in read-only mode", () => {
  const source = createProjectFile(demoManifest, [demoDocument]);
  source.manifest.adapter.version = "99.0.0";
  const decoded = decodeProjectFile(source, catalog);
  assert.equal(decoded.ok && decoded.kind === "project", true);
  if (!decoded.ok || decoded.kind !== "project") return;
  assert.equal(decoded.availability, "missing-adapter");
  assert.equal(decoded.issues.some((item) => item.code === "project.adapter.unavailable"), true);
});

test("import preserves a project with unavailable Content Pack in read-only mode", () => {
  const source = createProjectFile(demoManifest, [demoDocument]);
  source.manifest.contentPacks = [{ id: "missing.pack", version: "1.0.0" }];
  const decoded = decodeProjectFile(source, catalog);
  assert.equal(decoded.ok && decoded.kind === "project", true);
  if (!decoded.ok || decoded.kind !== "project") return;
  assert.equal(decoded.availability, "missing-content-pack");
  assert.equal(decoded.issues.some((item) => item.code === "project.pack.unavailable"), true);
});

test("import rejects a missing entry document", () => {
  const source = createProjectFile(demoManifest, [demoDocument]);
  source.manifest.entryDocumentId = "missing-document";
  const decoded = decodeProjectFile(source, catalog);
  assert.equal(decoded.ok, false);
  if (decoded.ok) return;
  assert.equal(decoded.issues.some((item) => item.code === "project.entry.missing"), true);
});

test("project export/import preserves deterministic compile output", () => {
  const before = courtroomAdapter.compile(demoDocument, demoProject);
  const encoded = JSON.stringify(createProjectFile(demoManifest, [demoDocument]));
  const decoded = decodeProjectFile(JSON.parse(encoded), catalog);
  assert.equal(decoded.ok && decoded.kind === "project", true);
  if (!decoded.ok || decoded.kind !== "project") return;
  const imported = decoded.project.documents[0];
  assert.ok(imported);
  const after = courtroomAdapter.compile(imported, demoProject);
  assert.deepEqual(after, before);
});

test("invalid speaker-bound tokens survive project round-trip", () => {
  const invalid = structuredClone(demoDocument);
  const block = invalid.blocks[0];
  if (block?.type !== "dialogue") throw new Error("Expected dialogue block");
  block.speaker = { castId: "judge" };
  const source = createProjectFile(demoManifest, [invalid]);
  const decoded = decodeProjectFile(JSON.parse(JSON.stringify(source)), catalog);
  assert.equal(decoded.ok && decoded.kind === "project", true);
  if (!decoded.ok || decoded.kind !== "project") return;
  const imported = decoded.project.documents[0];
  assert.ok(imported);
  assert.equal(
    courtroomAdapter.validate(imported, demoProject).some(
      (item) => item.code === "courtroom.capability.missing" && item.location?.tokenId === "tok-2",
    ),
    true,
  );
});

// JSON boundary regressions: none of these files may become the active project.
for (const [name, mutate] of [
  ["non-coercible file version", (p: any) => { p.fileVersion = {toString: null}; }],
  ["non-coercible mark type", (p: any) => { p.documents[0].blocks[0].content.push({type: "text", text: "x", marks: [{type: {toString: null}}]}); }],
  ["null document reference", (p: any) => { p.manifest.documents = [null]; }],
  ["null cast member", (p: any) => { p.manifest.cast = [null]; }],
  ["missing character reference", (p: any) => { delete p.manifest.cast[0].characterRef; }],
  ["non-string display name", (p: any) => { p.manifest.cast[0].displayName = {}; }],
  ["duplicate cast identity", (p: any) => { p.manifest.cast.push(p.manifest.cast[0]); }],
  ["duplicate block identity", (p: any) => { p.documents[0].blocks.push(p.documents[0].blocks[0]); }],
  ["duplicate token identity across blocks", (p: any) => {
    const token = p.documents[0].blocks.flatMap((b: any) => b.type === "cue" ? [b.cue] : b.content.filter((n: any) => n.type === "token").map((n: any) => n.token))[0];
    p.documents[0].blocks.push({id: "new-cue", type: "cue", cue: token});
  }],
  ["invalid marks", (p: any) => { p.documents[0].blocks[0].content.push({type: "text", text: "hello", marks: [null]}); }],
  ["unknown subject discriminant", (p: any) => { p.documents[0].blocks.push({id: "new-cue", type: "cue", cue: {id: "new-token", type: "unknown", params: {}, subject: {kind: "typo", id: "phoenix"}}}); }],
  ["duplicate pack declaration", (p: any) => { p.manifest.contentPacks.push(p.manifest.contentPacks[0]); }],
  ["duplicate document declaration", (p: any) => { p.manifest.documents.push(p.manifest.documents[0]); }],
] as Array<[string, (p: any) => void]>) {
  test(`rejects ${name} without throwing or mutating input`, () => {
    const source = createProjectFile(demoManifest, [demoDocument]);
    mutate(source);
    const before = JSON.stringify(source);
    const decoded = decodeProjectFile(source, catalog);
    assert.equal(decoded.ok, false);
    assert.equal(JSON.stringify(source), before);
    // Missing dependencies must not weaken structural safety.
    assert.equal(decodeProjectFile(source, {adapters: [], contentPacks: []}).ok, false);
  });
}

test("legacy documents undergo version and identity checks before binding", () => {
  const future = structuredClone(demoDocument);
  future.schemaVersion = "999";
  assert.equal(decodeProjectFile(future, catalog).ok, false);
  assert.equal(decodeProjectFile(future, catalog, demoManifest).ok, false);
  const duplicate = structuredClone(demoDocument);
  duplicate.blocks.push(duplicate.blocks[0]);
  assert.equal(decodeProjectFile(duplicate, catalog).ok, false);
});

test("valid multi-document archive permits document-local IDs and preserves extension data", () => {
  const second = structuredClone(demoDocument);
  second.documentId = "second-document";
  const source = createProjectFile(demoManifest, [demoDocument, second]);
  source.manifest.documents.push({id: second.documentId, path: "second.json"});
  source.documents[0].metadata = {custom: {nested: [1, "二"]}};
  const decoded = decodeProjectFile(source, catalog);
  assert.equal(decoded.ok, true);
  if (!decoded.ok || decoded.kind !== "project") return;
  assert.deepEqual(decoded.project, source);
});

test("unknown token types and missing cast references remain repairable data", () => {
  const source = createProjectFile(demoManifest, [demoDocument]);
  source.documents[0].blocks.push({id: "repairable", type: "dialogue", speaker: {castId: "missing"}, content: [{type: "token", token: {id: "future-token", type: "custom.future", params: {nested: {value: 3}}, subject: {kind: "cast", id: "missing"}}}]});
  const decoded = decodeProjectFile(source, catalog);
  assert.equal(decoded.ok, true);
  if (!decoded.ok || decoded.kind !== "project") return;
  assert.deepEqual(decoded.project, source);
});

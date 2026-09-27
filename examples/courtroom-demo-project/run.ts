import { courtroomAdapter } from "../../packages/adapters/courtroom/src/index.js";
import { demoDocument, demoProject } from "./fixture.js";

const candidates = courtroomAdapter.getTokenCandidates(
  {
    projectId: demoProject.manifest.projectId,
    documentId: demoDocument.documentId,
    adapterId: demoProject.manifest.adapter.id,
    adapterVersion: demoProject.manifest.adapter.version,
    speaker: { castId: "phoenix" },
  },
  demoProject,
  { category: "Character" },
);

console.log("Character candidates for Phoenix:");
for (const candidate of candidates) {
  console.log(`- ${candidate.label} -> ${candidate.tokenType} ${JSON.stringify(candidate.params)}`);
}

console.log("\nValidation:");
console.log(courtroomAdapter.validate(demoDocument, demoProject));

console.log("\nPerformance plan:");
console.log(JSON.stringify(courtroomAdapter.compile(demoDocument, demoProject), null, 2));

import type { AdapterManifest } from "../../../core/src/index.js";

export const courtroomManifest: AdapterManifest = {
  id: "official.courtroom",
  version: "0.1.0",
  name: "Courtroom",
  description: "Official courtroom-style performance adapter for Yahari Script.",
  coreCompatibility: ">=0.6 <0.7",
  tokenNamespaces: ["courtroom"],
  performancePlanType: "courtroom.performance-plan.v1",
};

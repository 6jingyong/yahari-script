import type {
  AdapterProjectInitInput,
  AdapterProjectProfile,
  EditorContext,
  ProjectContext,
  TokenPickerQuery,
  YahariAdapter,
} from "../../../core/src/index.js";
import { courtroomManifest } from "./manifest.js";
import { courtroomTokenTypes } from "./token-types.js";
import { buildCourtroomCapabilityRegistry } from "./registry.js";
import { getCourtroomTokenCandidates } from "./candidates.js";
import { validateCourtroomDocument } from "./validator.js";
import { compileCourtroomDocument } from "./compiler.js";
import type { CourtroomContentPack, CourtroomPerformancePlan } from "./types.js";

export const courtroomAdapter: YahariAdapter<CourtroomPerformancePlan, CourtroomContentPack> = {
  manifest: courtroomManifest,
  tokenTypes: courtroomTokenTypes,

  createProjectProfile(input: AdapterProjectInitInput): AdapterProjectProfile {
    return {
      projectId: input.projectId,
      title: input.title,
      adapter: courtroomManifest.id,
    };
  },

  buildCapabilityRegistry(project: ProjectContext<CourtroomContentPack>) {
    return buildCourtroomCapabilityRegistry(project);
  },

  getTokenCandidates(
    context: EditorContext,
    project: ProjectContext<CourtroomContentPack>,
    query?: TokenPickerQuery,
  ) {
    return getCourtroomTokenCandidates(context, project, query);
  },

  validate: validateCourtroomDocument,
  compile: compileCourtroomDocument,
};

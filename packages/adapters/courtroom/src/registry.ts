import {
  InMemoryCapabilityRegistry,
  type Capability,
  type ProjectContext,
} from "../../../core/src/index.js";
import type { CourtroomContentPack } from "./types.js";

function findPack(project: ProjectContext<CourtroomContentPack>, packId: string): CourtroomContentPack | undefined {
  return project.contentPacks.find((pack) => pack.id === packId);
}

export function buildCourtroomCapabilityRegistry(
  project: ProjectContext<CourtroomContentPack>,
): InMemoryCapabilityRegistry {
  const capabilities: Capability[] = [];

  for (const castMember of project.manifest.cast) {
    const pack = findPack(project, castMember.characterRef.packId);
    const character = pack?.characters.find((item) => item.id === castMember.characterRef.id);
    if (!pack || !character) continue;

    for (const pose of character.poses) {
      capabilities.push({
        id: `cap:${castMember.castId}:pose:${pose.id}`,
        kind: "courtroom.pose",
        subject: { kind: "cast", id: castMember.castId },
        params: { pose: pose.id },
        source: pose.asset,
      });
    }

    for (const reaction of character.reactions) {
      capabilities.push({
        id: `cap:${castMember.castId}:reaction:${reaction.id}`,
        kind: "courtroom.reaction",
        subject: { kind: "cast", id: castMember.castId },
        params: { reaction: reaction.id },
        source: reaction.asset,
      });
    }
  }

  return new InMemoryCapabilityRegistry(capabilities);
}

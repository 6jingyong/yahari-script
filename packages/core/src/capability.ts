import type { EditorContext, EntityRef, ResourceRef } from "./types.js";

export interface Capability {
  id: string;
  kind: string;
  subject: EntityRef;
  params?: Record<string, unknown>;
  source: ResourceRef;
}

export interface CapabilityQuery {
  kind: string;
  subject?: EntityRef;
  params?: Record<string, unknown>;
  context?: EditorContext;
}

export interface CapabilityDiagnostic {
  supported: boolean;
  matched: Capability[];
  reason?: string;
}

export interface CapabilityRegistry {
  query(query: CapabilityQuery): Capability[];
  supports(query: CapabilityQuery): boolean;
  explain(query: CapabilityQuery): CapabilityDiagnostic;
}

function sameEntity(a: EntityRef, b: EntityRef): boolean {
  return a.kind === b.kind && a.id === b.id;
}

function paramsMatch(
  available: Record<string, unknown> | undefined,
  wanted: Record<string, unknown> | undefined,
): boolean {
  if (!wanted) return true;
  if (!available) return false;
  return Object.entries(wanted).every(([key, value]) => Object.is(available[key], value));
}

export class InMemoryCapabilityRegistry implements CapabilityRegistry {
  readonly capabilities: readonly Capability[];

  constructor(capabilities: Capability[]) {
    this.capabilities = Object.freeze([...capabilities]);
  }

  query(query: CapabilityQuery): Capability[] {
    return this.capabilities.filter((capability) => {
      if (capability.kind !== query.kind) return false;
      if (query.subject && !sameEntity(capability.subject, query.subject)) return false;
      return paramsMatch(capability.params, query.params);
    });
  }

  supports(query: CapabilityQuery): boolean {
    return this.query(query).length > 0;
  }

  explain(query: CapabilityQuery): CapabilityDiagnostic {
    const matched = this.query(query);
    return matched.length
      ? { supported: true, matched }
      : {
          supported: false,
          matched: [],
          reason: `No capability matched kind=${query.kind}`,
        };
  }
}

export interface CompositionKeyEventLike {
  isComposing: boolean;
  keyCode: number;
}

/** IME composition keystrokes must never trigger editor commands. */
export function isImeCompositionKey(event: CompositionKeyEventLike): boolean {
  return event.isComposing || event.keyCode === 229;
}

/** Some IMEs end composition before dispatching the committing Enter. */
export class CompositionGuard {
  private composing = false;
  private endedAt = Number.NEGATIVE_INFINITY;
  start(): void { this.composing = true; }
  end(now: number): void { this.composing = false; this.endedAt = now; }
  blocks(event: CompositionKeyEventLike & { key: string }, now: number): boolean {
    return this.composing || isImeCompositionKey(event)
      || (event.key === "Enter" && now - this.endedAt >= 0 && now - this.endedAt < 100);
  }
}

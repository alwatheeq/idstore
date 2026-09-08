import "server-only";
import { randomUUID } from "node:crypto";

/** Generated with the form, not with each action invocation/retry. */
export function SubmissionKey() {
  return <input type="hidden" name="idempotencyKey" value={randomUUID()} />;
}

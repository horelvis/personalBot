import { ApiError } from "../api/client.ts";

export function describeError(error: unknown): string {
  if (error instanceof ApiError && error.status === 409) return "This thread is busy with another reply. Try again when it finishes.";
  return error instanceof Error ? error.message : String(error);
}

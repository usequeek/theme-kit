/** Normalises anything a `catch` can hand back into an `Error`, so hooks can expose one `error` type. */
export function toError(value: unknown): Error {
  return value instanceof Error ? value : new Error(String(value));
}

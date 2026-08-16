// Ownership: bounded retry policy for transient provider failures.

export interface RetryDecision { retry: boolean; delayMs: number; attempt: number; }

export function nextRetry(attempt: number, maxAttempts = 5, baseDelayMs = 30_000): RetryDecision {
  if (!Number.isInteger(attempt) || attempt < 1) throw new Error("Attempt must start at 1");
  if (attempt >= maxAttempts) return { retry: false, delayMs: 0, attempt };
  const exponential = Math.min(baseDelayMs * 2 ** (attempt - 1), 30 * 60_000);
  const jitter = Math.floor(exponential * 0.2);
  return { retry: true, delayMs: exponential + jitter, attempt: attempt + 1 };
}

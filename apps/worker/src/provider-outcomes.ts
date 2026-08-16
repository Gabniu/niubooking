// Ownership: normalized provider outcomes and retry policy.

export type DeliveryOutcome = "sent" | "retryable" | "permanent_failure";

export interface DeliveryReceipt {
  outcome: DeliveryOutcome;
  provider: string;
  providerMessageId: string | null;
  detail: string | null;
}

export class ProviderError extends Error {
  constructor(message: string, readonly retryable: boolean) { super(message); }
}

export function classifyProviderError(error: unknown): DeliveryOutcome {
  return error instanceof ProviderError ? error.retryable ? "retryable" : "permanent_failure" : "retryable";
}

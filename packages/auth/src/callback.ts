// Ownership: OAuth callback transaction validation. Token exchange and session creation remain server-only ports.

export interface CallbackTransaction {
  expectedState: string;
  expectedNonce: string;
}

export interface CallbackInput {
  state: string | null;
  code: string | null;
  idTokenNonce: string | null;
}

export function validateAuthorizationResponse(state: string | null, code: string | null, expectedState: string): CallbackValidation {
  if (!code) return { valid: false, reason: "missing_code" };
  if (!state || state !== expectedState) return { valid: false, reason: "state_mismatch" };
  return { valid: true, code };
}

export type CallbackValidation =
  | { valid: true; code: string }
  | { valid: false; reason: "missing_code" | "state_mismatch" | "nonce_mismatch" };

export function validateCallback(input: CallbackInput, transaction: CallbackTransaction): CallbackValidation {
  if (!input.code) return { valid: false, reason: "missing_code" };
  if (!input.state || input.state !== transaction.expectedState) return { valid: false, reason: "state_mismatch" };
  if (!input.idTokenNonce || input.idTokenNonce !== transaction.expectedNonce) {
    return { valid: false, reason: "nonce_mismatch" };
  }
  return { valid: true, code: input.code };
}

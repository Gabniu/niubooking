// Ownership: authorization transaction values. Values are never logged or sent to browser storage.

import { createHash, randomBytes } from "node:crypto";

export interface AuthorizationTransaction {
  state: string;
  nonce: string;
  verifier: string;
  challenge: string;
}

function base64Url(bytes: Buffer): string {
  return bytes.toString("base64url");
}

export function createAuthorizationTransaction(): AuthorizationTransaction {
  const verifier = base64Url(randomBytes(32));
  return {
    state: base64Url(randomBytes(32)),
    nonce: base64Url(randomBytes(32)),
    verifier,
    challenge: base64Url(createHash("sha256").update(verifier).digest()),
  };
}

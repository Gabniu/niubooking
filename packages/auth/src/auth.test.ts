// Ownership: NOVA auth seam tests for fail-closed configuration and PKCE values.

import assert from "node:assert/strict";
import test from "node:test";
import { createAuthorizationTransaction } from "./pkce.js";
import { parseOidcConfig } from "./config.js";
import { validateCallback } from "./callback.js";
import { validateVerifiedClaims } from "./oidc-verifier.js";
import { createSessionRecord, hashSessionToken, readSessionToken, sessionCookie } from "./session.js";

test("requires complete HTTPS OIDC configuration", () => {
  assert.throws(() => parseOidcConfig({ AUTH_ISSUER: "http://auth.test" }), /incomplete/);
  assert.throws(
    () => parseOidcConfig({ AUTH_ISSUER: "http://auth.test", AUTH_CLIENT_ID: "booking", AUTH_REDIRECT_URI: "http://app.test/callback" }),
    /HTTPS/,
  );
});

test("preserves the NOVA issuer path and exact callback URI", () => {
  const config = parseOidcConfig({ AUTH_ISSUER: "https://novaauth.niuautomations.com/api/auth/", AUTH_CLIENT_ID: "booking", AUTH_REDIRECT_URI: "https://booking.example.test/auth/callback/" });
  assert.equal(config.issuer, "https://novaauth.niuautomations.com/api/auth");
  assert.equal(config.redirectUri, "https://booking.example.test/auth/callback/");
});

test("creates distinct PKCE state and S256 challenge material", () => {
  const first = createAuthorizationTransaction();
  const second = createAuthorizationTransaction();
  assert.notEqual(first.state, second.state);
  assert.notEqual(first.nonce, second.nonce);
  assert.notEqual(first.verifier, first.challenge);
  assert.match(first.challenge, /^[A-Za-z0-9_-]+$/);
});

test("rejects OAuth callbacks unless code, state, and nonce all match", () => {
  const transaction = { expectedState: "state-1", expectedNonce: "nonce-1" };
  assert.deepEqual(validateCallback({ state: "state-1", code: "code-1", idTokenNonce: "nonce-1" }, transaction), {
    valid: true,
    code: "code-1",
  });
  assert.deepEqual(validateCallback({ state: "wrong", code: "code-1", idTokenNonce: "nonce-1" }, transaction), {
    valid: false,
    reason: "state_mismatch",
  });
});

test("maps only verified issuer and subject claims into local identity", () => {
  assert.deepEqual(
    validateVerifiedClaims({ iss: "https://novaauth.niuautomations.com", sub: "subject-1" }, {
      issuer: "https://novaauth.niuautomations.com", audience: "booking-client",
    }),
    { issuer: "https://novaauth.niuautomations.com", subject: "subject-1" },
  );
  assert.throws(
    () => validateVerifiedClaims({ iss: "https://evil.test", sub: "subject-1" }, {
      issuer: "https://novaauth.niuautomations.com", audience: "booking-client",
    }),
    /issuer mismatch/,
  );
});

test("creates an opaque session cookie whose stored value is hashed", () => {
  const result = createSessionRecord({ issuer: "https://novaauth.niuautomations.com", subject: "subject-1" }, "user-1");
  assert.notEqual(result.token, result.record.tokenHash);
  assert.equal(hashSessionToken(result.token), result.record.tokenHash);
  assert.equal(readSessionToken(sessionCookie(result.token, 3600)), result.token);
  assert.match(sessionCookie(result.token, 3600), /HttpOnly/);
  assert.match(sessionCookie(result.token, 3600), /Secure/);
});

test("malformed or empty session cookies fail closed", () => {
  assert.equal(readSessionToken("booking_session=%"), null);
  assert.equal(readSessionToken("booking_session="), null);
});

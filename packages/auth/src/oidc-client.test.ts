import assert from "node:assert/strict";
import test from "node:test";
import { discoverOidcProvider, discoveryUrl } from "./discovery.js";
import { exchangeAuthorizationCode } from "./token-client.js";
import { verifyIdToken } from "./oidc-verifier.js";

const config = { issuer: "https://novaauth.niuautomations.com/api/auth", clientId: "booking-client", redirectUri: "https://booking.example.test/auth/callback" };

test("OIDC discovery preserves the provider path and requires S256", async () => {
  let requested = "";
  const metadata = await discoverOidcProvider(config, async (input) => {
    requested = String(input);
    return new Response(JSON.stringify({ issuer: config.issuer, authorization_endpoint: "https://auth.test/authorize", token_endpoint: "https://auth.test/token", jwks_uri: "https://auth.test/jwks", userinfo_endpoint: "https://auth.test/userinfo", code_challenge_methods_supported: ["S256"] }), { status: 200 });
  });
  assert.equal(requested, discoveryUrl(config.issuer));
  assert.equal(metadata.issuer, config.issuer);
  assert.deepEqual(metadata.codeChallengeMethods, ["S256"]);
});

test("OIDC discovery rejects an issuer mismatch or missing S256", async () => {
  const response = (issuer: string, methods: string[]) => new Response(JSON.stringify({ issuer, authorization_endpoint: "https://auth.test/authorize", token_endpoint: "https://auth.test/token", jwks_uri: "https://auth.test/jwks", userinfo_endpoint: "https://auth.test/userinfo", code_challenge_methods_supported: methods }), { status: 200 });
  await assert.rejects(() => discoverOidcProvider(config, async () => response("https://evil.test", ["S256"])), /issuer mismatch/);
  await assert.rejects(() => discoverOidcProvider(config, async () => response(config.issuer, [])), /S256/);
});

test("authorization-code exchange sends the exact redirect and PKCE verifier", async () => {
  let body = "";
  const metadata = { issuer: config.issuer, authorizationEndpoint: "https://auth.test/authorize", tokenEndpoint: "https://auth.test/token", jwksUri: "https://auth.test/jwks", userinfoEndpoint: "https://auth.test/userinfo", codeChallengeMethods: ["S256"] };
  const result = await exchangeAuthorizationCode(metadata, config, "one-time-code", "pkce-verifier", async (_input, init) => {
    body = String(init?.body);
    return new Response(JSON.stringify({ access_token: "opaque", id_token: "signed", expires_in: 300 }), { status: 200 });
  });
  assert.equal(result.accessToken, "opaque");
  assert.match(body, /code_verifier=pkce-verifier/u);
  assert.match(body, /redirect_uri=https%3A%2F%2Fbooking.example.test%2Fauth%2Fcallback/u);
});

test("malformed ID tokens fail before any JWKS request", async () => {
  await assert.rejects(() => verifyIdToken("not-a-jwt", { issuer: config.issuer, audience: config.clientId, jwksUri: "https://auth.test/jwks" }, "nonce"));
});

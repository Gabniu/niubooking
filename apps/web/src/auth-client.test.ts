import assert from "node:assert/strict";
import test from "node:test";
import { authUrl, sessionUrl } from "./auth-client.js";

test("auth URLs keep the API base and action bounded", () => {
  assert.equal(authUrl("http://127.0.0.1:3100/", "login"), "http://127.0.0.1:3100/auth/login");
  assert.equal(authUrl("", "logout"), "/auth/logout");
  assert.equal(sessionUrl("http://127.0.0.1:3100/"), "http://127.0.0.1:3100/auth/session");
});

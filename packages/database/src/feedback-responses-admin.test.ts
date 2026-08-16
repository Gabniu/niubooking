import assert from "node:assert/strict";
import test from "node:test";
import { listFeedbackResponses } from "./feedback-responses-admin.js";

test("lists responses with tenant and optional campaign scope", async () => {
  let params: readonly unknown[] = [];
  const rows = await listFeedbackResponses({ query: async <T>(_sql: string, p: readonly unknown[]) => { params = p; return [] as T[]; } }, "tenant-1", "campaign-1");
  assert.deepEqual(rows, []);
  assert.deepEqual(params, ["tenant-1", "campaign-1"]);
});

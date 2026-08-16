import assert from "node:assert/strict";
import test from "node:test";
import { createPrintPreview, type PrintSpec } from "./qr-print-studio.js";

const spec: PrintSpec = { template: "a5-flyer", variant: "hero", headline: "Book your next visit", callToAction: "Scan to book", businessLabel: "Example Business", accent: "#10B981", logoUrl: null };

test("creates a scan-safe preview model with canonical booking URL", () => {
  const preview = createPrintPreview(spec, "branch-booking-code-01", "https://booking.example");
  assert.equal(preview.qrValue, "https://booking.example/book/branch-booking-code-01");
  assert.equal(preview.scanSafe, true);
});

test("flags branding and URL diagnostics instead of silently exporting", () => {
  const preview = createPrintPreview({ ...spec, logoUrl: "https://cdn.example/logo.png", accent: "green" }, "branch-booking-code-01", "http://booking.example");
  assert.equal(preview.scanSafe, false);
  assert.equal(preview.diagnostics.length, 3);
});

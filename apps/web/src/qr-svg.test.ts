import assert from "node:assert/strict";
import test from "node:test";
import { generatePrintQrSvg } from "./qr-svg.js";

test("generates a white-background SVG with a print quiet zone", async () => {
  const svg = await generatePrintQrSvg({ value: "https://booking.example/book/branch-booking-code-01", accent: "#064E3B", logoRequested: false });
  assert.match(svg, /^<svg/);
  assert.match(svg, /#FFFFFF/i);
});

test("rejects unsafe URLs and low-contrast branding", async () => {
  await assert.rejects(() => generatePrintQrSvg({ value: "http://booking.example/book/code", accent: "#064E3B", logoRequested: false }), /HTTPS/);
  await assert.rejects(() => generatePrintQrSvg({ value: "https://booking.example/book/code", accent: "#FFFFFF", logoRequested: false }), /contrast/);
});

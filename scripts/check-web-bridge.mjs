// Ownership: release guard for the Next/legacy web bridge. Keep migrated routes on the production Next server.

import { readFile } from "node:fs/promises";

const source = await readFile(new URL("./serve-web-production.mjs", import.meta.url), "utf8");
const requiredPrefixes = ["/app/", "/manage/", "/book/", "/feedback/", "/reserve/", "/trip/", "/ticket/", "/verify-contact/", "/auth/"];
const missing = requiredPrefixes.filter((prefix) => !source.includes(`pathname.startsWith("${prefix}")`));
if (missing.length) {
  console.error(`Production web bridge is missing Next route ownership for: ${missing.join(", ")}`);
  process.exitCode = 1;
} else {
  console.log(`Production web bridge owns ${requiredPrefixes.length} migrated route families.`);
}

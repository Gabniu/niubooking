import { readFile } from "node:fs/promises";

const matrix = await readFile("docs/FEATURE_SURFACE_MATRIX.md", "utf8");
const ledger = await readFile("docs/CAPABILITY_LEDGER.md", "utf8");
const classifications = new Set(["user-facing", "integration-only", "operations/internal", "intentionally deferred"]);
const matrixStatuses = new Set(["planned", "backend-only gap", "frontend-only gap", "in progress", "verified", "not applicable", "intentionally deferred"]);
const capabilityStatuses = new Set(["planned", "in progress", "verified", "deferred"]);
const failures = [];

function tableRows(markdown) {
  return markdown
    .split(/\r?\n/u)
    .filter((line) => line.startsWith("|") && !line.includes("---"))
    .map((line) => line.split("|").slice(1, -1).map((cell) => cell.trim().replaceAll("`", "")));
}

const matrixRows = tableRows(matrix).filter((cells) => cells.length === 6 && cells[0] !== "Capability");
for (const cells of matrixRows) {
  if (!classifications.has(cells[1])) failures.push(`Matrix '${cells[0]}' has invalid classification '${cells[1]}'.`);
  if (!matrixStatuses.has(cells[4])) failures.push(`Matrix '${cells[0]}' has invalid status '${cells[4]}'.`);
  if (cells[4] === "verified" && !/test|verified|evidence|automated/iu.test(cells[5])) {
    failures.push(`Matrix '${cells[0]}' is verified without explicit evidence.`);
  }
}

const ledgerRows = tableRows(ledger).filter((cells) => cells.length === 8 && cells[0] !== "ID");
const identifiers = new Set();
for (const cells of ledgerRows) {
  if (!/^CAP-[A-Z]+-\d{3}$/u.test(cells[0])) failures.push(`Ledger ID '${cells[0]}' is invalid.`);
  if (identifiers.has(cells[0])) failures.push(`Ledger ID '${cells[0]}' is duplicated.`);
  identifiers.add(cells[0]);
  if (!capabilityStatuses.has(cells[4])) failures.push(`Ledger '${cells[0]}' has invalid status '${cells[4]}'.`);
  if (cells[4] === "verified" && !/TEST-[A-Z]+-\d{3}/u.test(cells[6])) {
    failures.push(`Ledger '${cells[0]}' is verified without a TEST reference.`);
  }
}

if (matrixRows.length === 0) failures.push("Feature surface matrix has no capability rows.");
if (ledgerRows.length === 0) failures.push("Capability ledger has no capability rows.");

if (failures.length > 0) {
  console.error("Parity gate failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Parity gate passed: ${matrixRows.length} surfaces and ${ledgerRows.length} capabilities are traceable.`);
}

import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const directory = path.join(process.cwd(), "packages", "database", "migrations");
const names = (await readdir(directory)).filter((name) => name.endsWith(".sql")).sort();
const failures = [];

for (const [index, name] of names.entries()) {
  const match = /^(\d{3})_[a-z0-9_]+\.sql$/u.exec(name);
  if (!match) {
    failures.push(`${name}: expected NNN_snake_case.sql`);
    continue;
  }
  const expected = String(index + 1).padStart(3, "0");
  if (match[1] !== expected) failures.push(`${name}: expected sequence ${expected}`);
  const sql = await readFile(path.join(directory, name), "utf8");
  if (sql.trim().length === 0) failures.push(`${name}: migration is empty`);
  if (/^\s*(BEGIN|COMMIT)\s*;/imu.test(sql)) {
    failures.push(`${name}: transactions are owned by the migration runner`);
  }
}

if (failures.length > 0) {
  console.error("Migration gate failed:\n" + failures.map((item) => `- ${item}`).join("\n"));
  process.exitCode = 1;
} else {
  console.log(`Migration gate passed: ${names.length} ordered, non-empty migrations.`);
}

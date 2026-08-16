import { readdir, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const roots = ["apps", "packages", "scripts", "tests"];
const extensions = new Set([".ts", ".tsx", ".js", ".mjs", ".cjs", ".css", ".html"]);
const ignoredDirectories = new Set(["dist", "node_modules", ".next", ".graphify-semantic", "graphify-out"]);
const maximumLines = 300;

async function collect(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.isDirectory() && ignoredDirectories.has(entry.name)) continue;
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await collect(absolute)));
    if (entry.isFile() && extensions.has(path.extname(entry.name))) files.push(absolute);
  }
  return files;
}

const files = (
  await Promise.all(
    roots.map(async (directory) => {
      try {
        return await collect(path.join(root, directory));
      } catch (error) {
        if (error?.code === "ENOENT") return [];
        throw error;
      }
    }),
  )
).flat();

const violations = [];
for (const file of files) {
  const contents = await readFile(file, "utf8");
  const lines = contents.length === 0 ? 0 : contents.split(/\r?\n/u).length - (contents.endsWith("\n") ? 1 : 0);
  if (lines > maximumLines) violations.push({ file: path.relative(root, file), lines });
}

if (violations.length > 0) {
  console.error(`Source files must not exceed ${maximumLines} lines:`);
  for (const violation of violations) console.error(`- ${violation.file}: ${violation.lines}`);
  process.exitCode = 1;
} else {
  console.log(`Source-size gate passed: ${files.length} files are at or below ${maximumLines} lines.`);
}

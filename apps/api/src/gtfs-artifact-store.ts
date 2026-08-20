// Ownership: immutable GTFS artifact storage adapter; object keys are never trusted as paths.

import { link, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, resolve, sep } from "node:path";

export interface GtfsArtifactStore { read(objectKey: string): Promise<Uint8Array | null>; write(objectKey: string, content: Uint8Array): Promise<void>; }

export function createFileGtfsArtifactStore(rootDirectory: string): GtfsArtifactStore {
  const root = resolve(rootDirectory);
  const safePath = (objectKey: string): string => {
    const path = resolve(root, objectKey);
    if (!objectKey.trim() || !(path === root || path.startsWith(`${root}${sep}`))) throw new Error("GTFS artifact key is outside the configured store");
    return path;
  };
  return { async read(objectKey) {
    const path = safePath(objectKey);
    try { return await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  }, async write(objectKey, content) {
    const path = safePath(objectKey);
    await mkdir(dirname(path), { recursive: true });
    const temporary = `${path}.${randomUUID()}.tmp`;
    await writeFile(temporary, content, { flag: "wx" });
    try {
      try { await link(temporary, path); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        const existing = await readFile(path);
        if (!Buffer.from(existing).equals(Buffer.from(content))) throw new Error("GTFS artifacts are immutable and this key already contains different bytes");
      }
    } finally { await unlink(temporary).catch(() => undefined); }
  } };
}

// Ownership: immutable GTFS artifact storage adapter; object keys are never trusted as paths.

import { readFile } from "node:fs/promises";
import { resolve, sep } from "node:path";

export interface GtfsArtifactStore { read(objectKey: string): Promise<Uint8Array | null>; }

export function createFileGtfsArtifactStore(rootDirectory: string): GtfsArtifactStore {
  const root = resolve(rootDirectory);
  return { async read(objectKey) {
    const path = resolve(root, objectKey);
    if (!objectKey.trim() || !(path === root || path.startsWith(`${root}${sep}`))) throw new Error("GTFS artifact key is outside the configured store");
    try { return await readFile(path); } catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw error; }
  } };
}

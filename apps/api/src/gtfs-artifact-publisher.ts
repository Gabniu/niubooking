// Ownership: immutable GTFS Schedule artifact preparation for the publication worker boundary.

import { createHash } from "node:crypto";
import { createGtfsScheduleArtifact, type GtfsScheduleFile } from "@bookingapp/domain";

export interface GtfsArtifactWriter { write(objectKey: string, content: Uint8Array): Promise<void>; }
export interface PreparedGtfsArtifact { readonly objectKey: string; readonly sha256: string; readonly byteLength: number; }

export async function persistGtfsScheduleArtifact(writer: GtfsArtifactWriter, input: { objectKey: string; files: readonly GtfsScheduleFile[] }): Promise<PreparedGtfsArtifact> {
  if (!/^gtfs\/[A-Za-z0-9._-]+\.zip$/u.test(input.objectKey)) throw new Error("GTFS artifact key is invalid");
  const artifact = createGtfsScheduleArtifact(input.files);
  const sha256 = createHash("sha256").update(artifact.archive).digest("hex");
  await writer.write(input.objectKey, artifact.archive);
  return { objectKey: input.objectKey, sha256, byteLength: artifact.archive.byteLength };
}

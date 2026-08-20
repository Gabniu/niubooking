// Ownership: deterministic, dependency-free GTFS Schedule ZIP artifacts.

import type { GtfsScheduleFile } from "./gtfs-export.js";
import { validateGtfsScheduleFiles } from "./gtfs-validation.js";

const encoder = new TextEncoder();
function u16(value: number): number[] { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number): number[] { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) { crc ^= byte; for (let bit = 0; bit < 8; bit += 1) crc = (crc >>> 1) ^ (0xedb88320 * (crc & 1)); }
  return (crc ^ 0xffffffff) >>> 0;
}
function append(target: number[], values: readonly number[]): void { target.push(...values); }
function validName(name: string): boolean { return /^[a-z0-9][a-z0-9_]*\.txt$/u.test(name); }

export function buildGtfsScheduleArchive(files: readonly GtfsScheduleFile[]): Uint8Array {
  const ordered = [...files].sort((left, right) => left.fileName.localeCompare(right.fileName)); const names = new Set<string>(); const output: number[] = []; const central: number[] = [];
  for (const file of ordered) {
    if (!validName(file.fileName) || names.has(file.fileName)) throw new Error("GTFS artifact contains an unsafe or duplicate file name");
    names.add(file.fileName); const name = encoder.encode(file.fileName); const data = encoder.encode(file.content); if (data.length > 0xffffffff) throw new Error("GTFS artifact file is too large");
    const offset = output.length; const checksum = crc32(data); append(output, [0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(33), ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)]); output.push(...name, ...data);
    append(central, [0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0), ...u16(0), ...u16(0), ...u16(33), ...u32(checksum), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(offset)]); central.push(...name);
  }
  const centralOffset = output.length; output.push(...central); append(output, [0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(ordered.length), ...u16(ordered.length), ...u32(central.length), ...u32(centralOffset), ...u16(0)]);
  return Uint8Array.from(output);
}

export function createGtfsScheduleArtifact(files: readonly GtfsScheduleFile[]): { readonly files: readonly GtfsScheduleFile[]; readonly archive: Uint8Array } {
  const issues = validateGtfsScheduleFiles(files); if (issues.some(({ severity }) => severity === "error")) throw new Error(`GTFS artifact is invalid: ${issues.map(({ message }) => message).join("; ")}`);
  return { files: [...files].sort((left, right) => left.fileName.localeCompare(right.fileName)), archive: buildGtfsScheduleArchive(files) };
}

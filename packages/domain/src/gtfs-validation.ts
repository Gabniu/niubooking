// Ownership: independent validation of serialized GTFS Schedule files.

import type { GtfsScheduleFile } from "./gtfs-export.js";

export type GtfsArtifactSeverity = "error" | "warning" | "info";

export interface GtfsArtifactValidationIssue {
  readonly code: string;
  readonly severity: GtfsArtifactSeverity;
  readonly fileName?: string;
  readonly entityPublicId?: string;
  readonly message: string;
  readonly suggestedAction?: string;
}

type Table = { headers: readonly string[]; rows: readonly (readonly string[])[] };
const requiredFiles = ["agency.txt", "stops.txt", "routes.txt", "trips.txt", "stop_times.txt"] as const;

function parseCsv(content: string): Table {
  const rows: string[][] = [[]]; let cell = ""; let quoted = false;
  for (let index = 0; index < content.length; index += 1) {
    const character = content[index];
    if (character === '"') {
      if (quoted && content[index + 1] === '"') { cell += '"'; index += 1; } else quoted = !quoted;
    } else if (character === "," && !quoted) { rows[rows.length - 1]!.push(cell); cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r" && content[index + 1] === "\n") index += 1;
      rows[rows.length - 1]!.push(cell); cell = ""; if (index < content.length - 1) rows.push([]);
    } else cell += character;
  }
  if (quoted) throw new Error("CSV contains an unclosed quoted field");
  if (!content.endsWith("\n") && !content.endsWith("\r")) rows.at(-1)!.push(cell);
  const [headers, ...data] = rows.filter((row) => row.some(Boolean));
  if (!headers?.length) throw new Error("CSV has no header row");
  return { headers, rows: data.filter((row) => row.length === headers.length) };
}

function column(table: Table, name: string): number { return table.headers.indexOf(name); }
function values(table: Table, name: string): Set<string> {
  const index = column(table, name); return new Set(index < 0 ? [] : table.rows.map((row) => row[index] ?? ""));
}
function issue(code: string, message: string, fileName?: string, entityPublicId?: string, suggestedAction?: string): GtfsArtifactValidationIssue {
  return { code, severity: "error", ...(fileName ? { fileName } : {}), ...(entityPublicId ? { entityPublicId } : {}), message, ...(suggestedAction ? { suggestedAction } : {}) };
}
function requireColumns(table: Table, fileName: string, names: readonly string[], issues: GtfsArtifactValidationIssue[]): void {
  for (const name of names) if (column(table, name) < 0) issues.push(issue("missing_column", `${fileName} is missing the required ${name} column`, fileName, undefined, "Regenerate the Schedule from the current exporter."));
}
function parseFiles(files: readonly GtfsScheduleFile[], issues: GtfsArtifactValidationIssue[]): Map<string, Table> {
  const tables = new Map<string, Table>();
  for (const file of files) {
    if (!/^[a-z0-9][a-z0-9_]*\.txt$/u.test(file.fileName)) { issues.push(issue("unsafe_filename", `${file.fileName} is not a safe GTFS file name`, file.fileName, undefined, "Use lowercase GTFS .txt file names without directories.")); continue; }
    if (tables.has(file.fileName)) { issues.push(issue("duplicate_file", `${file.fileName} appears more than once`, file.fileName, undefined, "Keep one immutable copy of each GTFS file.")); continue; }
    try { tables.set(file.fileName, parseCsv(file.content)); } catch (error) { issues.push(issue("malformed_csv", `${file.fileName} could not be read as CSV`, file.fileName, undefined, error instanceof Error ? error.message : "Regenerate the Schedule.")); }
  }
  return tables;
}
function duplicateIds(table: Table, fileName: string, idColumn: string, issues: GtfsArtifactValidationIssue[]): void {
  const index = column(table, idColumn); if (index < 0) return;
  const seen = new Set<string>(); for (const row of table.rows) { const value = row[index] ?? ""; if (seen.has(value)) issues.push(issue("duplicate_id", `${fileName} repeats ${idColumn} ${value}`, fileName, value, "Assign one stable ID to each entity.")); seen.add(value); }
}
function references(table: Table | undefined, fileName: string, idColumn: string, target: Set<string>, issues: GtfsArtifactValidationIssue[]): void {
  if (!table) return; const index = column(table, idColumn); if (index < 0) return;
  for (const row of table.rows) { const value = row[index] ?? ""; if (value && !target.has(value)) issues.push(issue("unknown_reference", `${fileName} references unknown ${idColumn} ${value}`, fileName, value, "Publish only entities present in the same Schedule version.")); }
}

export function validateGtfsScheduleFiles(files: readonly GtfsScheduleFile[]): readonly GtfsArtifactValidationIssue[] {
  const issues: GtfsArtifactValidationIssue[] = []; const tables = parseFiles(files, issues);
  for (const fileName of requiredFiles) if (!tables.has(fileName)) issues.push(issue("missing_file", `The Schedule is missing required ${fileName}`, fileName, undefined, "Regenerate the complete core Schedule."));
  const agency = tables.get("agency.txt"); const stops = tables.get("stops.txt"); const routes = tables.get("routes.txt"); const trips = tables.get("trips.txt"); const stopTimes = tables.get("stop_times.txt");
  if (agency) { requireColumns(agency, "agency.txt", ["agency_id", "agency_name", "agency_url", "agency_timezone"], issues); duplicateIds(agency, "agency.txt", "agency_id", issues); }
  if (stops) { requireColumns(stops, "stops.txt", ["stop_id", "stop_name", "stop_lat", "stop_lon"], issues); duplicateIds(stops, "stops.txt", "stop_id", issues); }
  if (routes) { requireColumns(routes, "routes.txt", ["route_id", "agency_id", "route_type"], issues); duplicateIds(routes, "routes.txt", "route_id", issues); references(routes, "routes.txt", "agency_id", values(agency ?? { headers: [], rows: [] }, "agency_id"), issues); }
  if (trips) { requireColumns(trips, "trips.txt", ["route_id", "service_id", "trip_id"], issues); duplicateIds(trips, "trips.txt", "trip_id", issues); references(trips, "trips.txt", "route_id", values(routes ?? { headers: [], rows: [] }, "route_id"), issues); }
  if (stopTimes) { requireColumns(stopTimes, "stop_times.txt", ["trip_id", "stop_id", "stop_sequence", "arrival_time", "departure_time"], issues); references(stopTimes, "stop_times.txt", "trip_id", values(trips ?? { headers: [], rows: [] }, "trip_id"), issues); references(stopTimes, "stop_times.txt", "stop_id", values(stops ?? { headers: [], rows: [] }, "stop_id"), issues); }
  references(tables.get("calendar.txt"), "calendar.txt", "service_id", values(trips ?? { headers: [], rows: [] }, "service_id"), issues);
  references(tables.get("calendar_dates.txt"), "calendar_dates.txt", "service_id", values(trips ?? { headers: [], rows: [] }, "service_id"), issues);
  if (!tables.has("calendar.txt") && !tables.has("calendar_dates.txt")) issues.push(issue("missing_service_calendar", "The Schedule has trips but no calendar.txt or calendar_dates.txt", "trips.txt", undefined, "Publish at least one service calendar or exception file."));
  references(tables.get("frequencies.txt"), "frequencies.txt", "trip_id", values(trips ?? { headers: [], rows: [] }, "trip_id"), issues);
  if (tables.has("shapes.txt")) { duplicateIds(tables.get("shapes.txt")!, "shapes.txt", "shape_id", issues); references(trips, "trips.txt", "shape_id", values(tables.get("shapes.txt")!, "shape_id"), issues); }
  return issues;
}

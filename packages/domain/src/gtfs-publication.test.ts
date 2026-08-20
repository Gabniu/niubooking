// Ownership: independent GTFS artifact and archive acceptance tests.

import assert from "node:assert/strict";
import test from "node:test";
import { buildGtfsScheduleArchive, createGtfsScheduleArtifact } from "./gtfs-archive.js";
import { validateGtfsScheduleFiles } from "./gtfs-validation.js";
import type { GtfsScheduleFile } from "./gtfs-export.js";

const validFiles: readonly GtfsScheduleFile[] = [
  { fileName: "agency.txt", content: "agency_id,agency_name,agency_url,agency_timezone\nniu,Niu Transit,https://niu.example,Africa/Nairobi\n" },
  { fileName: "stops.txt", content: "stop_id,stop_name,stop_lat,stop_lon\ncbd,City Centre,-1.2,36.8\nwest,Westlands,-1.1,36.7\n" },
  { fileName: "routes.txt", content: "route_id,agency_id,route_type\nroute-1,niu,3\n" },
  { fileName: "trips.txt", content: "route_id,service_id,trip_id\nroute-1,weekday,trip-1\n" },
  { fileName: "stop_times.txt", content: "trip_id,arrival_time,departure_time,stop_id,stop_sequence\ntrip-1,08:00:00,08:01:00,cbd,1\ntrip-1,08:20:00,08:21:00,west,2\n" },
  { fileName: "calendar.txt", content: "service_id,monday,tuesday,wednesday,thursday,friday,saturday,sunday,start_date,end_date\nweekday,1,1,1,1,1,0,0,20260820,20261231\n" },
];

test("independently validates core references in serialized files", () => {
  assert.deepEqual(validateGtfsScheduleFiles(validFiles), []);
  const broken = validFiles.map((file) => file.fileName === "stop_times.txt" ? { ...file, content: file.content.replace("west,2", "missing,2") } : file);
  assert.equal(validateGtfsScheduleFiles(broken).some((item) => item.code === "unknown_reference"), true);
});

test("builds a byte-stable ZIP with sorted safe entries", () => {
  const archive = buildGtfsScheduleArchive([...validFiles].reverse());
  assert.deepEqual(archive, buildGtfsScheduleArchive(validFiles));
  assert.equal(createGtfsScheduleArtifact(validFiles).archive.length, archive.length);
  assert.equal(new TextDecoder().decode(archive.slice(0, 4)), "PK\u0003\u0004");
  assert.throws(() => buildGtfsScheduleArchive([{ fileName: "../secret.txt", content: "x" }]), /unsafe/iu);
});

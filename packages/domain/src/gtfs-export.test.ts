// Ownership: deterministic GTFS Schedule serialization proof.

import assert from "node:assert/strict";
import test from "node:test";
import { serializeGtfsSchedule } from "./gtfs-export.js";
import type { GtfsScheduleDraft } from "./gtfs-schedule.js";

const draft: GtfsScheduleDraft = {
  feedVersion: "2026.08.20.1", defaultLanguage: "en", validFrom: "20260820", validUntil: "20261231", enabledFeatures: ["core", "frequencies"],
  agencies: [{ publicId: "niu-transit", name: "Niu Transit, Ltd.", url: "https://transit.example.com", timezone: "Africa/Nairobi" }],
  stops: [{ publicId: "cbd", code: "CBD", name: "City Centre", latitude: -1.286389, longitude: 36.817223 }, { publicId: "westlands", name: "Westlands", latitude: -1.2676, longitude: 36.8108 }],
  routes: [{ publicId: "route-23", agencyPublicId: "niu-transit", shortName: "23", longName: "City Centre - Westlands", routeType: 3, color: "140BA7" }],
  services: [{ publicId: "weekday", startDate: "20260820", endDate: "20261231", weekdays: [true, true, true, true, true, false, false], exceptions: { "20261020": "removed", "20261031": "added" } }],
  trips: [{ publicId: "route-23-headway", routePublicId: "route-23", servicePublicId: "weekday", headsign: "Westlands", stopTimes: [{ stopPublicId: "cbd", sequence: 1, arrivalSeconds: 23 * 3600 + 50 * 60, departureSeconds: 23 * 3600 + 51 * 60 }, { stopPublicId: "westlands", sequence: 2, arrivalSeconds: 24 * 3600 + 20 * 60, departureSeconds: 24 * 3600 + 21 * 60 }] }],
  shapes: [{ publicId: "route-23-shape", points: [{ sequence: 1, latitude: -1.286389, longitude: 36.817223 }, { sequence: 2, latitude: -1.2676, longitude: 36.8108 }] }],
  frequencies: [{ tripPublicId: "route-23-headway", startSeconds: 23 * 3600, endSeconds: 25 * 3600, headwaySeconds: 900, exactTimes: false }],
};

test("serializes a deterministic core feed with after-midnight and optional files", () => {
  const files = serializeGtfsSchedule(draft);
  assert.deepEqual(files.map(({ fileName }) => fileName), ["agency.txt", "stops.txt", "routes.txt", "trips.txt", "stop_times.txt", "calendar.txt", "calendar_dates.txt", "shapes.txt", "frequencies.txt"]);
  const stopTimes = files.find(({ fileName }) => fileName === "stop_times.txt")?.content ?? "";
  assert.match(stopTimes, /23:50:00/); assert.match(stopTimes, /24:20:00/);
  assert.match(files.find(({ fileName }) => fileName === "calendar_dates.txt")?.content ?? "", /20261020,2/);
  assert.match(files.find(({ fileName }) => fileName === "agency.txt")?.content ?? "", /"Niu Transit, Ltd\."/);
});

test("keeps output byte-stable when input arrays are reordered", () => {
  const reordered = { ...draft, agencies: [...draft.agencies].reverse(), stops: [...draft.stops].reverse(), routes: [...draft.routes].reverse(), trips: [...draft.trips].reverse() };
  assert.deepEqual(serializeGtfsSchedule(reordered), serializeGtfsSchedule(draft));
});

test("rejects an invalid draft before producing a partial artifact", () => {
  assert.throws(() => serializeGtfsSchedule({ ...draft, routes: [{ publicId: "route-23", agencyPublicId: "missing", shortName: "23", routeType: 3 }] }), /GTFS Schedule is invalid/iu);
});

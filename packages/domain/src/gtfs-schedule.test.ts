// Ownership: executable examples for GTFS Schedule stability and service modes.

import assert from "node:assert/strict";
import test from "node:test";
import { formatGtfsServiceTime, validateGtfsScheduleDraft, type GtfsScheduleDraft } from "./gtfs-schedule.js";

const feed: GtfsScheduleDraft = {
  feedVersion: "2026-08-19.1",
  defaultLanguage: "en",
  validFrom: "20260819",
  validUntil: "20261231",
  enabledFeatures: ["core", "frequencies", "accessibility"],
  agencies: [{ publicId: "niu-matatu", name: "NIU Matatu", url: "https://example.com", timezone: "Africa/Nairobi" }],
  stops: [
    { publicId: "cbd", code: "001", name: "CBD", latitude: -1.2864, longitude: 36.8172 },
    { publicId: "westlands", code: "002", name: "Westlands", latitude: -1.2675, longitude: 36.8108 },
  ],
  routes: [{ publicId: "route-23", agencyPublicId: "niu-matatu", shortName: "23", longName: "CBD to Westlands", routeType: 3 }],
  services: [{ publicId: "daily", startDate: "20260819", endDate: "20261231", weekdays: [true, true, true, true, true, true, true] }],
  shapes: [{ publicId: "route-23-out", points: [
    { sequence: 1, latitude: -1.2864, longitude: 36.8172, distance: 0 },
    { sequence: 2, latitude: -1.2675, longitude: 36.8108, distance: 2_500 },
  ] }],
  trips: [{
    publicId: "route-23-pattern-a",
    routePublicId: "route-23",
    servicePublicId: "daily",
    headsign: "Westlands",
    shapePublicId: "route-23-out",
    stopTimes: [
      { stopPublicId: "cbd", sequence: 1, arrivalSeconds: 25 * 3_600, departureSeconds: 25 * 3_600, shapeDistance: 0 },
      { stopPublicId: "westlands", sequence: 2, arrivalSeconds: 25 * 3_600 + 1_200, departureSeconds: 25 * 3_600 + 1_200, shapeDistance: 2_500 },
    ],
  }],
  frequencies: [{ tripPublicId: "route-23-pattern-a", startSeconds: 6 * 3_600, endSeconds: 23 * 3_600, headwaySeconds: 600, exactTimes: false }],
};

test("accepts a headway matatu feed with after-midnight service", () => {
  assert.deepEqual(validateGtfsScheduleDraft(feed), []);
  assert.equal(formatGtfsServiceTime(25 * 3_600 + 75), "25:01:15");
});

test("keeps public identity separate from mutable rider-facing fields", () => {
  const renamed = { ...feed, routes: [{ ...feed.routes[0]!, longName: "City Centre to Westlands" }] };
  assert.deepEqual(validateGtfsScheduleDraft(renamed), []);
  assert.equal(renamed.routes[0]!.publicId, feed.routes[0]!.publicId);
});

test("rejects unknown references and invented frequency precision", () => {
  const broken = {
    ...feed,
    enabledFeatures: ["core"] as const,
    trips: [{ ...feed.trips[0]!, routePublicId: "missing", stopTimes: [feed.trips[0]!.stopTimes[1]!] }],
  };
  const errors = validateGtfsScheduleDraft(broken).join("; ");
  assert.match(errors, /invalid references|at least two/iu);
  assert.match(errors, /requires the frequencies feature/iu);
});

test("rejects service time outside the supported service-day window", () => {
  assert.throws(() => formatGtfsServiceTime(48 * 3_600), RangeError);
});

test("allows a loop pattern to revisit a stop but rejects overlapping headways", () => {
  const loop = { ...feed, trips: [{
    ...feed.trips[0]!,
    stopTimes: [
      feed.trips[0]!.stopTimes[0]!,
      feed.trips[0]!.stopTimes[1]!,
      { ...feed.trips[0]!.stopTimes[0]!, sequence: 3, arrivalSeconds: 91_200, departureSeconds: 91_200, shapeDistance: 5_000 },
    ],
  }] };
  assert.deepEqual(validateGtfsScheduleDraft(loop), []);
  const overlapping = { ...feed, frequencies: [
    feed.frequencies[0]!,
    { ...feed.frequencies[0]!, startSeconds: 22 * 3_600, endSeconds: 24 * 3_600 },
  ] };
  assert.match(validateGtfsScheduleDraft(overlapping).join("; "), /cannot overlap/iu);
});

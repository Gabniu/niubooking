// Ownership: deterministic GTFS Schedule text files from a validated draft.

import { formatGtfsServiceTime, validateGtfsScheduleDraft, type GtfsScheduleDraft, type GtfsServiceCalendar } from "./gtfs-schedule.js";

export interface GtfsScheduleFile {
  readonly fileName: string;
  readonly content: string;
}

function csv(value: unknown): string {
  const text = value === undefined || value === null ? "" : String(value);
  return /[",\r\n]/u.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function file(fileName: string, headers: readonly string[], rows: readonly (readonly unknown[])[]): GtfsScheduleFile {
  const lines = [headers, ...rows].map((row) => row.map(csv).join(","));
  return { fileName, content: `${lines.join("\r\n")}\r\n` };
}

function wheelchair(value: "unknown" | "possible" | "not_possible" | undefined): number {
  return value === "possible" ? 1 : value === "not_possible" ? 2 : 0;
}

function calendarRows(services: readonly GtfsServiceCalendar[]): readonly (readonly unknown[])[] {
  return [...services].sort((left, right) => left.publicId.localeCompare(right.publicId)).map((service) => [
    service.publicId,
    service.weekdays[0] ? 1 : 0,
    service.weekdays[1] ? 1 : 0,
    service.weekdays[2] ? 1 : 0,
    service.weekdays[3] ? 1 : 0,
    service.weekdays[4] ? 1 : 0,
    service.weekdays[5] ? 1 : 0,
    service.weekdays[6] ? 1 : 0,
    service.startDate,
    service.endDate,
  ]);
}

function calendarDateRows(services: readonly GtfsServiceCalendar[]): readonly (readonly unknown[])[] {
  return [...services].flatMap((service) => Object.entries(service.exceptions ?? {})
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([date, exception]) => [service.publicId, date, exception === "added" ? 1 : 2]));
}

export function serializeGtfsSchedule(feed: GtfsScheduleDraft): readonly GtfsScheduleFile[] {
  const errors = validateGtfsScheduleDraft(feed);
  if (errors.length > 0) throw new Error(`GTFS Schedule is invalid: ${errors.join("; ")}`);
  const agencies = [...feed.agencies].sort((left, right) => left.publicId.localeCompare(right.publicId));
  const stops = [...feed.stops].sort((left, right) => left.publicId.localeCompare(right.publicId));
  const routes = [...feed.routes].sort((left, right) => left.publicId.localeCompare(right.publicId));
  const trips = [...feed.trips].sort((left, right) => left.publicId.localeCompare(right.publicId));
  const shapes = [...feed.shapes].sort((left, right) => left.publicId.localeCompare(right.publicId));
  const files: GtfsScheduleFile[] = [
    file("agency.txt", ["agency_id", "agency_name", "agency_url", "agency_timezone", "agency_lang"], agencies.map((agency) => [agency.publicId, agency.name, agency.url, agency.timezone, agency.language ?? feed.defaultLanguage])),
    file("stops.txt", ["stop_id", "stop_code", "stop_name", "stop_lat", "stop_lon", "location_type", "parent_station", "wheelchair_boarding"], stops.map((stop) => [stop.publicId, stop.code, stop.name, stop.latitude, stop.longitude, 0, stop.parentPublicId, wheelchair(stop.wheelchairBoarding)])),
    file("routes.txt", ["route_id", "agency_id", "route_short_name", "route_long_name", "route_type", "route_color", "route_text_color"], routes.map((route) => [route.publicId, route.agencyPublicId, route.shortName, route.longName, route.routeType, route.color, route.textColor])),
    file("trips.txt", ["route_id", "service_id", "trip_id", "trip_headsign", "direction_id", "block_id", "shape_id"], trips.map((trip) => [trip.routePublicId, trip.servicePublicId, trip.publicId, trip.headsign, trip.directionId, trip.blockPublicId, trip.shapePublicId])),
    file("stop_times.txt", ["trip_id", "arrival_time", "departure_time", "stop_id", "stop_sequence", "pickup_type", "drop_off_type", "shape_dist_traveled"], trips.flatMap((trip) => [...trip.stopTimes].sort((left, right) => left.sequence - right.sequence).map((stop) => [trip.publicId, formatGtfsServiceTime(stop.arrivalSeconds), formatGtfsServiceTime(stop.departureSeconds), stop.stopPublicId, stop.sequence, stop.pickupType ?? 0, stop.dropOffType ?? 0, stop.shapeDistance]))),
  ];
  if (feed.services.some((service) => service.weekdays.some(Boolean))) files.push(file("calendar.txt", ["service_id", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "start_date", "end_date"], calendarRows(feed.services)));
  const calendarDates = calendarDateRows(feed.services);
  if (calendarDates.length > 0) files.push(file("calendar_dates.txt", ["service_id", "date", "exception_type"], calendarDates));
  if (shapes.length > 0) files.push(file("shapes.txt", ["shape_id", "shape_pt_lat", "shape_pt_lon", "shape_pt_sequence", "shape_dist_traveled"], shapes.flatMap((shape) => [...shape.points].sort((left, right) => left.sequence - right.sequence).map((point) => [shape.publicId, point.latitude, point.longitude, point.sequence, point.distance]))));
  if (feed.frequencies.length > 0) files.push(file("frequencies.txt", ["trip_id", "start_time", "end_time", "headway_secs", "exact_times"], [...feed.frequencies].sort((left, right) => left.tripPublicId.localeCompare(right.tripPublicId) || left.startSeconds - right.startSeconds).map((frequency) => [frequency.tripPublicId, formatGtfsServiceTime(frequency.startSeconds), formatGtfsServiceTime(frequency.endSeconds), frequency.headwaySeconds, frequency.exactTimes ? 1 : 0])));
  return files;
}

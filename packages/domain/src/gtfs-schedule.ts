// Ownership: framework-free GTFS Schedule identity, time, and reference rules.

export type GtfsScheduleFeature =
  | "core"
  | "frequencies"
  | "transfers"
  | "translations"
  | "accessibility"
  | "pathways"
  | "fares_v2"
  | "flex";

export interface GtfsAgency {
  publicId: string;
  name: string;
  url: string;
  timezone: string;
  language?: string;
}

export interface GtfsStop {
  publicId: string;
  code?: string;
  name: string;
  latitude: number;
  longitude: number;
  parentPublicId?: string;
  wheelchairBoarding?: "unknown" | "possible" | "not_possible";
}

export interface GtfsRoute {
  publicId: string;
  agencyPublicId: string;
  shortName?: string;
  longName?: string;
  routeType: number;
  color?: string;
  textColor?: string;
}

export interface GtfsServiceCalendar {
  publicId: string;
  startDate: string;
  endDate: string;
  weekdays: readonly [boolean, boolean, boolean, boolean, boolean, boolean, boolean];
  exceptions?: Readonly<Record<string, "added" | "removed">>;
}

export interface GtfsStopTime {
  stopPublicId: string;
  sequence: number;
  arrivalSeconds: number;
  departureSeconds: number;
  pickupType?: 0 | 1 | 2 | 3;
  dropOffType?: 0 | 1 | 2 | 3;
  shapeDistance?: number;
}

export interface GtfsTrip {
  publicId: string;
  routePublicId: string;
  servicePublicId: string;
  headsign?: string;
  directionId?: 0 | 1;
  blockPublicId?: string;
  shapePublicId?: string;
  stopTimes: readonly GtfsStopTime[];
}

export interface GtfsShape {
  publicId: string;
  points: readonly {
    sequence: number;
    latitude: number;
    longitude: number;
    distance?: number;
  }[];
}

export interface GtfsFrequency {
  tripPublicId: string;
  startSeconds: number;
  endSeconds: number;
  headwaySeconds: number;
  exactTimes: boolean;
}

export interface GtfsScheduleDraft {
  feedVersion: string;
  defaultLanguage: string;
  validFrom: string;
  validUntil: string;
  enabledFeatures: readonly GtfsScheduleFeature[];
  agencies: readonly GtfsAgency[];
  stops: readonly GtfsStop[];
  routes: readonly GtfsRoute[];
  services: readonly GtfsServiceCalendar[];
  trips: readonly GtfsTrip[];
  shapes: readonly GtfsShape[];
  frequencies: readonly GtfsFrequency[];
}

const datePattern = /^\d{8}$/u;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;
const colorPattern = /^[0-9A-F]{6}$/u;

export function isValidGtfsPublicId(value: string): boolean {
  return idPattern.test(value);
}

export function formatGtfsServiceTime(seconds: number): string {
  if (!Number.isInteger(seconds) || seconds < 0 || seconds >= 48 * 60 * 60) {
    throw new RangeError("GTFS service time must be a whole second within two service days");
  }
  const hours = Math.floor(seconds / 3_600);
  const minutes = Math.floor((seconds % 3_600) / 60);
  const remainder = seconds % 60;
  return [hours, minutes, remainder].map((value) => String(value).padStart(2, "0")).join(":");
}

function validIanaTimezone(value: string): boolean {
  try {
    Intl.DateTimeFormat("en", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

function validCoordinates(latitude: number, longitude: number): boolean {
  return Number.isFinite(latitude) && latitude >= -90 && latitude <= 90
    && Number.isFinite(longitude) && longitude >= -180 && longitude <= 180;
}

function duplicateIds(values: readonly { publicId: string }[]): boolean {
  return new Set(values.map(({ publicId }) => publicId)).size !== values.length;
}

function validateStopTimes(trip: GtfsTrip, stopIds: ReadonlySet<string>): string[] {
  const errors: string[] = [];
  if (trip.stopTimes.length < 2) errors.push(`Trip ${trip.publicId} needs at least two stop-times`);
  let previousSequence = -1;
  let previousDeparture = -1;
  let previousDistance = -1;
  for (const stopTime of trip.stopTimes) {
    if (!stopIds.has(stopTime.stopPublicId)) errors.push(`Trip ${trip.publicId} references an unknown stop`);
    if (!Number.isInteger(stopTime.sequence) || stopTime.sequence <= previousSequence) {
      errors.push(`Trip ${trip.publicId} stop sequences must increase`);
    }
    if (!Number.isInteger(stopTime.arrivalSeconds) || !Number.isInteger(stopTime.departureSeconds)
      || stopTime.arrivalSeconds < previousDeparture || stopTime.departureSeconds < stopTime.arrivalSeconds
      || stopTime.departureSeconds >= 48 * 60 * 60) {
      errors.push(`Trip ${trip.publicId} stop-times must be chronological service-day seconds`);
    }
    if (stopTime.shapeDistance !== undefined
      && (!Number.isFinite(stopTime.shapeDistance) || stopTime.shapeDistance < previousDistance)) {
      errors.push(`Trip ${trip.publicId} shape distances must increase`);
    }
    previousSequence = stopTime.sequence;
    previousDeparture = stopTime.departureSeconds;
    previousDistance = stopTime.shapeDistance ?? previousDistance;
  }
  return errors;
}

export function validateGtfsScheduleDraft(feed: GtfsScheduleDraft): readonly string[] {
  const errors: string[] = [];
  if (!feed.feedVersion.trim()) errors.push("Feed version is required");
  if (!/^[a-z]{2,3}(?:-[A-Z]{2})?$/u.test(feed.defaultLanguage)) errors.push("Default language is invalid");
  if (!datePattern.test(feed.validFrom) || !datePattern.test(feed.validUntil) || feed.validUntil < feed.validFrom) {
    errors.push("Feed validity dates are invalid");
  }
  if (feed.agencies.length === 0 || feed.stops.length < 2 || feed.routes.length === 0
    || feed.services.length === 0 || feed.trips.length === 0) errors.push("Core GTFS collections are incomplete");
  const collections: readonly (readonly { publicId: string }[])[] = [feed.agencies, feed.stops, feed.routes, feed.services, feed.trips, feed.shapes];
  if (collections.some(duplicateIds) || collections.flat().some(({ publicId }) => !isValidGtfsPublicId(publicId))) {
    errors.push("GTFS public IDs must be valid and unique within each collection");
  }
  for (const agency of feed.agencies) {
    if (!agency.name.trim() || !URL.canParse(agency.url) || !validIanaTimezone(agency.timezone)) errors.push(`Agency ${agency.publicId} is invalid`);
  }
  const agencyIds = new Set(feed.agencies.map(({ publicId }) => publicId));
  const stopIds = new Set(feed.stops.map(({ publicId }) => publicId));
  const routeIds = new Set(feed.routes.map(({ publicId }) => publicId));
  const serviceIds = new Set(feed.services.map(({ publicId }) => publicId));
  const tripIds = new Set(feed.trips.map(({ publicId }) => publicId));
  const shapeIds = new Set(feed.shapes.map(({ publicId }) => publicId));
  for (const stop of feed.stops) {
    if (!stop.name.trim() || !validCoordinates(stop.latitude, stop.longitude)
      || stop.parentPublicId === stop.publicId
      || (stop.parentPublicId !== undefined && !stopIds.has(stop.parentPublicId))) errors.push(`Stop ${stop.publicId} is invalid`);
  }
  for (const route of feed.routes) {
    if (!agencyIds.has(route.agencyPublicId) || (!route.shortName?.trim() && !route.longName?.trim())
      || route.routeType < 0 || (route.color !== undefined && !colorPattern.test(route.color))
      || (route.textColor !== undefined && !colorPattern.test(route.textColor))) errors.push(`Route ${route.publicId} is invalid`);
  }
  for (const service of feed.services) {
    if (!datePattern.test(service.startDate) || !datePattern.test(service.endDate) || service.endDate < service.startDate
      || (!service.weekdays.some(Boolean) && Object.values(service.exceptions ?? {}).every((value) => value !== "added"))) {
      errors.push(`Service ${service.publicId} has no valid service days`);
    }
  }
  for (const trip of feed.trips) {
    if (!routeIds.has(trip.routePublicId) || !serviceIds.has(trip.servicePublicId)
      || (trip.shapePublicId !== undefined && !shapeIds.has(trip.shapePublicId))) errors.push(`Trip ${trip.publicId} has invalid references`);
    errors.push(...validateStopTimes(trip, stopIds));
  }
  for (const shape of feed.shapes) {
    let previousSequence = -1;
    let previousDistance = -1;
    let invalidShape = shape.points.length < 2;
    for (const point of shape.points) {
      if (!validCoordinates(point.latitude, point.longitude) || !Number.isInteger(point.sequence)
        || point.sequence <= previousSequence || (point.distance !== undefined
          && (!Number.isFinite(point.distance) || point.distance < previousDistance))) invalidShape = true;
      previousSequence = point.sequence;
      if (point.distance !== undefined) previousDistance = point.distance;
    }
    if (invalidShape) errors.push(`Shape ${shape.publicId} is invalid`);
  }
  const orderedFrequencies = [...feed.frequencies].sort((left, right) => left.tripPublicId.localeCompare(right.tripPublicId) || left.startSeconds - right.startSeconds);
  let previousFrequency: GtfsFrequency | undefined;
  for (const frequency of orderedFrequencies) {
    if (!tripIds.has(frequency.tripPublicId) || !Number.isInteger(frequency.startSeconds)
      || !Number.isInteger(frequency.endSeconds) || frequency.startSeconds < 0
      || frequency.endSeconds <= frequency.startSeconds || frequency.endSeconds >= 48 * 60 * 60
      || !Number.isInteger(frequency.headwaySeconds) || frequency.headwaySeconds <= 0) errors.push("Frequency window is invalid");
    if (previousFrequency?.tripPublicId === frequency.tripPublicId
      && frequency.startSeconds < previousFrequency.endSeconds) errors.push("Frequency windows for a trip cannot overlap");
    previousFrequency = frequency;
  }
  if (feed.frequencies.length > 0 && !feed.enabledFeatures.includes("frequencies")) errors.push("Frequency data requires the frequencies feature");
  return [...new Set(errors)];
}

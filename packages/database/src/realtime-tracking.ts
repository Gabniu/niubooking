// Ownership: tenant-safe fleet assignment, device, session, and telemetry persistence.

import { createHash } from "node:crypto";
import {
  evaluateVehiclePosition,
  classifyPositionFreshness,
  estimateRouteEta,
  validateFleetDeviceEnrollment,
  validateFleetTrackingSession,
  validateFleetTripAssignment,
  type FleetDevice,
  type FleetDevicePlatform,
  type FleetTelemetryObservation,
  type FleetTrackingSession,
  type FleetCrewAssignmentStatus,
  type FleetTripAssignment,
  type RouteEtaEstimate,
  type RouteEtaStop,
  type TransportRouteGeometry,
  type TelemetryReceipt,
  type VehiclePosition,
} from "@bookingapp/domain";
import type { SqlExecutor } from "./tenant-membership.js";
import { appendAuditEvent } from "./audit-events.js";
import { withTenantTransaction } from "./pg-executor.js";
import { credentialHash, decodeFleetDeviceCredential, decodeFleetSessionCredential } from "./fleet-credentials.js";
import type { Pool } from "pg";

export { createFleetDeviceCredential, createFleetSessionCredential } from "./fleet-credentials.js";

interface DeviceRow { id: string; tenant_id: string; branch_id: string; user_id: string | null; vehicle_resource_id: string | null; platform: FleetDevicePlatform; label: string; status: FleetDevice["status"]; enrolled_at: Date; revoked_at: Date | null; }
interface AssignmentRow { id: string; tenant_id: string; branch_id: string; trip_id: string; user_id: string; role: FleetTripAssignment["role"]; status: FleetTripAssignment["status"]; assigned_at: Date; ended_at: Date | null; }
interface SessionRow { id: string; tenant_id: string; branch_id: string; trip_id: string; device_id: string; driver_user_id: string; vehicle_resource_id: string; status: FleetTrackingSession["status"]; started_at: Date; expires_at: Date; ended_at: Date | null; }
interface SessionCredentialRow extends SessionRow { traccar_credential_hash: string | null; }
interface CrewStatusRow extends AssignmentRow { session_id: string | null; session_device_id: string | null; session_vehicle_resource_id: string | null; session_status: "active" | null; session_started_at: Date | null; session_expires_at: Date | null; }
interface PositionRow { event_id: string; session_id: string; device_id: string; sequence: number; captured_at: Date; received_at: Date; latitude: number; longitude: number; accuracy_metres: number; speed_metres_per_second: number | null; heading_degrees: number | null; battery_percent: number | null; }
interface ReceiptRow { tenant_id: string; event_id: string; session_id: string; device_id: string; decision: TelemetryReceipt["decision"]; reason_code: string | null; }

const deviceColumns = "id, tenant_id, branch_id, user_id, vehicle_resource_id, platform, label, status, enrolled_at, revoked_at";
const assignmentColumns = "id, tenant_id, branch_id, trip_id, user_id, role, status, assigned_at, ended_at";
const sessionColumns = "id, tenant_id, branch_id, trip_id, device_id, driver_user_id, vehicle_resource_id, status, started_at, expires_at, ended_at";
const positionColumns = "event_id, session_id, device_id, sequence, captured_at, received_at, latitude, longitude, accuracy_metres, speed_metres_per_second, heading_degrees, battery_percent";

function mapDevice(row: DeviceRow): FleetDevice { return { id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, userId: row.user_id, vehicleResourceId: row.vehicle_resource_id, platform: row.platform, label: row.label, status: row.status, enrolledAt: new Date(row.enrolled_at), revokedAt: row.revoked_at ? new Date(row.revoked_at) : null }; }
function mapAssignment(row: AssignmentRow): FleetTripAssignment { return { id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, tripId: row.trip_id, userId: row.user_id, role: row.role, status: row.status, assignedAt: new Date(row.assigned_at), endedAt: row.ended_at ? new Date(row.ended_at) : null }; }
function mapSession(row: SessionRow): FleetTrackingSession { return { id: row.id, tenantId: row.tenant_id, branchId: row.branch_id, tripId: row.trip_id, deviceId: row.device_id, driverUserId: row.driver_user_id, vehicleResourceId: row.vehicle_resource_id, status: row.status, startedAt: new Date(row.started_at), expiresAt: new Date(row.expires_at), endedAt: row.ended_at ? new Date(row.ended_at) : null }; }
function mapPosition(row: PositionRow): VehiclePosition { return { eventId: row.event_id, sessionId: row.session_id, deviceId: row.device_id, sequence: Number(row.sequence), capturedAt: new Date(row.captured_at), receivedAt: new Date(row.received_at), latitude: row.latitude, longitude: row.longitude, accuracyMetres: row.accuracy_metres, ...(row.speed_metres_per_second === null ? {} : { speedMetresPerSecond: row.speed_metres_per_second }), ...(row.heading_degrees === null ? {} : { headingDegrees: row.heading_degrees }), ...(row.battery_percent === null ? {} : { batteryPercent: row.battery_percent }) }; }
function mapReceipt(row: ReceiptRow, replayed: boolean): TelemetryReceipt { return { tenantId: row.tenant_id, eventId: row.event_id, sessionId: row.session_id, deviceId: row.device_id, decision: row.decision, reasons: row.reason_code ? row.reason_code.split("|") : [], replayed }; }

export async function enrollFleetDevice(executor: SqlExecutor, input: { id: string; tenantId: string; branchId: string; userId?: string | null; vehicleResourceId?: string | null; platform: FleetDevicePlatform; label: string; credentialSecret: string; actorId?: string }): Promise<FleetDevice> {
  if (input.credentialSecret.length < 32) throw new Error("Device credential must contain at least 32 characters");
  const hash = credentialHash(input.credentialSecret);
  const errors = validateFleetDeviceEnrollment({ ...input, credentialHash: hash });
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<DeviceRow>(`INSERT INTO fleet_devices (id, tenant_id, branch_id, user_id, vehicle_resource_id, credential_hash, platform, label, enrolled_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING ${deviceColumns}`, [input.id, input.tenantId, input.branchId, input.userId ?? null, input.vehicleResourceId ?? null, hash, input.platform, input.label.trim(), input.actorId ?? null]);
  if (!rows[0]) throw new Error("Device could not be enrolled");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "fleet.device_enrolled", entityType: "fleet_device", entityId: input.id, metadata: { branch_id: input.branchId, platform: input.platform } });
  return mapDevice(rows[0]);
}

export async function assignFleetTripCrew(executor: SqlExecutor, input: { id: string; tenantId: string; branchId: string; tripId: string; userId: string; role: FleetTripAssignment["role"]; actorId?: string }): Promise<FleetTripAssignment> {
  const errors = validateFleetTripAssignment(input);
  if (errors.length) throw new Error(errors.join("; "));
  const rows = await executor.query<AssignmentRow>(`INSERT INTO transport_trip_assignments (id, tenant_id, branch_id, trip_id, user_id, role, created_by) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING ${assignmentColumns}`, [input.id, input.tenantId, input.branchId, input.tripId, input.userId, input.role, input.actorId ?? null]);
  if (!rows[0]) throw new Error("Trip crew member could not be assigned");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "fleet.trip_assigned", entityType: "transport_trip_assignment", entityId: input.id, metadata: { branch_id: input.branchId, trip_id: input.tripId, role: input.role } });
  return mapAssignment(rows[0]);
}

async function insertSession(executor: SqlExecutor, input: { id: string; tenantId: string; tripId: string; deviceId: string; driverUserId: string; expiresAt: Date; traccarCredentialSecret: string; actorId?: string }, action: "fleet.tracking_started" | "fleet.tracking_handover"): Promise<FleetTrackingSession> {
  const now = new Date();
  const errors = validateFleetTrackingSession({ ...input, now });
  if (errors.length) throw new Error(errors.join("; "));
  if (input.traccarCredentialSecret.length < 32) throw new Error("Tracking provider credential must contain at least 32 characters");
  const scope = await executor.query<{ branch_id: string; vehicle_resource_id: string }>("SELECT trip.branch_id, trip.vehicle_resource_id FROM transport_trips trip JOIN transport_trip_assignments assignment ON assignment.tenant_id = trip.tenant_id AND assignment.trip_id = trip.id AND assignment.branch_id = trip.branch_id AND assignment.user_id = $4 AND assignment.role = 'driver' AND assignment.status = 'active' JOIN fleet_devices device ON device.tenant_id = trip.tenant_id AND device.id = $3 AND device.branch_id = trip.branch_id AND device.user_id = $4 AND device.status = 'enrolled' WHERE trip.tenant_id = $1 AND trip.id = $2 AND trip.branch_id IS NOT NULL AND trip.vehicle_resource_id IS NOT NULL FOR UPDATE OF trip, assignment, device", [input.tenantId, input.tripId, input.deviceId, input.driverUserId]);
  if (!scope[0]) throw new Error("Driver, device, branch, vehicle, and trip assignment must all match");
  const rows = await executor.query<SessionRow>(`INSERT INTO fleet_tracking_sessions (id, tenant_id, branch_id, trip_id, device_id, driver_user_id, vehicle_resource_id, expires_at, traccar_credential_hash, started_by) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING ${sessionColumns}`, [input.id, input.tenantId, scope[0].branch_id, input.tripId, input.deviceId, input.driverUserId, scope[0].vehicle_resource_id, input.expiresAt, credentialHash(input.traccarCredentialSecret), input.actorId ?? null]);
  if (!rows[0]) throw new Error("Tracking session could not be started");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action, entityType: "fleet_tracking_session", entityId: input.id, metadata: { branch_id: scope[0].branch_id, trip_id: input.tripId, device_id: input.deviceId } });
  return mapSession(rows[0]);
}

export async function startFleetTrackingSession(executor: SqlExecutor, input: { id: string; tenantId: string; tripId: string; deviceId: string; driverUserId: string; expiresAt: Date; traccarCredentialSecret: string; actorId?: string }): Promise<FleetTrackingSession> {
  return insertSession(executor, input, "fleet.tracking_started");
}

export async function handoverFleetTrackingSession(executor: SqlExecutor, input: { previousSessionId: string; id: string; tenantId: string; tripId: string; deviceId: string; driverUserId: string; expiresAt: Date; traccarCredentialSecret: string; actorId?: string }): Promise<FleetTrackingSession> {
  const ended = await executor.query<{ id: string }>("UPDATE fleet_tracking_sessions SET status = 'ended', ended_at = now(), ended_by = $3, end_reason = 'handover' WHERE tenant_id = $1 AND id = $2 AND trip_id = $4 AND status = 'active' RETURNING id", [input.tenantId, input.previousSessionId, input.actorId ?? null, input.tripId]);
  if (!ended[0]) throw new Error("The active tracking session changed before handover");
  return insertSession(executor, input, "fleet.tracking_handover");
}

export async function endFleetTrackingSession(executor: SqlExecutor, input: { tenantId: string; sessionId: string; actorId?: string; reason: string; driverUserId?: string; allowManage?: boolean }): Promise<FleetTrackingSession> {
  const rows = await executor.query<SessionRow>(`UPDATE fleet_tracking_sessions SET status = 'ended', ended_at = now(), ended_by = $3, end_reason = $4 WHERE tenant_id = $1 AND id = $2 AND status = 'active' AND ($5::boolean OR driver_user_id = $6) RETURNING ${sessionColumns}`, [input.tenantId, input.sessionId, input.actorId ?? null, input.reason.slice(0, 200), input.allowManage === true, input.driverUserId ?? null]);
  if (!rows[0]) throw new Error("Tracking session is no longer active");
  await appendAuditEvent(executor, { tenantId: input.tenantId, actorType: input.actorId ? "user" : "system", actorId: input.actorId ?? null, action: "fleet.tracking_ended", entityType: "fleet_tracking_session", entityId: input.sessionId, metadata: { trip_id: rows[0].trip_id, reason: input.reason.slice(0, 120) } });
  return mapSession(rows[0]);
}

export async function endFleetTrackingTrip(executor: SqlExecutor, input: { tenantId: string; tripId: string; branchIds?: readonly string[]; actorId?: string; reason: string }): Promise<FleetTrackingSession | null> {
  if (input.branchIds?.length === 0) return null;
  const rows = await executor.query<SessionRow>(`SELECT ${sessionColumns} FROM fleet_tracking_sessions WHERE tenant_id = $1 AND trip_id = $2 AND status = 'active' AND expires_at > now() AND ($3::text[] IS NULL OR branch_id = ANY($3)) ORDER BY started_at DESC LIMIT 1 FOR UPDATE`, [input.tenantId, input.tripId, input.branchIds ?? null]);
  if (!rows[0]) return null;
  return endFleetTrackingSession(executor, { tenantId: input.tenantId, sessionId: rows[0].id, ...(input.actorId ? { actorId: input.actorId } : {}), allowManage: true, reason: input.reason });
}

export async function ingestFleetPosition(executor: SqlExecutor, input: { tenantId: string; position: VehiclePosition }): Promise<TelemetryReceipt> {
  const prior = await executor.query<ReceiptRow>("SELECT tenant_id, event_id, session_id, device_id, decision, reason_code FROM fleet_telemetry_receipts WHERE tenant_id = $1 AND event_id = $2 LIMIT 1", [input.tenantId, input.position.eventId]);
  if (prior[0]) return mapReceipt(prior[0], true);
  const sessions = await executor.query<SessionRow>(`SELECT session.${sessionColumns.replaceAll(", ", ", session.")} FROM fleet_tracking_sessions session JOIN fleet_devices device ON device.tenant_id = session.tenant_id AND device.id = session.device_id AND device.status = 'enrolled' WHERE session.tenant_id = $1 AND session.id = $2 AND session.device_id = $3 FOR UPDATE OF session`, [input.tenantId, input.position.sessionId, input.position.deviceId]);
  if (!sessions[0]) throw new Error("Tracking session or device is not recognized");
  const session = sessions[0];
  const currentRows = await executor.query<PositionRow>(`SELECT ${positionColumns} FROM fleet_current_positions WHERE tenant_id = $1 AND session_id = $2 FOR UPDATE`, [input.tenantId, session.id]);
  const inactive = session.status !== "active" || session.expires_at <= input.position.receivedAt;
  const evaluation = inactive ? { decision: "reject" as const, reasons: ["Tracking session is not active"] } : evaluateVehiclePosition(input.position, currentRows[0] ? mapPosition(currentRows[0]) : null);
  const reasonCode = evaluation.reasons.join("|") || null;
  const payloadHash = createHash("sha256").update(JSON.stringify(input.position)).digest("hex");
  const receipts = await executor.query<ReceiptRow>("INSERT INTO fleet_telemetry_receipts (tenant_id, event_id, session_id, device_id, sequence, captured_at, received_at, decision, reason_code, payload_sha256) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) ON CONFLICT (tenant_id, event_id) DO NOTHING RETURNING tenant_id, event_id, session_id, device_id, decision, reason_code", [input.tenantId, input.position.eventId, session.id, session.device_id, input.position.sequence, input.position.capturedAt, input.position.receivedAt, evaluation.decision, reasonCode, payloadHash]);
  if (!receipts[0]) { const replay = await executor.query<ReceiptRow>("SELECT tenant_id, event_id, session_id, device_id, decision, reason_code FROM fleet_telemetry_receipts WHERE tenant_id = $1 AND event_id = $2", [input.tenantId, input.position.eventId]); if (!replay[0]) throw new Error("Telemetry replay could not be resolved"); return mapReceipt(replay[0], true); }
  if (evaluation.decision !== "reject") {
    const values = [input.tenantId, session.branch_id, session.trip_id, session.id, session.device_id, session.vehicle_resource_id, input.position.eventId, input.position.sequence, input.position.capturedAt, input.position.receivedAt, input.position.latitude, input.position.longitude, input.position.accuracyMetres, input.position.speedMetresPerSecond ?? null, input.position.headingDegrees ?? null, input.position.batteryPercent ?? null];
    await executor.query("INSERT INTO fleet_position_history (tenant_id, branch_id, trip_id, session_id, device_id, vehicle_resource_id, event_id, sequence, captured_at, received_at, latitude, longitude, accuracy_metres, speed_metres_per_second, heading_degrees, battery_percent, disposition) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17)", [...values, evaluation.decision]);
    if (evaluation.decision === "advance_current") await executor.query("INSERT INTO fleet_current_positions (tenant_id, branch_id, trip_id, session_id, device_id, vehicle_resource_id, event_id, sequence, captured_at, received_at, latitude, longitude, accuracy_metres, speed_metres_per_second, heading_degrees, battery_percent) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16) ON CONFLICT (tenant_id, session_id) DO UPDATE SET event_id = EXCLUDED.event_id, sequence = EXCLUDED.sequence, captured_at = EXCLUDED.captured_at, received_at = EXCLUDED.received_at, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude, accuracy_metres = EXCLUDED.accuracy_metres, speed_metres_per_second = EXCLUDED.speed_metres_per_second, heading_degrees = EXCLUDED.heading_degrees, battery_percent = EXCLUDED.battery_percent WHERE (EXCLUDED.captured_at, EXCLUDED.sequence) > (fleet_current_positions.captured_at, fleet_current_positions.sequence)", values);
  }
  return mapReceipt(receipts[0], false);
}

export async function ingestTraccarCredential(executor: SqlExecutor, credential: string, observation: FleetTelemetryObservation): Promise<{ receipt: TelemetryReceipt; receivedAt: Date } | { kind: "inactive" } | null> {
  const decoded = decodeFleetSessionCredential(credential);
  if (!decoded) return null;
  const sessions = await executor.query<SessionCredentialRow>(`SELECT session.${sessionColumns.replaceAll(", ", ", session.")}, session.traccar_credential_hash FROM fleet_tracking_sessions session JOIN fleet_devices device ON device.tenant_id = session.tenant_id AND device.id = session.device_id AND device.status = 'enrolled' WHERE session.tenant_id = $1 AND session.id = $2 FOR UPDATE OF session`, [decoded.tenantId, decoded.sessionId]);
  if (!sessions[0]) return null;
  const receivedAt = new Date();
  if (sessions[0].traccar_credential_hash !== credentialHash(decoded.secret)) return null;
  if (sessions[0].status !== "active" || sessions[0].expires_at <= receivedAt) return { kind: "inactive" };
  const current = await executor.query<{ sequence: number }>("SELECT sequence FROM fleet_current_positions WHERE tenant_id = $1 AND session_id = $2 FOR UPDATE", [decoded.tenantId, sessions[0].id]);
  const position: VehiclePosition = { ...observation, sessionId: sessions[0].id, deviceId: sessions[0].device_id, sequence: current[0] ? Number(current[0].sequence) + 1 : 0, receivedAt };
  return { receipt: await ingestFleetPosition(executor, { tenantId: decoded.tenantId, position }), receivedAt };
}

export interface FleetCurrentProjection {
  tripId: string;
  branchId: string;
  vehicleLabel: string;
  routeLabel: string;
  capturedAt: Date | null;
  latitude: number | null;
  longitude: number | null;
  accuracyMetres: number | null;
  headingDegrees: number | null;
  geometry?: TransportRouteGeometry | null;
  stops?: readonly FleetRouteStop[];
  eta?: RouteEtaEstimate | null;
}

interface FleetRouteStop extends RouteEtaStop { stopId: string; label?: string; }
interface FleetEtaStopRow extends RouteEtaStop { stop_id?: string; label?: string; }
interface FleetCurrentRow { trip_id: string; branch_id: string; vehicle_label: string; route_label: string; route_geometry?: TransportRouteGeometry | null; route_stops?: readonly FleetEtaStopRow[]; destination_stop_sequence?: number | null; captured_at: Date | null; latitude: number | null; longitude: number | null; accuracy_metres: number | null; speed_metres_per_second?: number | null; heading_degrees: number | null; }

export async function listCurrentFleetPositions(executor: SqlExecutor, tenantId: string, branchIds?: readonly string[], assignedUserId?: string): Promise<readonly FleetCurrentProjection[]> {
  if (branchIds?.length === 0) return [];
  const rows = await executor.query<FleetCurrentRow>("SELECT session.trip_id, session.branch_id, vehicle.name AS vehicle_label, route.name AS route_label, route.geometry AS route_geometry, (SELECT destination.sequence FROM transport_route_stops destination WHERE destination.tenant_id = trip.tenant_id AND destination.route_id = trip.route_id AND destination.route_version = trip.route_version ORDER BY destination.sequence DESC LIMIT 1) AS destination_stop_sequence, COALESCE((SELECT jsonb_agg(jsonb_build_object('stop_id', stop.stop_id, 'label', stop.label, 'sequence', stop.sequence, 'boardingMinutes', stop.boarding_minutes, 'alightingMinutes', stop.alighting_minutes, 'latitude', stop.latitude, 'longitude', stop.longitude) ORDER BY stop.sequence) FROM transport_route_stops stop WHERE stop.tenant_id = trip.tenant_id AND stop.route_id = trip.route_id AND stop.route_version = trip.route_version), '[]'::jsonb) AS route_stops, current.captured_at, current.latitude, current.longitude, current.accuracy_metres, current.speed_metres_per_second, current.heading_degrees FROM fleet_tracking_sessions session JOIN transport_trips trip ON trip.tenant_id = session.tenant_id AND trip.id = session.trip_id JOIN transport_routes route ON route.tenant_id = trip.tenant_id AND route.id = trip.route_id AND route.version = trip.route_version JOIN booking_resources vehicle ON vehicle.tenant_id = session.tenant_id AND vehicle.id = session.vehicle_resource_id LEFT JOIN fleet_current_positions current ON current.tenant_id = session.tenant_id AND current.session_id = session.id WHERE session.tenant_id = $1 AND session.status = 'active' AND session.expires_at > now() AND ($2::text[] IS NULL OR session.branch_id = ANY($2)) AND ($3::text IS NULL OR EXISTS (SELECT 1 FROM transport_trip_assignments assignment WHERE assignment.tenant_id = session.tenant_id AND assignment.trip_id = session.trip_id AND assignment.branch_id = session.branch_id AND assignment.user_id = $3 AND assignment.role IN ('driver', 'conductor') AND assignment.status = 'active')) ORDER BY vehicle.name, session.trip_id", [tenantId, branchIds ?? null, assignedUserId ?? null]);
  return rows.map((row) => { const capturedAt = row.captured_at ? new Date(row.captured_at) : null; const freshness = capturedAt ? classifyPositionFreshness(capturedAt, new Date()) : "offline"; const destinationStopSequence = row.destination_stop_sequence ?? null; const eta = destinationStopSequence === null ? null : estimateRouteEta({ geometry: row.route_geometry, stops: row.route_stops ?? [], destinationStopSequence, latitude: row.latitude, longitude: row.longitude, accuracyMetres: row.accuracy_metres, speedMetresPerSecond: row.speed_metres_per_second ?? null, capturedAt, freshness, now: new Date() }); return { tripId: row.trip_id, branchId: row.branch_id, vehicleLabel: row.vehicle_label, routeLabel: row.route_label, capturedAt, latitude: row.latitude, longitude: row.longitude, accuracyMetres: row.accuracy_metres, headingDegrees: row.heading_degrees, ...(row.route_geometry ? { geometry: row.route_geometry } : {}), ...(row.route_stops?.length ? { stops: row.route_stops.map((stop) => ({ stopId: stop.stop_id ?? `stop-${stop.sequence}`, ...(stop.label ? { label: stop.label } : {}), sequence: stop.sequence, boardingMinutes: stop.boardingMinutes, alightingMinutes: stop.alightingMinutes, ...(stop.latitude === undefined ? {} : { latitude: stop.latitude }), ...(stop.longitude === undefined ? {} : { longitude: stop.longitude }) })) } : {}), eta }; });
}

export async function listAssignedFleetStatus(executor: SqlExecutor, tenantId: string, userId: string, branchIds?: readonly string[]): Promise<readonly FleetCrewAssignmentStatus[]> {
  if (branchIds?.length === 0) return [];
  const rows = await executor.query<CrewStatusRow>("SELECT assignment.id, assignment.tenant_id, assignment.branch_id, assignment.trip_id, assignment.user_id, assignment.role, assignment.status, assignment.assigned_at, assignment.ended_at, session.id AS session_id, session.device_id AS session_device_id, session.vehicle_resource_id AS session_vehicle_resource_id, session.status AS session_status, session.started_at AS session_started_at, session.expires_at AS session_expires_at FROM transport_trip_assignments assignment LEFT JOIN fleet_tracking_sessions session ON session.tenant_id = assignment.tenant_id AND session.trip_id = assignment.trip_id AND session.branch_id = assignment.branch_id AND session.status = 'active' AND session.expires_at > now() WHERE assignment.tenant_id = $1 AND assignment.user_id = $2 AND assignment.status = 'active' AND ($3::text[] IS NULL OR assignment.branch_id = ANY($3)) ORDER BY assignment.assigned_at DESC, assignment.id", [tenantId, userId, branchIds ?? null]);
  return rows.map((row) => ({
    assignmentId: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id,
    tripId: row.trip_id,
    role: row.role,
    status: row.status,
    assignedAt: new Date(row.assigned_at),
    endedAt: row.ended_at ? new Date(row.ended_at) : null,
    activeSession: row.session_id && row.session_device_id && row.session_vehicle_resource_id && row.session_started_at && row.session_expires_at ? {
      id: row.session_id,
      deviceId: row.session_device_id,
      vehicleResourceId: row.session_vehicle_resource_id,
      status: "active" as const,
      startedAt: new Date(row.session_started_at),
      expiresAt: new Date(row.session_expires_at),
      endedAt: null,
    } : null,
  }));
}

export async function readFleetTripBranch(executor: SqlExecutor, tenantId: string, tripId: string): Promise<string | null> {
  const rows = await executor.query<{ branch_id: string | null }>("SELECT branch_id FROM transport_trips WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, tripId]);
  return rows[0]?.branch_id ?? null;
}

export async function readFleetSessionScope(executor: SqlExecutor, tenantId: string, sessionId: string): Promise<{ branchId: string; driverUserId: string } | null> {
  const rows = await executor.query<{ branch_id: string; driver_user_id: string }>("SELECT branch_id, driver_user_id FROM fleet_tracking_sessions WHERE tenant_id = $1 AND id = $2 LIMIT 1", [tenantId, sessionId]);
  return rows[0] ? { branchId: rows[0].branch_id, driverUserId: rows[0].driver_user_id } : null;
}

export function createDatabaseFleetTrackingAdmin(pool: Pool) {
  return {
    enroll: (input: Parameters<typeof enrollFleetDevice>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => enrollFleetDevice(executor, input)),
    assign: (input: Parameters<typeof assignFleetTripCrew>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => assignFleetTripCrew(executor, input)),
    start: (input: Parameters<typeof startFleetTrackingSession>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => startFleetTrackingSession(executor, input)),
    handover: (input: Parameters<typeof handoverFleetTrackingSession>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => handoverFleetTrackingSession(executor, input)),
    end: (input: Parameters<typeof endFleetTrackingSession>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => endFleetTrackingSession(executor, input)),
    endTrip: (input: Parameters<typeof endFleetTrackingTrip>[1]) => withTenantTransaction(pool, input.tenantId, (executor) => endFleetTrackingTrip(executor, input)),
    listCurrent: (tenantId: string, branchIds?: readonly string[], assignedUserId?: string) => withTenantTransaction(pool, tenantId, (executor) => listCurrentFleetPositions(executor, tenantId, branchIds, assignedUserId)),
    listAssigned: (tenantId: string, userId: string, branchIds?: readonly string[]) => withTenantTransaction(pool, tenantId, (executor) => listAssignedFleetStatus(executor, tenantId, userId, branchIds)),
    readTripBranch: (tenantId: string, tripId: string) => withTenantTransaction(pool, tenantId, (executor) => readFleetTripBranch(executor, tenantId, tripId)),
    readSessionScope: (tenantId: string, sessionId: string) => withTenantTransaction(pool, tenantId, (executor) => readFleetSessionScope(executor, tenantId, sessionId)),
    async ingestCredential(credential: string, position: Omit<VehiclePosition, "deviceId" | "receivedAt">): Promise<{ receipt: TelemetryReceipt; receivedAt: Date } | null> {
      const decoded = decodeFleetDeviceCredential(credential);
      if (!decoded) return null;
      return withTenantTransaction(pool, decoded.tenantId, async (executor) => {
        const device = await executor.query<{ id: string }>("SELECT id FROM fleet_devices WHERE tenant_id = $1 AND id = $2 AND credential_hash = $3 AND status = 'enrolled' LIMIT 1", [decoded.tenantId, decoded.deviceId, credentialHash(decoded.secret)]);
        if (!device[0]) return null;
        const receivedAt = new Date();
        const receipt = await ingestFleetPosition(executor, { tenantId: decoded.tenantId, position: { ...position, deviceId: decoded.deviceId, receivedAt } });
        return { receipt, receivedAt };
      });
    },
    async ingestTraccarCredential(credential: string, observation: FleetTelemetryObservation): Promise<{ receipt: TelemetryReceipt; receivedAt: Date } | { kind: "inactive" } | null> {
      const decoded = decodeFleetSessionCredential(credential);
      if (!decoded) return null;
      return withTenantTransaction(pool, decoded.tenantId, (executor) => ingestTraccarCredential(executor, credential, observation));
    },
  };
}

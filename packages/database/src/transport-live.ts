// Ownership: public rider live capability issuance and ticket-safe projection reads.

import { classifyPositionFreshness, estimateRouteEta, type RouteEtaEstimate, type RouteEtaStop, type TransportRouteGeometry } from "@bookingapp/domain";
import { createHash, randomBytes } from "node:crypto";
import type { SqlExecutor } from "./tenant-membership.js";

export interface PublicLiveProjection {
  tripId: string;
  routeLabel: string;
  capturedAt: string | null;
  freshness: "live" | "delayed" | "signal_weak" | "offline";
  latitude: number | null;
  longitude: number | null;
  accuracyMetres: number | null;
  headingDegrees: number | null;
  eta: { earliestArrival: string; latestArrival: string; confidence: "low" | "medium" | "high" } | null;
}

interface ViewerTicketRow { tenant_id: string; ticket_id: string; trip_id: string; }
interface RouteStopRow extends RouteEtaStop { stop_id?: string; }
interface ViewerSessionRow { tenant_id: string; trip_id: string; route_name: string; route_geometry?: TransportRouteGeometry | null; route_stops?: readonly RouteStopRow[]; destination_stop_sequence?: number | null; captured_at: Date | null; latitude: number | null; longitude: number | null; accuracy_metres: number | null; speed_metres_per_second?: number | null; heading_degrees: number | null; }

function tokenHash(token: string): string { return createHash("sha256").update(token).digest("hex"); }
function serializeEta(value: RouteEtaEstimate | null): PublicLiveProjection["eta"] { return value ? { earliestArrival: value.earliestArrival.toISOString(), latestArrival: value.latestArrival.toISOString(), confidence: value.confidence } : null; }
function estimate(row: ViewerSessionRow, freshness: PublicLiveProjection["freshness"]): RouteEtaEstimate | null { if (row.destination_stop_sequence === null || row.destination_stop_sequence === undefined) return null; return estimateRouteEta({ geometry: row.route_geometry, stops: row.route_stops ?? [], destinationStopSequence: row.destination_stop_sequence, latitude: row.latitude, longitude: row.longitude, accuracyMetres: row.accuracy_metres, speedMetresPerSecond: row.speed_metres_per_second ?? null, capturedAt: row.captured_at, freshness, now: new Date() }); }
function projection(row: ViewerSessionRow): PublicLiveProjection { const freshness = row.captured_at ? classifyPositionFreshness(row.captured_at, new Date()) : "offline"; return { tripId: row.trip_id, routeLabel: row.route_name, capturedAt: row.captured_at?.toISOString() ?? null, freshness, latitude: row.latitude, longitude: row.longitude, accuracyMetres: row.accuracy_metres, headingDegrees: row.heading_degrees, eta: serializeEta(estimate(row, freshness)) }; }
function liveProjectionSql(where: string): string { return `SELECT ${where.includes("viewer") ? "viewer.tenant_id" : "tt.tenant_id"}, ${where.includes("viewer") ? "viewer.trip_id" : "tt.trip_id"}, r.name AS route_name, r.geometry AS route_geometry, (SELECT destination.sequence FROM transport_route_stops destination WHERE destination.tenant_id = trip.tenant_id AND destination.route_id = trip.route_id AND destination.route_version = trip.route_version AND destination.stop_id = tr.destination_stop_id LIMIT 1) AS destination_stop_sequence, COALESCE((SELECT jsonb_agg(jsonb_build_object('stop_id', stop.stop_id, 'sequence', stop.sequence, 'boardingMinutes', stop.boarding_minutes, 'alightingMinutes', stop.alighting_minutes, 'latitude', stop.latitude, 'longitude', stop.longitude) ORDER BY stop.sequence) FROM transport_route_stops stop WHERE stop.tenant_id = trip.tenant_id AND stop.route_id = trip.route_id AND stop.route_version = trip.route_version), '[]'::jsonb) AS route_stops, current.captured_at, current.latitude, current.longitude, current.accuracy_metres, current.speed_metres_per_second, current.heading_degrees FROM ${where.includes("viewer") ? "transport_live_viewer_sessions viewer JOIN transport_tickets tt ON tt.tenant_id = viewer.tenant_id AND tt.id = viewer.ticket_id" : "transport_tickets tt"} JOIN transport_trip_reservations tr ON tr.tenant_id = tt.tenant_id AND tr.reservation_id = tt.reservation_id AND tr.trip_id = tt.trip_id JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id JOIN transport_trips trip ON trip.tenant_id = tt.tenant_id AND trip.id = tt.trip_id JOIN transport_routes r ON r.tenant_id = trip.tenant_id AND r.id = trip.route_id AND r.version = trip.route_version LEFT JOIN fleet_tracking_sessions session ON session.tenant_id = tt.tenant_id AND session.trip_id = tt.trip_id AND session.status = 'active' AND session.expires_at > now() LEFT JOIN fleet_current_positions current ON current.tenant_id = session.tenant_id AND current.session_id = session.id WHERE ${where} AND tt.status = 'issued' AND sr.status IN ('confirmed', 'checked_in') LIMIT 1`; }

export async function issuePublicTransportLiveViewer(executor: SqlExecutor, ticketToken: string, ttlSeconds = 600): Promise<{ viewerToken: string; expiresAt: Date } | null> {
  if (!ticketToken || !Number.isInteger(ttlSeconds) || ttlSeconds < 60 || ttlSeconds > 900) return null;
  const tickets = await executor.query<ViewerTicketRow>("SELECT tt.tenant_id, tt.id AS ticket_id, tt.trip_id FROM transport_tickets tt JOIN transport_trip_reservations tr ON tr.tenant_id = tt.tenant_id AND tr.reservation_id = tt.reservation_id AND tr.trip_id = tt.trip_id JOIN service_reservations sr ON sr.tenant_id = tr.tenant_id AND sr.id = tr.reservation_id WHERE tt.ticket_token_hash = $1 AND tt.status = 'issued' AND sr.status IN ('confirmed', 'checked_in') LIMIT 1", [tokenHash(ticketToken)]);
  const ticket = tickets[0]; if (!ticket) return null;
  const viewerToken = randomBytes(32).toString("base64url"); const expiresAt = new Date(Date.now() + ttlSeconds * 1000);
  const rows = await executor.query<{ token_hash: string }>("INSERT INTO transport_live_viewer_sessions (token_hash, tenant_id, ticket_id, trip_id, expires_at) VALUES ($1,$2,$3,$4,$5) RETURNING token_hash", [tokenHash(viewerToken), ticket.tenant_id, ticket.ticket_id, ticket.trip_id, expiresAt]);
  return rows[0] ? { viewerToken, expiresAt } : null;
}

export async function readPublicTransportLiveViewer(executor: SqlExecutor, viewerToken: string): Promise<{ tenantId: string; projection: PublicLiveProjection } | null> {
  if (!viewerToken) return null;
  const rows = await executor.query<ViewerSessionRow>(liveProjectionSql("viewer.token_hash = $1 AND viewer.revoked_at IS NULL AND viewer.expires_at > now()"), [tokenHash(viewerToken)]);
  const row = rows[0]; return row ? { tenantId: row.tenant_id, projection: projection(row) } : null;
}

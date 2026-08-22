// Ownership: tenant-aware Next schedule surface backed by the canonical booking contract.
"use client";

import { useEffect, useState } from "react";
import type { BookingSummary } from "@bookingapp/contracts";
import { fetchBookings, setBookingStatus, type BookingsState } from "../../src/bookings-client.js";
import { fetchCustomers } from "../../src/customers-client.js";
import { customerDisplayName } from "../../src/schedule-display.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";
import { BookingCreateDialog } from "./booking-create-dialog.js";

type ScheduleState = { kind: "idle" } | { kind: "loading" } | BookingsState;
type RequestInitLike = { credentials: "include"; method?: "POST" | "PUT"; headers?: Record<string, string>; body?: string };
function request(input: string, init: RequestInitLike): Promise<Response> { return window.fetch(input, init); }
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }

function BookingRow({ booking, tenantId, customerNames, onChange }: { booking: BookingSummary; tenantId: string; customerNames: Readonly<Record<string, string>>; onChange: (state: BookingsState) => void }) {
  const [pending, setPending] = useState<"completed" | "cancelled" | null>(null);
  async function change(status: "completed" | "cancelled") {
    if (pending) return;
    setPending(status);
    try {
      const result = await setBookingStatus(request, apiBase, tenantId, booking.id, status);
      onChange(result.kind === "ready" ? { kind: "ready", bookings: [] } : result);
    } catch { onChange({ kind: "error", message: "Appointment could not be updated. Please try again." }); } finally { setPending(null); }
  }
  return <article className="schedule-booking-row"><div className="schedule-booking-time"><time dateTime={booking.startsAt}>{dateLabel(booking.startsAt)}</time><span>{dateLabel(booking.endsAt)}</span></div><div className="schedule-booking-detail"><strong>{booking.serviceName}</strong><span>{customerDisplayName(booking.customerId, customerNames)}</span><small>{booking.resourceIds?.length ? `${booking.resourceIds.length} resource${booking.resourceIds.length === 1 ? "" : "s"} assigned` : "No resource assigned"}</small></div><div className={`schedule-status schedule-status-${booking.status}`}>{booking.status.replace("_", " ")}</div>{booking.status === "scheduled" && <div className="schedule-booking-actions"><button className="account-button" type="button" disabled={pending !== null} onClick={() => void change("completed")}>{pending === "completed" ? "Completing..." : "Complete"}</button><button className="quiet-danger-button" type="button" disabled={pending !== null} onClick={() => void change("cancelled")}>{pending === "cancelled" ? "Cancelling..." : "Cancel"}</button></div>}</article>;
}

function ScheduleResults({ tenantId, state, customerNames, reload, onCreate }: { tenantId: string; state: ScheduleState; customerNames: Readonly<Record<string, string>>; reload: () => void; onCreate: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  if (state.kind === "loading" || state.kind === "idle") return <section className="schedule-results" aria-busy="true"><div className="schedule-skeleton" /><div className="schedule-skeleton" /><div className="schedule-skeleton" /></section>;
  if (!("bookings" in state)) return <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Schedule unavailable</p><h2>{state.message}</h2><button className="account-button" type="button" onClick={reload}>Try again</button></section>;
  if (!state.bookings.length) return <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">No appointments yet</p><h2>This workspace has no appointments in the current window.</h2><p>Add an appointment here, and it will appear in the schedule with its current status.</p><button className="primary-button" type="button" onClick={onCreate}>Add first appointment</button></section>;
  return <section className="schedule-results" aria-label="Appointments">{notice && <p className="schedule-notice" role="status">{notice}</p>}{state.bookings.map((booking) => <BookingRow booking={booking} tenantId={tenantId} customerNames={customerNames} key={booking.id} onChange={(result) => { if (result.kind === "ready" && !result.bookings.length) { setNotice("Appointment updated. Refreshing the schedule..."); reload(); } else if (result.kind !== "ready") setNotice(result.message); }} />)}</section>;
}

export function SchedulePage() {
  const { admission, retry } = useWorkspaceAdmission();
  const [schedule, setSchedule] = useState<ScheduleState>({ kind: "idle" });
  const [customerNames, setCustomerNames] = useState<Readonly<Record<string, string>>>({});
  const [createRequest, setCreateRequest] = useState(0);
  useEffect(() => {
    if (admission.kind !== "ready") return;
    let cancelled = false;
    setSchedule({ kind: "loading" });
    setCustomerNames({});
    void Promise.all([fetchBookings(request, apiBase, admission.tenantId), fetchCustomers(request, apiBase, admission.tenantId)]).then(([bookingsResult, customersResult]) => {
      if (cancelled) return;
      if (customersResult.kind === "ready") setCustomerNames(Object.fromEntries(customersResult.customers.map((customer) => [customer.id, customer.displayName])));
      setSchedule(bookingsResult);
    }).catch(() => { if (!cancelled) setSchedule({ kind: "error", message: "We could not load appointments. Please try again." }); });
    return () => { cancelled = true; };
  }, [admission]);
  return <WorkspaceShell activeHref="/app/schedule"><section className="workspace-content schedule-page"><header className="page-intro"><div><p className="eyebrow">Appointment operations</p><h1>Schedule</h1><p className="intro-copy">Keep today's service work clear, current, and easy to act on.</p></div><div className="schedule-header-actions">{admission.kind === "ready" && <BookingCreateDialog tenantId={admission.tenantId} onCreated={retry} openRequest={createRequest} />}<button className="account-button" type="button" onClick={retry}>Refresh</button></div></header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to see the schedule" /> : <><div className="schedule-context"><span className="schedule-live-dot" aria-hidden="true" /><span>{admission.tenantId}</span><small>{admission.role} / {admission.branchCount} branch{admission.branchCount === 1 ? "" : "es"}</small></div><ScheduleResults tenantId={admission.tenantId} state={schedule} customerNames={customerNames} reload={retry} onCreate={() => setCreateRequest((value) => value + 1)} /></>}</section></WorkspaceShell>;
}

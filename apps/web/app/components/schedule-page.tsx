// Ownership: tenant-aware Next schedule surface backed by the canonical booking contract.
"use client";

import { useEffect, useMemo, useState } from "react";
import type { BookingSummary } from "@bookingapp/contracts";
import { fetchBookings, setBookingStatus, type BookingsState } from "../../src/bookings-client.js";
import { fetchAuthorizedWorkspaces, type WorkspacesState } from "../../src/workspaces-client.js";
import { loadWorkspaceContext, type WorkspaceContextState } from "../../src/workspace-context.js";
import { WorkspaceShell } from "./workspace-shell.js";

const apiBase = (process.env.NEXT_PUBLIC_API_BASE ?? "").replace(/\/$/u, "");
type Workspaces = Extract<WorkspacesState, { kind: "ready" }>["workspaces"];
type AdmissionState = { kind: "disconnected" | "loading"; message?: string } | WorkspaceContextState | { kind: "selecting"; workspaces: Workspaces };
type ScheduleState = { kind: "idle" } | { kind: "loading" } | BookingsState;
type RequestInitLike = { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string };

function request(input: string, init: RequestInitLike): Promise<Response> { return window.fetch(input, init); }
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Time unavailable" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }

function AdmissionNotice({ state }: { state: AdmissionState }) {
  const message = state.kind === "loading" ? "Connecting to your workspace..." : state.kind === "unauthenticated" || state.kind === "denied" || state.kind === "error" ? state.message : "Use NIU Auth, then choose an authorized organization and branch to see its appointments.";
  return <section className="schedule-empty" aria-live="polite"><div className="schedule-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M7 3v4m10-4v4M4 9h16M6 5h12a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H6V7a2 2 0 0 1 2-2Z" /></svg></div><p className="eyebrow">Workspace not connected</p><h2>Choose a workspace to see the schedule</h2><p>{message}</p>{state.kind !== "denied" && state.kind !== "loading" && <a className="primary-button" href="/auth/sign-in">Continue to sign in <span aria-hidden="true">-</span></a>}</section>;
}

function WorkspacePicker({ workspaces }: { workspaces: Workspaces }) {
  return <section className="schedule-picker" aria-labelledby="schedule-picker-title"><div><p className="eyebrow">Authorized workspaces</p><h2 id="schedule-picker-title">Where would you like to work?</h2><p>Select an organization from your live NIU Auth membership.</p></div><div className="schedule-picker-list">{workspaces.map((workspace) => <a className="schedule-workspace-choice" href={`/app/schedule?tenant=${encodeURIComponent(workspace.tenantId)}`} key={workspace.tenantId}><span><strong>{workspace.tenantId}</strong><small>{workspace.role} / {workspace.branchIds.length} branch{workspace.branchIds.length === 1 ? "" : "es"}</small></span><span aria-hidden="true">-</span></a>)}</div></section>;
}

function BookingRow({ booking, tenantId, onChange }: { booking: BookingSummary; tenantId: string; onChange: (state: BookingsState) => void }) {
  const [pending, setPending] = useState<"completed" | "cancelled" | null>(null);
  async function change(status: "completed" | "cancelled") {
    setPending(status);
    const result = await setBookingStatus(request, apiBase, tenantId, booking.id, status);
    onChange(result.kind === "ready" ? { kind: "ready", bookings: [] } : result);
    setPending(null);
  }
  return <article className="schedule-booking-row"><div className="schedule-booking-time"><time dateTime={booking.startsAt}>{dateLabel(booking.startsAt)}</time><span>{dateLabel(booking.endsAt)}</span></div><div className="schedule-booking-detail"><strong>{booking.serviceName}</strong><span>Customer {booking.customerId}</span><small>{booking.resourceIds?.length ? `${booking.resourceIds.length} resource${booking.resourceIds.length === 1 ? "" : "s"} assigned` : "No resource assigned"}</small></div><div className={`schedule-status schedule-status-${booking.status}`}>{booking.status.replace("_", " ")}</div>{booking.status === "scheduled" && <div className="schedule-booking-actions"><button className="account-button" type="button" disabled={pending !== null} onClick={() => void change("completed")}>{pending === "completed" ? "Completing..." : "Complete"}</button><button className="quiet-danger-button" type="button" disabled={pending !== null} onClick={() => void change("cancelled")}>{pending === "cancelled" ? "Cancelling..." : "Cancel"}</button></div>}</article>;
}

function ScheduleResults({ tenantId, state, reload }: { tenantId: string; state: ScheduleState; reload: () => void }) {
  const [notice, setNotice] = useState<string | null>(null);
  if (state.kind === "loading" || state.kind === "idle") return <section className="schedule-results" aria-busy="true"><div className="schedule-skeleton" /><div className="schedule-skeleton" /><div className="schedule-skeleton" /></section>;
  if (!("bookings" in state)) return <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Schedule unavailable</p><h2>{state.message}</h2><button className="account-button" type="button" onClick={reload}>Try again</button></section>;
  if (!state.bookings.length) return <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">No appointments yet</p><h2>This workspace has no appointments in the current window.</h2><p>Create the first appointment from the compatibility booking form, then it will appear here with its live status.</p><a className="primary-button" href={`/bookings.html?tenant=${encodeURIComponent(tenantId)}`}>Open appointment form</a></section>;
  return <section className="schedule-results" aria-label="Appointments">{notice && <p className="schedule-notice" role="status">{notice}</p>}{state.bookings.map((booking) => <BookingRow booking={booking} tenantId={tenantId} key={booking.id} onChange={(result) => { if (result.kind === "ready" && !result.bookings.length) { setNotice("Appointment updated. Refreshing the schedule..."); reload(); } else if (result.kind !== "ready") setNotice(result.message); }} />)}</section>;
}

export function SchedulePage() {
  const [admission, setAdmission] = useState<AdmissionState>({ kind: "disconnected" });
  const [schedule, setSchedule] = useState<ScheduleState>({ kind: "idle" });
  const tenantId = useMemo(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("tenant")?.trim() ?? "", []);
  useEffect(() => {
    if (!apiBase) return;
    let cancelled = false;
    setAdmission({ kind: "loading" });
    const admit = async () => {
      if (tenantId) return loadWorkspaceContext(request, apiBase, tenantId).then((state) => { if (!cancelled) setAdmission(state); });
      const result = await fetchAuthorizedWorkspaces(request, apiBase);
      if (cancelled) return;
      if (result.kind !== "ready") return setAdmission(result);
      if (result.workspaces.length === 1 && result.workspaces[0]) return loadWorkspaceContext(request, apiBase, result.workspaces[0].tenantId).then((state) => { if (!cancelled) setAdmission(state); });
      setAdmission({ kind: "selecting", workspaces: result.workspaces });
    };
    void admit().catch(() => { if (!cancelled) setAdmission({ kind: "error", message: "Your workspaces are temporarily unavailable. Please try again." }); });
    return () => { cancelled = true; };
  }, [tenantId]);
  useEffect(() => {
    if (admission.kind !== "ready") return;
    let cancelled = false;
    setSchedule({ kind: "loading" });
    void fetchBookings(request, apiBase, admission.tenantId).then((result) => { if (!cancelled) setSchedule(result); }).catch(() => { if (!cancelled) setSchedule({ kind: "error", message: "We could not load appointments. Please try again." }); });
    return () => { cancelled = true; };
  }, [admission]);
  return <WorkspaceShell activeHref="/app/schedule"><section className="workspace-content schedule-page"><header className="page-intro"><div><p className="eyebrow">Appointment operations</p><h1>Schedule</h1><p className="intro-copy">Keep today's service work clear, current, and easy to act on.</p></div><button className="account-button" type="button" onClick={() => window.location.reload()}>Refresh</button></header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} /> : <><div className="schedule-context"><span className="schedule-live-dot" aria-hidden="true" /><span>{admission.tenantId}</span><small>{admission.role} / {admission.branchCount} branch{admission.branchCount === 1 ? "" : "es"}</small></div><ScheduleResults tenantId={admission.tenantId} state={schedule} reload={() => window.location.reload()} /></>}</section></WorkspaceShell>;
}

// Ownership: tenant-aware Next service catalog backed by typed contracts.
"use client";

import { useEffect, useRef, useState } from "react";
import type { ServiceSummary } from "@bookingapp/contracts";
import { createService, fetchServices, setServiceStatus, type ServicesState } from "../../src/services-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";

type CatalogState = { kind: "idle" | "loading" } | ServicesState;
type FormValues = { name: string; description: string; bookingMode: "appointment" | "occurrence"; durationMinutes: string; bufferBeforeMinutes: string; bufferAfterMinutes: string };
type RequestInitLike = { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string };
function request(input: string, init: RequestInitLike): Promise<Response> { return window.fetch(input, init); }
const blankForm: FormValues = { name: "", description: "", bookingMode: "appointment", durationMinutes: "30", bufferBeforeMinutes: "0", bufferAfterMinutes: "0" };

function ServiceRows({ services, tenantId, onStatus, pendingId }: { services: readonly ServiceSummary[]; tenantId: string; onStatus: (service: ServiceSummary) => void; pendingId: string | null }) {
  return <div className="service-list" role="list" aria-label="Bookable services">{services.map((service) => <article className="service-row" role="listitem" key={service.id}><div className="service-identity"><span className="service-kind" aria-hidden="true">{service.bookingMode === "occurrence" ? "O" : "A"}</span><div><strong>{service.name}</strong><small>{service.description || "No description"}</small></div></div><div className="service-meta"><span>{service.bookingMode === "occurrence" ? "Occurrence" : "Appointment"}</span><small>{service.durationMinutes} min{service.bufferBeforeMinutes + service.bufferAfterMinutes ? ` / ${service.bufferBeforeMinutes + service.bufferAfterMinutes} min buffers` : ""}</small></div><span className={`service-status service-status-${service.status}`}>{service.status}</span><div className="service-actions"><a className="account-button" href={`/app/service-composition?service=${encodeURIComponent(service.id)}&tenant=${encodeURIComponent(tenantId)}`}>Configure</a><button className="account-button" type="button" disabled={pendingId === service.id} onClick={() => onStatus(service)}>{pendingId === service.id ? "Saving..." : service.status === "active" ? "Pause" : "Activate"}</button></div></article>)}</div>;
}

function ServiceDialog({ dialogRef, values, pending, message, onChange, onSubmit, onClose }: { dialogRef: React.RefObject<HTMLDialogElement | null>; values: FormValues; pending: boolean; message: string | null; onChange: (values: FormValues) => void; onSubmit: () => void; onClose: () => void }) {
  return <dialog className="service-dialog" ref={dialogRef} aria-labelledby="service-dialog-title"><form method="dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="dialog-heading"><div><p className="eyebrow">Service catalog</p><h2 id="service-dialog-title">Add a service</h2></div><button className="dialog-close" type="button" aria-label="Close service dialog" onClick={onClose}>x</button></div><label>Name<input required value={values.name} onChange={(event) => onChange({ ...values, name: event.target.value })} /></label><label>Description <span className="field-optional">optional</span><input value={values.description} onChange={(event) => onChange({ ...values, description: event.target.value })} /></label><label>Booking mode<select value={values.bookingMode} onChange={(event) => onChange({ ...values, bookingMode: event.target.value as FormValues["bookingMode"] })}><option value="appointment">Appointment</option><option value="occurrence">Occurrence / class / trip</option></select></label><div className="service-form-grid"><label>Duration (min)<input required type="number" min="5" max="1440" step="1" value={values.durationMinutes} onChange={(event) => onChange({ ...values, durationMinutes: event.target.value })} /></label><label>Before buffer<input type="number" min="0" max="1440" step="1" value={values.bufferBeforeMinutes} onChange={(event) => onChange({ ...values, bufferBeforeMinutes: event.target.value })} /></label><label>After buffer<input type="number" min="0" max="1440" step="1" value={values.bufferAfterMinutes} onChange={(event) => onChange({ ...values, bufferAfterMinutes: event.target.value })} /></label></div>{message && <p className="service-form-message" role="status">{message}</p>}<div className="dialog-actions"><button className="account-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={pending || !values.name.trim()}>{pending ? "Saving..." : "Add service"}</button></div></form></dialog>;
}

export function ServicesPage() {
  const { admission, retry } = useWorkspaceAdmission();
  const [state, setState] = useState<CatalogState>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FormValues>(blankForm);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const load = () => { if (admission.kind !== "ready") return; setState({ kind: "loading" }); void fetchServices(request, apiBase, admission.tenantId).then(setState).catch(() => setState({ kind: "error", message: "We could not load services. Please try again." })); };
  useEffect(load, [admission]);
  function openCreate() { setValues(blankForm); setMessage(null); dialogRef.current?.showModal(); }
  async function save() {
    if (admission.kind !== "ready" || !values.name.trim()) return;
    const duration = Number(values.durationMinutes); const before = Number(values.bufferBeforeMinutes || 0); const after = Number(values.bufferAfterMinutes || 0);
    if (![duration, before, after].every((value) => Number.isInteger(value) && value >= 0) || duration < 5) return setMessage("Enter a whole-minute duration of at least 5 minutes.");
    setPending(true); setMessage(null);
    const result = await createService(request, apiBase, admission.tenantId, { name: values.name.trim(), description: values.description.trim() || null, bookingMode: values.bookingMode, durationMinutes: duration, bufferBeforeMinutes: before, bufferAfterMinutes: after });
    if (result.kind === "ready") { dialogRef.current?.close(); setMessage(`${result.service.name} was added.`); load(); } else setMessage(result.message);
    setPending(false);
  }
  async function changeStatus(service: ServiceSummary) {
    if (admission.kind !== "ready") return;
    setPendingId(service.id);
    const next = service.status === "active" ? "inactive" : "active";
    const result = await setServiceStatus(request, apiBase, admission.tenantId, service.id, next);
    if (result.kind === "ready") { setMessage(`${service.name} is now ${next}.`); load(); } else setMessage(result.message);
    setPendingId(null);
  }
  const services = state.kind === "ready" ? state.services.filter((service) => service.name.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const stateMessage = "message" in state ? state.message : "Service catalog is not ready yet.";
  const resultState = state.kind === "loading" || state.kind === "idle" ? <div className="service-loading" aria-busy="true"><span /><span /><span /></div> : !("services" in state) ? <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Service catalog unavailable</p><h2>{stateMessage}</h2><button className="account-button" type="button" onClick={load}>Try again</button></section> : services.length ? <ServiceRows services={services} tenantId={admission.kind === "ready" ? admission.tenantId : ""} onStatus={changeStatus} pendingId={pendingId} /> : <section className="schedule-empty service-empty"><p className="eyebrow">No matching services</p><h2>{query ? "Try a different search." : "Make your first service bookable."}</h2>{!query && <button className="primary-button" type="button" onClick={openCreate}>+ Add service</button>}</section>;
  return <WorkspaceShell activeHref="/app/services"><section className="workspace-content services-page"><header className="page-intro"><div><p className="eyebrow">Catalog operations</p><h1>Services</h1><p className="intro-copy">Define the appointment and occurrence work your organization delivers.</p></div>{admission.kind === "ready" && <button className="primary-button" type="button" onClick={openCreate}>+ Add service</button>}</header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for services" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to manage services" /> : <><div className="service-toolbar"><label className="service-search">Search services<input type="search" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="service-count">{services.length} service{services.length === 1 ? "" : "s"}</span><button className="account-button" type="button" onClick={retry}>Refresh</button></div>{message && <p className="service-message" role="status">{message}</p>}{resultState}<ServiceDialog dialogRef={dialogRef} values={values} pending={pending} message={message} onChange={setValues} onSubmit={() => void save()} onClose={() => dialogRef.current?.close()} /></>}</section></WorkspaceShell>;
}

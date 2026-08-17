// Ownership: tenant-aware Next resource inventory backed by typed contracts.
"use client";

import { useEffect, useRef, useState } from "react";
import type { ResourceSummary } from "@bookingapp/contracts";
import { createResource, fetchResources, setResourceStatus, type ResourcesState } from "../../src/resources-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";

type InventoryState = { kind: "idle" | "loading" } | ResourcesState;
type FormValues = { name: string; resourceType: string; capabilities: string };
type RequestInitLike = { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string };
function request(input: string, init: RequestInitLike): Promise<Response> { return window.fetch(input, init); }
const blankForm: FormValues = { name: "", resourceType: "", capabilities: "" };

function ResourceRows({ resources, onStatus, pendingId }: { resources: readonly ResourceSummary[]; onStatus: (resource: ResourceSummary) => void; pendingId: string | null }) {
  return <div className="resource-list" role="list" aria-label="Resource inventory">{resources.map((resource) => <article className="resource-row" role="listitem" key={resource.id}><div className="resource-identity"><span className="resource-kind" aria-hidden="true">{resource.resourceType.slice(0, 1).toUpperCase()}</span><div><strong>{resource.name}</strong><small>{resource.resourceType}</small></div></div><div className="resource-capabilities">{resource.capabilities?.length ? resource.capabilities.map((capability) => <span key={capability}>{capability}</span>) : <small>No capabilities assigned</small>}</div><span className={`resource-status resource-status-${resource.status}`}>{resource.status}</span><button className="account-button" type="button" disabled={pendingId === resource.id} onClick={() => onStatus(resource)}>{pendingId === resource.id ? "Saving..." : resource.status === "active" ? "Pause" : "Activate"}</button></article>)}</div>;
}

function ResourceDialog({ dialogRef, values, pending, message, onChange, onSubmit, onClose }: { dialogRef: React.RefObject<HTMLDialogElement | null>; values: FormValues; pending: boolean; message: string | null; onChange: (values: FormValues) => void; onSubmit: () => void; onClose: () => void }) {
  return <dialog className="resource-dialog" ref={dialogRef} aria-labelledby="resource-dialog-title"><form method="dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="dialog-heading"><div><p className="eyebrow">Resource inventory</p><h2 id="resource-dialog-title">Add a resource</h2></div><button className="dialog-close" type="button" aria-label="Close resource dialog" onClick={onClose}>x</button></div><label>Name<input required value={values.name} onChange={(event) => onChange({ ...values, name: event.target.value })} /></label><label>Resource type<input required placeholder="room, vehicle, chair" value={values.resourceType} onChange={(event) => onChange({ ...values, resourceType: event.target.value })} /></label><label>Capabilities <span className="field-optional">optional, comma separated</span><input placeholder="manual, sterilization" value={values.capabilities} onChange={(event) => onChange({ ...values, capabilities: event.target.value })} /></label>{message && <p className="resource-form-message" role="status">{message}</p>}<div className="dialog-actions"><button className="account-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={pending || !values.name.trim() || !values.resourceType.trim()}>{pending ? "Saving..." : "Add resource"}</button></div></form></dialog>;
}

export function ResourcesPage() {
  const { admission, retry } = useWorkspaceAdmission();
  const [state, setState] = useState<InventoryState>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [values, setValues] = useState<FormValues>(blankForm);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const load = () => { if (admission.kind !== "ready") return; setState({ kind: "loading" }); void fetchResources(request, apiBase, admission.tenantId).then(setState).catch(() => setState({ kind: "error", message: "We could not load resources. Please try again." })); };
  useEffect(load, [admission]);
  function openCreate() { setValues(blankForm); setMessage(null); dialogRef.current?.showModal(); }
  async function save() {
    if (admission.kind !== "ready" || !values.name.trim() || !values.resourceType.trim()) return;
    setPending(true); setMessage(null);
    const capabilities = values.capabilities.split(",").map((value) => value.trim()).filter(Boolean);
    const result = await createResource(request, apiBase, admission.tenantId, { name: values.name.trim(), resourceType: values.resourceType.trim(), capabilities });
    if (result.kind === "ready") { dialogRef.current?.close(); setMessage(`${result.resource.name} was added.`); load(); } else setMessage(result.message);
    setPending(false);
  }
  async function changeStatus(resource: ResourceSummary) {
    if (admission.kind !== "ready") return;
    setPendingId(resource.id);
    const next = resource.status === "active" ? "inactive" : "active";
    const result = await setResourceStatus(request, apiBase, admission.tenantId, resource.id, next);
    if (result.kind === "ready") { setMessage(`${resource.name} is now ${next}.`); load(); } else setMessage(result.message);
    setPendingId(null);
  }
  const resources = state.kind === "ready" ? state.resources.filter((resource) => `${resource.name} ${resource.resourceType}`.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const stateMessage = "message" in state ? state.message : "Resource inventory is not ready yet.";
  const resultState = state.kind === "loading" || state.kind === "idle" ? <div className="resource-loading" aria-busy="true"><span /><span /><span /></div> : !("resources" in state) ? <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Resource inventory unavailable</p><h2>{stateMessage}</h2><button className="account-button" type="button" onClick={load}>Try again</button></section> : resources.length ? <ResourceRows resources={resources} onStatus={changeStatus} pendingId={pendingId} /> : <section className="schedule-empty resource-empty"><p className="eyebrow">No matching resources</p><h2>{query ? "Try a different search." : "Add the resources your services need."}</h2>{!query && <button className="primary-button" type="button" onClick={openCreate}>+ Add resource</button>}</section>;
  return <WorkspaceShell activeHref="/app/resources"><section className="workspace-content resources-page"><header className="page-intro"><div><p className="eyebrow">Operations inventory</p><h1>Resources</h1><p className="intro-copy">Keep rooms, vehicles, equipment, and staff capabilities ready for allocation.</p></div>{admission.kind === "ready" && <button className="primary-button" type="button" onClick={openCreate}>+ Add resource</button>}</header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for resources" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to manage resources" /> : <><div className="resource-toolbar"><label className="resource-search">Search resources<input type="search" placeholder="Search by name or type" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="resource-count">{resources.length} resource{resources.length === 1 ? "" : "s"}</span><button className="account-button" type="button" onClick={retry}>Refresh</button></div>{message && <p className="resource-message" role="status">{message}</p>}{resultState}<ResourceDialog dialogRef={dialogRef} values={values} pending={pending} message={message} onChange={setValues} onSubmit={() => void save()} onClose={() => dialogRef.current?.close()} /></>}</section></WorkspaceShell>;
}

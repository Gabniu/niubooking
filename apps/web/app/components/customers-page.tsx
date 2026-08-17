// Ownership: tenant-aware Next customer profile management backed by typed contracts.
"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerProfileSummary } from "@bookingapp/contracts";
import { createCustomer, fetchCustomers, setCustomerStatus, updateCustomer, type CustomersState } from "../../src/customers-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";

type CustomerState = { kind: "idle" | "loading" } | CustomersState;
type FormValues = { displayName: string; preferredLocale: string; timezone: string };
type RequestInitLike = { credentials: "include"; method?: "POST" | "PUT"; headers?: Record<string, string>; body?: string };
function request(input: string, init: RequestInitLike): Promise<Response> { return window.fetch(input, init); }
const blankForm: FormValues = { displayName: "", preferredLocale: "", timezone: "" };

function CustomerRows({ customers, onEdit, onStatus, pendingId }: { customers: readonly CustomerProfileSummary[]; onEdit: (customer: CustomerProfileSummary) => void; onStatus: (customer: CustomerProfileSummary) => void; pendingId: string | null }) {
  return <div className="customer-list" role="list" aria-label="Customer profiles">{customers.map((customer) => <article className="customer-row" role="listitem" key={customer.id}><div className="customer-identity"><span className="customer-avatar" aria-hidden="true">{customer.displayName.slice(0, 1).toUpperCase()}</span><div><strong>{customer.displayName}</strong><small>{customer.preferredLocale ?? "Locale not set"} / {customer.timezone ?? "Timezone not set"}</small></div></div><span className={`customer-status customer-status-${customer.status}`}>{customer.status}</span><div className="customer-actions"><button className="account-button" type="button" onClick={() => onEdit(customer)}>Edit</button><button className="account-button" type="button" disabled={pendingId === customer.id} onClick={() => onStatus(customer)}>{pendingId === customer.id ? "Saving..." : customer.status === "active" ? "Archive" : "Restore"}</button></div></article>)}</div>;
}

function CustomerDialog({ dialogRef, editing, values, pending, message, onChange, onSubmit, onClose }: { dialogRef: React.RefObject<HTMLDialogElement | null>; editing: CustomerProfileSummary | null; values: FormValues; pending: boolean; message: string | null; onChange: (values: FormValues) => void; onSubmit: () => void; onClose: () => void }) {
  return <dialog className="customer-dialog" ref={dialogRef} aria-labelledby="customer-dialog-title"><form method="dialog" onSubmit={(event) => { event.preventDefault(); onSubmit(); }}><div className="dialog-heading"><div><p className="eyebrow">Customer profile</p><h2 id="customer-dialog-title">{editing ? "Edit customer" : "Add customer"}</h2></div><button className="dialog-close" type="button" aria-label="Close customer dialog" onClick={onClose}>x</button></div><label>Display name<input autoComplete="name" value={values.displayName} onChange={(event) => onChange({ ...values, displayName: event.target.value })} /></label><label>Preferred locale <span className="field-optional">optional</span><input value={values.preferredLocale} onChange={(event) => onChange({ ...values, preferredLocale: event.target.value })} /></label><label>Timezone <span className="field-optional">optional</span><input value={values.timezone} onChange={(event) => onChange({ ...values, timezone: event.target.value })} /></label>{message && <p className="customer-form-message" role="status">{message}</p>}<div className="dialog-actions"><button className="account-button" type="button" onClick={onClose}>Cancel</button><button className="primary-button" type="submit" disabled={pending || !values.displayName.trim()}>{pending ? "Saving..." : editing ? "Save changes" : "Create customer"}</button></div></form></dialog>;
}

export function CustomersPage() {
  const { admission, retry } = useWorkspaceAdmission();
  const [state, setState] = useState<CustomerState>({ kind: "idle" });
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<CustomerProfileSummary | null>(null);
  const [values, setValues] = useState<FormValues>(blankForm);
  const [pending, setPending] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDialogElement>(null);
  const load = () => {
    if (admission.kind !== "ready") return;
    setState({ kind: "loading" });
    void fetchCustomers(request, apiBase, admission.tenantId).then(setState).catch(() => setState({ kind: "error", message: "We could not load customer profiles. Please try again." }));
  };
  useEffect(load, [admission]);
  function openCreate() { setEditing(null); setValues(blankForm); setMessage(null); dialogRef.current?.showModal(); }
  function openEdit(customer: CustomerProfileSummary) { setEditing(customer); setValues({ displayName: customer.displayName, preferredLocale: customer.preferredLocale ?? "", timezone: customer.timezone ?? "" }); setMessage(null); dialogRef.current?.showModal(); }
  async function save() {
    if (admission.kind !== "ready" || !values.displayName.trim()) return;
    setPending(true); setMessage(null);
    const result = editing ? await updateCustomer(request, apiBase, admission.tenantId, editing.id, values.displayName.trim(), values.preferredLocale.trim() || null, values.timezone.trim() || null) : await createCustomer(request, apiBase, admission.tenantId, values.displayName.trim(), values.preferredLocale.trim() || null, values.timezone.trim() || null);
    if (result.kind === "ready") { dialogRef.current?.close(); setMessage(editing ? "Customer profile updated." : "Customer profile created."); load(); } else setMessage(result.message);
    setPending(false);
  }
  async function changeStatus(customer: CustomerProfileSummary) {
    if (admission.kind !== "ready") return;
    setPendingId(customer.id);
    const result = await setCustomerStatus(request, apiBase, admission.tenantId, customer.id, customer.status === "active" ? "archived" : "active");
    if (result.kind === "ready") { setMessage(customer.status === "active" ? "Customer archived." : "Customer restored."); load(); } else setMessage(result.message);
    setPendingId(null);
  }
  const customers = state.kind === "ready" ? state.customers.filter((customer) => customer.displayName.toLowerCase().includes(query.trim().toLowerCase())) : [];
  const stateMessage = "message" in state ? state.message : "Customer records are not ready yet.";
  const resultState = state.kind === "loading" || state.kind === "idle" ? <div className="customer-loading" aria-busy="true"><span /><span /><span /></div> : !("customers" in state) ? <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Customer records unavailable</p><h2>{stateMessage}</h2><button className="account-button" type="button" onClick={load}>Try again</button></section> : customers.length ? <CustomerRows customers={customers} onEdit={openEdit} onStatus={changeStatus} pendingId={pendingId} /> : <section className="schedule-empty customer-empty"><div className="schedule-empty-icon" aria-hidden="true"><svg viewBox="0 0 24 24"><path d="M16 20v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-3 4v1m6-9a4 4 0 1 0-8 0 4 4 0 0 0 8 0Zm7-2a3 3 0 1 0 0-6m4 17v-1a4 4 0 0 0-3-3.87" /></svg></div><p className="eyebrow">No matching profiles</p><h2>{query ? "Try a different search." : "Create your first customer profile."}</h2>{!query && <button className="primary-button" type="button" onClick={openCreate}>+ Add customer</button>}</section>;
  return <WorkspaceShell activeHref="/app/customers"><section className="workspace-content customers-page"><header className="page-intro"><div><p className="eyebrow">Customer records</p><h1>Customers</h1><p className="intro-copy">Keep the people behind every reservation easy to find and maintain.</p></div>{admission.kind === "ready" && <button className="primary-button" type="button" onClick={openCreate}>+ Add customer</button>}</header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for customer records" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to manage customers" /> : <><div className="customer-toolbar"><label className="customer-search">Search customer profiles<input type="search" placeholder="Search by name" value={query} onChange={(event) => setQuery(event.target.value)} /></label><span className="customer-count">{customers.length} profile{customers.length === 1 ? "" : "s"}</span><button className="account-button" type="button" onClick={retry}>Refresh</button></div>{message && <p className="customer-message" role="status">{message}</p>}{resultState}<CustomerDialog dialogRef={dialogRef} editing={editing} values={values} pending={pending} message={message} onChange={setValues} onSubmit={() => void save()} onClose={() => dialogRef.current?.close()} /></>}</section></WorkspaceShell>;
}

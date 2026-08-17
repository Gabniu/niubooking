// Ownership: tenant-scoped staff appointment creation; no sample customers or resources are invented.
"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerProfileSummary } from "@bookingapp/contracts";
import type { ResourceSummary } from "@bookingapp/contracts";
import { createBooking } from "../../src/bookings-client.js";
import { fetchCustomers } from "../../src/customers-client.js";
import { fetchResources } from "../../src/resources-client.js";
import { apiBase } from "./workspace-admission.js";

type RequestInitLike = { credentials: "include"; method?: "POST" | "PUT"; headers?: Record<string, string>; body?: string };
const request = (input: string, init: RequestInitLike) => window.fetch(input, init);

export function BookingCreateDialog({ tenantId, onCreated }: { tenantId: string; onCreated: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [customers, setCustomers] = useState<readonly CustomerProfileSummary[]>([]);
  const [resources, setResources] = useState<readonly ResourceSummary[]>([]);
  const [values, setValues] = useState({ customerId: "", serviceName: "", startsAt: "", endsAt: "", resourceIds: [] as string[] });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  useEffect(() => { if (!tenantId) return; void Promise.all([fetchCustomers(request, apiBase, tenantId), fetchResources(request, apiBase, tenantId)]).then(([customerState, resourceState]) => { if (customerState.kind === "ready") setCustomers(customerState.customers.filter((customer) => customer.status === "active")); if (resourceState.kind === "ready") setResources(resourceState.resources.filter((resource) => resource.status === "active")); }).catch(() => setMessage("Customer and resource options could not be loaded.")); }, [tenantId]);
  function open() { setMessage(null); setValues({ customerId: "", serviceName: "", startsAt: "", endsAt: "", resourceIds: [] }); dialogRef.current?.showModal(); }
  async function save() { const starts = new Date(values.startsAt); const ends = new Date(values.endsAt); if (!values.customerId || !values.serviceName.trim() || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts) return setMessage("Choose a customer, service, and an end time after the start time."); setPending(true); setMessage(null); const result = await createBooking(request, apiBase, tenantId, { customerId: values.customerId, serviceName: values.serviceName.trim(), startsAt: starts.toISOString(), endsAt: ends.toISOString(), resourceIds: values.resourceIds }); if (result.kind === "ready") { dialogRef.current?.close(); onCreated(); } else setMessage(result.message); setPending(false); }
  return <><button className="primary-button" type="button" onClick={open}>+ New appointment</button><dialog className="booking-dialog" ref={dialogRef} aria-labelledby="booking-dialog-title"><form method="dialog" onSubmit={(event) => { event.preventDefault(); void save(); }}><div className="booking-dialog-heading"><div><p className="eyebrow">Appointment operations</p><h2 id="booking-dialog-title">New appointment</h2></div><button className="dialog-close" type="button" aria-label="Close appointment dialog" onClick={() => dialogRef.current?.close()}>x</button></div><label>Customer<select required value={values.customerId} onChange={(event) => setValues({ ...values, customerId: event.target.value })}><option value="">Choose a customer</option>{customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}</select></label><label>Service<input required placeholder="Consultation" value={values.serviceName} onChange={(event) => setValues({ ...values, serviceName: event.target.value })} /></label><div className="booking-dialog-grid"><label>Starts<input required type="datetime-local" value={values.startsAt} onChange={(event) => setValues({ ...values, startsAt: event.target.value })} /></label><label>Ends<input required type="datetime-local" value={values.endsAt} onChange={(event) => setValues({ ...values, endsAt: event.target.value })} /></label></div><label>Resources <span className="field-optional">optional</span><select multiple value={values.resourceIds} onChange={(event) => setValues({ ...values, resourceIds: [...event.target.selectedOptions].map((option) => option.value) })}>{resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.resourceType}</option>)}</select></label>{message && <p className="booking-dialog-message" role="status">{message}</p>}<div className="booking-dialog-actions"><button className="account-button" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button><button className="primary-button" type="submit" disabled={pending}>{pending ? "Creating..." : "Create appointment"}</button></div></form></dialog></>;
}

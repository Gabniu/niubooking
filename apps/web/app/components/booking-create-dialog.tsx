// Ownership: tenant-scoped staff appointment creation; no sample customers or resources are invented.
"use client";

import { useEffect, useRef, useState } from "react";
import type { CustomerProfileSummary, ResourceSummary } from "@bookingapp/contracts";
import { createBooking } from "../../src/bookings-client.js";
import { fetchCustomers } from "../../src/customers-client.js";
import { fetchResources } from "../../src/resources-client.js";
import { apiBase } from "./workspace-admission.js";

type RequestInitLike = {
  credentials: "include";
  method?: "POST" | "PUT";
  headers?: Record<string, string>;
  body?: string;
};
type OptionState = "loading" | "ready" | "error";
const request = (input: string, init: RequestInitLike) => window.fetch(input, init);

export function BookingCreateDialog({ tenantId, onCreated, openRequest = 0 }: { tenantId: string; onCreated: () => void; openRequest?: number }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousOpenRequest = useRef(openRequest);
  const [customers, setCustomers] = useState<readonly CustomerProfileSummary[]>([]);
  const [resources, setResources] = useState<readonly ResourceSummary[]>([]);
  const [optionState, setOptionState] = useState<OptionState>("loading");
  const [optionMessage, setOptionMessage] = useState<string | null>(null);
  const [values, setValues] = useState({ customerId: "", serviceName: "", startsAt: "", endsAt: "", resourceIds: [] as string[] });
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!tenantId) return;
    setOptionState("loading");
    setOptionMessage(null);
    void Promise.all([
      fetchCustomers(request, apiBase, tenantId),
      fetchResources(request, apiBase, tenantId),
    ]).then(([customerState, resourceState]) => {
      if (customerState.kind === "ready") {
        setCustomers(customerState.customers.filter((customer) => customer.status === "active"));
      }
      if (resourceState.kind === "ready") {
        setResources(resourceState.resources.filter((resource) => resource.status === "active"));
      }
      const customerError = customerState.kind !== "ready" ? customerState.message : null;
      const resourceError = resourceState.kind !== "ready" ? resourceState.message : null;
      setOptionState(customerError ? "error" : "ready");
      setOptionMessage(
        customerError ??
          (resourceError
            ? "Resources are unavailable right now. You can still create the appointment without assigning one."
            : null),
      );
    }).catch(() => {
      setOptionState("error");
      setOptionMessage("Customer options could not be loaded. Please try again.");
    });
  }, [tenantId]);

  useEffect(() => {
    if (openRequest > previousOpenRequest.current) open();
    previousOpenRequest.current = openRequest;
  }, [openRequest]);

  function open() {
    setMessage(null);
    setOptionMessage(null);
    setValues({ customerId: "", serviceName: "", startsAt: "", endsAt: "", resourceIds: [] });
    dialogRef.current?.showModal();
  }

  async function save() {
    if (pending) return;
    const starts = new Date(values.startsAt);
    const ends = new Date(values.endsAt);
    if (
      !values.customerId ||
      !values.serviceName.trim() ||
      Number.isNaN(starts.getTime()) ||
      Number.isNaN(ends.getTime()) ||
      ends <= starts
    ) {
      setMessage("Choose a customer, service, and an end time after the start time.");
      return;
    }
    setPending(true);
    setMessage(null);
    try {
      const result = await createBooking(request, apiBase, tenantId, {
        customerId: values.customerId,
        serviceName: values.serviceName.trim(),
        startsAt: starts.toISOString(),
        endsAt: ends.toISOString(),
        resourceIds: values.resourceIds,
      });
      if (result.kind === "ready") {
        dialogRef.current?.close();
        onCreated();
      } else {
        setMessage(result.message);
      }
    } catch { setMessage("Appointment could not be created. Please try again."); } finally { setPending(false); }
  }

  const customerSelectDisabled = pending || optionState !== "ready";
  const canSubmit = !pending && optionState === "ready" && customers.length > 0;
  const customerOptionLabel = optionState === "loading"
    ? "Loading customers..."
    : customers.length > 0
      ? "Choose a customer"
      : "No active customers yet";

  return (
    <>
      <button className="primary-button" type="button" onClick={open}>+ New appointment</button>
      <dialog className="booking-dialog" ref={dialogRef} aria-labelledby="booking-dialog-title">
        <form
          method="dialog"
          aria-busy={optionState === "loading" || pending}
          onSubmit={(event) => { event.preventDefault(); void save(); }}
        >
          <div className="booking-dialog-heading">
            <div><p className="eyebrow">Appointment operations</p><h2 id="booking-dialog-title">New appointment</h2></div>
            <button className="dialog-close" type="button" aria-label="Close appointment dialog" onClick={() => dialogRef.current?.close()}>x</button>
          </div>
          {optionMessage && <p className={`booking-dialog-message${optionState === "error" ? " booking-dialog-error" : ""}`} role="status" aria-live="polite">{optionMessage}</p>}
          <label>Customer
            <select required disabled={customerSelectDisabled} value={values.customerId} onChange={(event) => setValues({ ...values, customerId: event.target.value })}>
              <option value="">{customerOptionLabel}</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.displayName}</option>)}
            </select>
          </label>
          {optionState === "ready" && customers.length === 0 && <p className="booking-dialog-help">Create an active customer profile before adding an appointment.</p>}
          <label>Service
            <input required placeholder="Consultation" value={values.serviceName} disabled={pending} onChange={(event) => setValues({ ...values, serviceName: event.target.value })} />
          </label>
          <div className="booking-dialog-grid">
            <label>Starts<input required type="datetime-local" value={values.startsAt} disabled={pending} onChange={(event) => setValues({ ...values, startsAt: event.target.value })} /></label>
            <label>Ends<input required type="datetime-local" value={values.endsAt} disabled={pending} onChange={(event) => setValues({ ...values, endsAt: event.target.value })} /></label>
          </div>
          <label>Resources <span className="field-optional">optional</span>
            <select multiple disabled={pending || optionState === "loading"} value={values.resourceIds} onChange={(event) => setValues({ ...values, resourceIds: [...event.target.selectedOptions].map((option) => option.value) })}>
              {resources.length === 0 && <option disabled>No active resources</option>}
              {resources.map((resource) => <option key={resource.id} value={resource.id}>{resource.name} · {resource.resourceType}</option>)}
            </select>
          </label>
          {message && <p className="booking-dialog-message booking-dialog-error" role="alert" aria-live="assertive">{message}</p>}
          <div className="booking-dialog-actions">
            <button className="account-button" type="button" onClick={() => dialogRef.current?.close()}>Cancel</button>
            <button className="primary-button" type="submit" disabled={!canSubmit}>{pending ? "Creating..." : "Create appointment"}</button>
          </div>
        </form>
      </dialog>
    </>
  );
}

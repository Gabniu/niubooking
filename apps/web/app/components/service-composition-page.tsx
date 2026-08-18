// Ownership: tenant-scoped service variants, requirement slots, and advisory candidates.
"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import type { ServiceRequirement, ServiceVariant } from "@bookingapp/domain";
import {
  createRequirement,
  createVariant,
  fetchRequirements,
  fetchVariants,
  setRequirementStatus,
  setVariantStatus,
} from "../../src/service-composition-client.js";
import { fetchRequirementAvailability } from "../../src/requirement-availability-client.js";
import { AdmissionNotice, apiBase, useWorkspaceAdmission, WorkspacePicker } from "./workspace-admission.js";
import { WorkspaceShell } from "./workspace-shell.js";

type RequestInitLike = { credentials: "include"; method?: "POST"; headers?: Record<string, string>; body?: string };
type DataState<T> = { kind: "idle" | "loading" } | { kind: "ready"; data: T } | { kind: "denied" | "error"; message: string };
const request = (input: string, init: RequestInitLike) => window.fetch(input, init);

export function ServiceCompositionPage() {
  const { admission, retry } = useWorkspaceAdmission();
  const serviceId = useMemo(() => typeof window === "undefined" ? "" : new URLSearchParams(window.location.search).get("service")?.trim() ?? "", []);
  const [variants, setVariants] = useState<DataState<readonly ServiceVariant[]>>({ kind: "idle" });
  const [requirements, setRequirements] = useState<DataState<readonly ServiceRequirement[]>>({ kind: "idle" });
  const [selectedVariantId, setSelectedVariantId] = useState("");
  const [availability, setAvailability] = useState<DataState<{ slots: readonly { startsAt: string; endsAt: string; assignments: readonly { resourceIds: readonly string[]; requirementLabel?: string }[] }[]; rejected: readonly { requirementId: string; reason: string }[] }>>({ kind: "idle" });
  const [message, setMessage] = useState<string | null>(null);
  const [variant, setVariant] = useState({ name: "", durationMinutes: "" });
  const [requirement, setRequirement] = useState({ label: "", quantity: "1", resourceType: "", capabilityKey: "" });
  const [windowForm, setWindowForm] = useState({ from: "", to: "", durationMinutes: "30", stepMinutes: "30" });
  const variantItems = variants.kind === "ready" ? variants.data : [];
  const requirementItems = requirements.kind === "ready" ? requirements.data : [];

  const loadRequirements = (variantId = selectedVariantId) => {
    if (admission.kind !== "ready" || !serviceId) return;
    setRequirements({ kind: "loading" });
    void fetchRequirements(request, apiBase, admission.tenantId, serviceId, variantId || undefined)
      .then(setRequirements)
      .catch(() => setRequirements({ kind: "error", message: "Requirements could not be loaded." }));
  };

  const load = () => {
    if (admission.kind !== "ready" || !serviceId) return;
    setVariants({ kind: "loading" });
    void fetchVariants(request, apiBase, admission.tenantId, serviceId)
      .then((result) => {
        setVariants(result);
        if (result.kind === "ready") {
          const id = result.data[0]?.id ?? "";
          setSelectedVariantId(id);
          loadRequirements(id);
        }
      })
      .catch(() => setVariants({ kind: "error", message: "Variants could not be loaded." }));
  };

  useEffect(load, [admission, serviceId]);

  function saveVariant(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admission.kind !== "ready" || !serviceId) return;
    if (!variant.name.trim()) return setMessage("Enter a variant name.");
    const duration = variant.durationMinutes.trim() ? Number(variant.durationMinutes) : null;
    if (duration !== null && (!Number.isInteger(duration) || duration < 5 || duration > 1440)) {
      return setMessage("Duration must be a whole number from 5 to 1,440 minutes.");
    }
    void createVariant(request, apiBase, admission.tenantId, serviceId, { name: variant.name.trim(), durationMinutes: duration })
      .then((result) => {
        if (result.kind !== "ready") return setMessage(result.message);
        setVariant({ name: "", durationMinutes: "" });
        setMessage(`${result.data.name} was added.`);
        load();
      });
  }

  function saveRequirement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admission.kind !== "ready" || !serviceId) return;
    const quantity = Number(requirement.quantity);
    if (!requirement.label.trim() || (!requirement.resourceType.trim() && !requirement.capabilityKey.trim())) {
      return setMessage("Add a label and a resource type or capability.");
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 16) {
      return setMessage("Quantity must be a whole number from 1 to 16.");
    }
    void createRequirement(request, apiBase, admission.tenantId, serviceId, {
      variantId: selectedVariantId || null,
      kind: "resource",
      label: requirement.label.trim(),
      quantity,
      resourceType: requirement.resourceType.trim() || null,
      capabilityKey: requirement.capabilityKey.trim() || null,
    }).then((result) => {
      if (result.kind !== "ready") return setMessage(result.message);
      setRequirement({ label: "", quantity: "1", resourceType: "", capabilityKey: "" });
      setMessage(`${result.data.label} requirement was added.`);
      loadRequirements();
    });
  }

  function toggleRequirement(item: ServiceRequirement) {
    if (admission.kind !== "ready") return;
    const nextStatus = item.status === "active" ? "inactive" : "active";
    void setRequirementStatus(request, apiBase, admission.tenantId, item.id, nextStatus)
      .then((result) => {
        if (result.kind !== "ready") return setMessage(result.message);
        setMessage(`${item.label} status updated.`);
        loadRequirements();
      });
  }

  function checkAvailability(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (admission.kind !== "ready" || !serviceId) return;
    const from = new Date(windowForm.from);
    const to = new Date(windowForm.to);
    const duration = Number(windowForm.durationMinutes);
    const step = Number(windowForm.stepMinutes);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to <= from || !Number.isInteger(duration) || duration < 5 || !Number.isInteger(step) || step < 5) {
      return setMessage("Choose a valid time window and whole-minute settings.");
    }
    setAvailability({ kind: "loading" });
    void fetchRequirementAvailability(request, apiBase, admission.tenantId, serviceId, {
      from: from.toISOString(),
      to: to.toISOString(),
      durationMinutes: duration,
      stepMinutes: step,
      variantId: selectedVariantId || null,
    }).then(setAvailability).catch(() => setAvailability({ kind: "error", message: "Candidate times could not be loaded." }));
  }

  const stateMessage = (state: DataState<unknown>) => state.kind === "denied" || state.kind === "error" ? state.message : "Not ready yet.";

  return <WorkspaceShell activeHref="/app/services"><section className="workspace-content composition-page"><header className="page-intro"><div><p className="eyebrow">Service setup</p><h1>Service setup</h1><p className="intro-copy">Define service options, required resources, and candidate times before confirming a booking.</p></div><div className="composition-header-actions"><a className="account-button" href="/app/services">Back to services</a><button className="account-button" type="button" onClick={retry}>Refresh</button></div></header>{admission.kind === "selecting" ? <WorkspacePicker workspaces={admission.workspaces} title="Choose a workspace for service setup" /> : admission.kind !== "ready" ? <AdmissionNotice state={admission} title="Choose a workspace to configure this service" /> : !serviceId ? <section className="schedule-empty schedule-empty-inline"><p className="eyebrow">Service required</p><h2>Choose a service from the catalog first.</h2><p>Open a service, then return here to configure its options and resource needs.</p><a className="primary-button" href="/app/services">Open services</a></section> : <>{message && <p className="composition-message" role="status">{message}</p>}<div className="composition-grid"><article className="composition-card"><p className="eyebrow">Variants</p><h2>Offer a service differently</h2><form onSubmit={(event) => void saveVariant(event)}><label>Variant name<input required placeholder="Manual transmission" value={variant.name} onChange={(event) => setVariant({ ...variant, name: event.target.value })} /></label><label>Duration override (min)<input type="number" min="5" max="1440" placeholder="Inherit base duration" value={variant.durationMinutes} onChange={(event) => setVariant({ ...variant, durationMinutes: event.target.value })} /></label><button className="primary-button" type="submit">Add variant</button></form>{variants.kind === "loading" ? <p className="surface-message muted">Loading variants...</p> : variants.kind !== "ready" ? <p className="surface-message error">{stateMessage(variants)}</p> : <div className="composition-list">{variantItems.length ? variantItems.map((item) => <article className="composition-row" key={item.id}><div><strong>{item.name}</strong><small>{item.durationMinutes ? `${item.durationMinutes} min override` : "Inherits service duration"}</small></div><span className={`service-status service-status-${item.status}`}>{item.status}</span><button className="account-button" type="button" onClick={() => { setSelectedVariantId(item.id); loadRequirements(item.id); }}>{selectedVariantId === item.id ? "Selected" : "Use for requirements"}</button><button className="account-button" type="button" onClick={() => void setVariantStatus(request, apiBase, admission.tenantId, item.id, item.status === "active" ? "inactive" : "active").then((result) => result.kind === "ready" ? (setMessage(`${item.name} status updated.`), load()) : setMessage(result.message))}>{item.status === "active" ? "Pause" : "Activate"}</button></article>) : <p className="surface-message muted">No variants configured; the base service settings will be used.</p>}</div>}</article><article className="composition-card"><p className="eyebrow">Requirement slots</p><h2>Declare what must be assigned</h2><form onSubmit={(event) => void saveRequirement(event)}><label>Selected variant <select value={selectedVariantId} onChange={(event) => { setSelectedVariantId(event.target.value); loadRequirements(event.target.value); }}><option value="">Base service</option>{variantItems.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Requirement label<input required placeholder="Instructor" value={requirement.label} onChange={(event) => setRequirement({ ...requirement, label: event.target.value })} /></label><div className="composition-form-grid"><label>Quantity<input type="number" min="1" max="16" value={requirement.quantity} onChange={(event) => setRequirement({ ...requirement, quantity: event.target.value })} /></label><label>Resource type<input placeholder="staff / vehicle" value={requirement.resourceType} onChange={(event) => setRequirement({ ...requirement, resourceType: event.target.value })} /></label><label>Capability key<input placeholder="licence.manual" value={requirement.capabilityKey} onChange={(event) => setRequirement({ ...requirement, capabilityKey: event.target.value })} /></label></div><button className="primary-button" type="submit">Add requirement</button></form>{requirements.kind === "loading" ? <p className="surface-message muted">Loading requirements...</p> : requirements.kind !== "ready" ? <p className="surface-message error">{stateMessage(requirements)}</p> : <div className="composition-list">{requirementItems.length ? requirementItems.map((item) => <article className="composition-row" key={item.id}><div><strong>{item.quantity} x {item.label}</strong><small>{[item.resourceType, item.capabilityKey].filter(Boolean).join(" · ")}</small></div><span className={`service-status service-status-${item.status}`}>{item.status}</span><button className="account-button" type="button" onClick={() => toggleRequirement(item)}>{item.status === "active" ? "Pause" : "Activate"}</button></article>) : <p className="surface-message muted">No requirement slots configured for this service or variant.</p>}</div>}</article></div><article className="composition-card availability-card"><p className="eyebrow">Advisory scheduler</p><h2>Find candidate times</h2><p className="composition-help">Shows explainable matches only; final confirmation still checks conflicts atomically.</p><form className="availability-form" onSubmit={(event) => void checkAvailability(event)}><label>From<input type="datetime-local" required value={windowForm.from} onChange={(event) => setWindowForm({ ...windowForm, from: event.target.value })} /></label><label>To<input type="datetime-local" required value={windowForm.to} onChange={(event) => setWindowForm({ ...windowForm, to: event.target.value })} /></label><label>Duration (min)<input type="number" min="5" value={windowForm.durationMinutes} onChange={(event) => setWindowForm({ ...windowForm, durationMinutes: event.target.value })} /></label><label>Step (min)<input type="number" min="5" value={windowForm.stepMinutes} onChange={(event) => setWindowForm({ ...windowForm, stepMinutes: event.target.value })} /></label><button className="primary-button" type="submit">Check candidate times</button></form>{availability.kind === "loading" ? <p className="surface-message muted">Checking requirement matches...</p> : availability.kind === "ready" ? availability.data.slots.length ? <div className="availability-result">{availability.data.slots.slice(0, 12).map((slot) => <div key={slot.startsAt}><strong>{new Date(slot.startsAt).toLocaleString()}</strong><small>{slot.assignments.flatMap((assignment) => assignment.resourceIds).join(", ") || "Complete match"}</small></div>)}</div> : <p className="surface-message muted">{availability.data.rejected.length ? availability.data.rejected.map((item) => `${item.requirementId}: ${item.reason}`).join(" · ") : "No complete requirement matches in this window."}</p> : availability.kind === "denied" || availability.kind === "error" ? <p className="surface-message error">{availability.message}</p> : <p className="surface-message muted">Select a window to inspect requirement matches.</p>}</article></>}</section></WorkspaceShell>;
}

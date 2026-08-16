// Ownership: compact tenant schedule surface backed by the booking API.

import type { BookingSummary } from "@bookingapp/contracts";
import { createBooking, fetchBookings, setBookingStatus } from "./bookings-client.js";
import { fetchCustomers } from "./customers-client.js";
import { fetchResources } from "./resources-client.js";

const root = document.querySelector<HTMLElement>("[data-bookings-page]");
const form = document.querySelector<HTMLFormElement>("#booking-form");
const status = document.querySelector<HTMLElement>("#booking-status");
const list = document.querySelector<HTMLElement>("#booking-list");
const refresh = document.querySelector<HTMLButtonElement>("#refresh-bookings");
const customer = document.querySelector<HTMLSelectElement>("#booking-customer");
const resources = document.querySelector<HTMLSelectElement>("#booking-resources");
if (!root || !form || !status || !list || !refresh || !customer || !resources) throw new Error("Booking workspace controls are incomplete");
const statusElement = status;
const listElement = list;
const refreshElement = refresh;
const customerElement = customer;
const resourcesElement = resources;
const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
function show(kind: string, text: string): void { statusElement.dataset.state = kind; statusElement.textContent = text; statusElement.hidden = false; }
function dateLabel(value: string): string { const date = new Date(value); return Number.isNaN(date.getTime()) ? "Invalid time" : date.toLocaleString([], { dateStyle: "medium", timeStyle: "short" }); }
function render(bookings: readonly BookingSummary[]): void {
  listElement.replaceChildren();
  if (!bookings.length) { listElement.textContent = "No appointments in this workspace window."; return; }
  for (const booking of bookings) {
    const row = document.createElement("article"); row.className = "booking-row";
    const heading = document.createElement("strong"); heading.textContent = booking.serviceName;
    const meta = document.createElement("span"); meta.textContent = `${dateLabel(booking.startsAt)} · ${booking.customerId}`;
    const state = document.createElement("small"); state.textContent = booking.status;
    const actions = document.createElement("div"); actions.className = "booking-row-actions";
    if (booking.status === "scheduled") for (const next of ["completed", "cancelled"] as const) { const button = document.createElement("button"); button.type = "button"; button.className = "account-button"; button.textContent = next === "completed" ? "Complete" : "Cancel"; button.addEventListener("click", async () => { button.disabled = true; const result = await setBookingStatus(window.fetch.bind(window), apiBase, tenantId, booking.id, next); if (result.kind === "ready") { show("ready", `Appointment ${next}.`); await load(); } else show(result.kind, result.message); button.disabled = false; }); actions.append(button); }
    row.append(heading, meta, state, actions); listElement.append(row);
  }
}
async function loadCustomers(): Promise<void> { const result = await fetchCustomers(window.fetch.bind(window), apiBase, tenantId); customerElement.replaceChildren(); if (result.kind !== "ready" || !result.customers.length) { customerElement.add(new Option(result.kind === "ready" ? "Create a customer profile first" : result.message, "")); customerElement.disabled = true; return; } customerElement.add(new Option("Choose a customer", "")); for (const item of result.customers) customerElement.add(new Option(`${item.displayName} · ${item.id}`, item.id)); customerElement.disabled = false; }
async function loadResources(): Promise<void> { const result = await fetchResources(window.fetch.bind(window), apiBase, tenantId); resourcesElement.replaceChildren(); if (result.kind !== "ready") { resourcesElement.add(new Option(result.message, "")); resourcesElement.disabled = true; return; } const active = result.resources.filter((resource) => resource.status === "active"); if (!active.length) { resourcesElement.add(new Option("No active resources configured", "")); resourcesElement.disabled = true; return; } for (const resource of active) resourcesElement.add(new Option(`${resource.name} · ${resource.resourceType}`, resource.id)); resourcesElement.disabled = false; }
async function load(): Promise<void> { if (!tenantId) return show("denied", "Choose an authorized workspace before loading the schedule."); show("loading", "Loading appointments..."); const result = await fetchBookings(window.fetch.bind(window), apiBase, tenantId); if (result.kind === "ready") { render(result.bookings); show("ready", `${result.bookings.length} appointment${result.bookings.length === 1 ? "" : "s"} loaded.`); } else show(result.kind, result.message); }
form.addEventListener("submit", async (event) => { event.preventDefault(); const read = (id: string): string => document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? ""; const starts = new Date(read("booking-start")); const ends = new Date(read("booking-end")); if (!customerElement.value || !read("booking-service") || Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime())) return show("error", "Choose a customer, service, and valid times."); const result = await createBooking(window.fetch.bind(window), apiBase, tenantId, { customerId: customerElement.value, serviceName: read("booking-service"), startsAt: starts.toISOString(), endsAt: ends.toISOString(), resourceIds: [...resourcesElement.selectedOptions].map((option) => option.value).filter(Boolean) }); if (result.kind === "ready") { show("ready", "Appointment created."); form.reset(); await load(); } else show(result.kind, result.message); });
refreshElement.addEventListener("click", () => { void load(); });
if (tenantId) { void Promise.all([loadCustomers(), loadResources(), load()]); } else show("denied", "Choose an authorized workspace before loading the schedule.");

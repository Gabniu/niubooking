// Ownership: compact occurrence workspace with staff reservation controls.

import { createOccurrence, fetchOccurrences, fetchReservations, updateReservationStatus } from "./occurrences-client.js";
import type { ReservationSummary } from "@bookingapp/contracts";

const root = document.querySelector<HTMLElement>("[data-occurrences-page]");
const form = document.querySelector<HTMLFormElement>("#occurrence-form");
const status = document.querySelector<HTMLElement>("#occurrence-status");
const list = document.querySelector<HTMLElement>("#occurrence-list");
const refresh = document.querySelector<HTMLButtonElement>("#refresh-occurrences");
if (!root || !form || !status || !list || !refresh) throw new Error("Occurrence workspace controls are incomplete");
const statusElement = status;
const listElement = list;
const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
const reservationStatuses: ReservationSummary["status"][] = ["held", "confirmed", "checked_in", "completed", "cancelled", "no_show"];

function show(kind: string, message: string): void { statusElement.dataset.state = kind; statusElement.textContent = message; statusElement.hidden = false; }
function text(tag: string, value: string, className?: string): HTMLElement { const element = document.createElement(tag); element.textContent = value; if (className) element.className = className; return element; }
function reservationRow(reservation: ReservationSummary, occurrenceId: string): HTMLElement {
  const row = document.createElement("div"); row.className = "reservation-row";
  row.append(text("span", reservation.customerId, "reservation-customer"), text("span", `×${reservation.quantity}`, "reservation-quantity"));
  const select = document.createElement("select"); select.className = "reservation-status"; select.setAttribute("aria-label", `Status for ${reservation.customerId}`);
  for (const value of reservationStatuses) { const option = new Option(value.replace("_", " "), value, value === reservation.status, value === reservation.status); select.add(option); }
  select.addEventListener("change", async () => { select.disabled = true; const result = await updateReservationStatus(window.fetch.bind(window), apiBase, tenantId, occurrenceId, reservation.id, select.value as ReservationSummary["status"]); select.disabled = false; if (result.kind === "error") { select.value = reservation.status; show("error", result.message); } else { reservation.status = result.reservation.status; show("ready", "Reservation status updated."); } });
  row.append(select); return row;
}
async function loadReservations(occurrenceId: string, target: HTMLElement): Promise<void> {
  target.textContent = "Loading reservations…";
  const result = await fetchReservations(window.fetch.bind(window), apiBase, tenantId, occurrenceId);
  if (result.kind === "error") { target.textContent = result.message; return; }
  target.replaceChildren(...result.reservations.length ? result.reservations.map((reservation) => reservationRow(reservation, occurrenceId)) : [text("small", "No reservations yet.")]);
}
function render(occurrences: readonly { id: string; label: string; serviceId: string; startsAt: string; endsAt: string; status: string; capacity: number | null; reservedQuantity: number }[]): void {
  listElement.replaceChildren(); if (!occurrences.length) { listElement.textContent = "No service occurrences are scheduled for this workspace."; return; }
  for (const occurrence of occurrences) {
    const row = document.createElement("article"); row.className = "occurrence-row";
    row.append(text("strong", occurrence.label), text("span", `${new Date(occurrence.startsAt).toLocaleString()} – ${new Date(occurrence.endsAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}`), text("small", `${occurrence.serviceId} · ${occurrence.capacity === null ? "Unlimited" : `${occurrence.reservedQuantity}/${occurrence.capacity} reserved`} · ${occurrence.status}`));
    const toggle = document.createElement("button"); toggle.type = "button"; toggle.className = "account-button occurrence-reservations-toggle"; toggle.textContent = "Show reservations";
    const reservations = document.createElement("div"); reservations.className = "occurrence-reservations"; reservations.hidden = true;
    toggle.addEventListener("click", async () => { reservations.hidden = !reservations.hidden; toggle.textContent = reservations.hidden ? "Show reservations" : "Hide reservations"; if (!reservations.hidden && !reservations.dataset.loaded) { await loadReservations(occurrence.id, reservations); reservations.dataset.loaded = "true"; } });
    row.append(toggle, reservations); listElement.append(row);
  }
}
async function load(): Promise<void> {
  if (!tenantId) return show("denied", "Choose an authorized workspace before managing occurrences.");
  show("loading", "Loading occurrences…");
  try { const result = await fetchOccurrences(window.fetch.bind(window), apiBase, tenantId); if (result.kind === "ready") { render(result.occurrences); show("ready", `${result.occurrences.length} occurrence${result.occurrences.length === 1 ? "" : "s"} loaded.`); } else show(result.kind, result.message); }
  catch { show("error", "Occurrences could not be loaded. Check your connection and try again."); }
}
form.addEventListener("submit", async (event) => {
  event.preventDefault(); const serviceId = document.querySelector<HTMLInputElement>("#occurrence-service")?.value.trim() ?? ""; const label = document.querySelector<HTMLInputElement>("#occurrence-label")?.value.trim() ?? ""; const startsAt = document.querySelector<HTMLInputElement>("#occurrence-start")?.value ?? ""; const endsAt = document.querySelector<HTMLInputElement>("#occurrence-end")?.value ?? ""; const rawCapacity = document.querySelector<HTMLInputElement>("#occurrence-capacity")?.value ?? "";
  if (!serviceId || !label || !startsAt || !endsAt) return show("error", "Service, label, start, and end are required.");
  const result = await createOccurrence(window.fetch.bind(window), apiBase, tenantId, { serviceId, label, startsAt: new Date(startsAt).toISOString(), endsAt: new Date(endsAt).toISOString(), capacity: rawCapacity ? Number(rawCapacity) : null });
  if (result.kind === "ready") { form.reset(); show("ready", `${result.occurrence.label} was added.`); await load(); } else show("error", result.message);
});
refresh.addEventListener("click", () => { void load(); });
void load();

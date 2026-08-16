// Ownership: public reschedule/cancel conversation backed by an opaque capability.

import { cancelManagedBooking, fetchManagedBooking, rescheduleManagedBooking } from "./guest-booking-client.js";

const root = document.querySelector<HTMLElement>("[data-manage-booking]");
const summary = document.querySelector<HTMLElement>("#manage-summary");
const status = document.querySelector<HTMLElement>("#manage-status");
const form = document.querySelector<HTMLFormElement>("#manage-form");
const cancel = document.querySelector<HTMLButtonElement>("#manage-cancel");
if (!root || !summary || !status || !form || !cancel) throw new Error("Manage booking controls are incomplete");
const apiBase = root.dataset.apiBase || "";
const token = new URLSearchParams(location.search).get("token") || "";
const summaryElement = summary;
const statusElement = status;
const formElement = form;
function show(kind: string, message: string): void { statusElement.dataset.state = kind; statusElement.textContent = message; statusElement.hidden = false; }
function localInput(iso: string): string { const date = new Date(iso); return new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); }
function read(id: string): string { return document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? ""; }
function setBooking(booking: { serviceName: string; startsAt: string; endsAt: string; status: string }): void { summaryElement.textContent = `${booking.serviceName} · ${new Date(booking.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })} - ${new Date(booking.endsAt).toLocaleTimeString([], { timeStyle: "short" })} · ${booking.status}`; const starts = document.querySelector<HTMLInputElement>("#manage-start"); const ends = document.querySelector<HTMLInputElement>("#manage-end"); if (starts && ends) { starts.value = localInput(booking.startsAt); ends.value = localInput(booking.endsAt); } }
async function load(): Promise<void> { if (!token) return show("error", "This manage link is missing its token."); const result = await fetchManagedBooking(window.fetch.bind(window), apiBase, token); if (result.kind !== "ready") return show(result.kind, result.message); setBooking(result.value); formElement.hidden = result.value.status !== "scheduled"; if (result.value.status !== "scheduled") show("ready", `This appointment is already ${result.value.status}.`); }
formElement.addEventListener("submit", async (event) => { event.preventDefault(); const starts = new Date(read("manage-start")); const ends = new Date(read("manage-end")); if (Number.isNaN(starts.getTime()) || Number.isNaN(ends.getTime()) || ends <= starts || starts <= new Date()) return show("error", "Choose a future ordered time."); show("loading", "Rescheduling your appointment..."); const result = await rescheduleManagedBooking(window.fetch.bind(window), apiBase, token, { startsAt: starts.toISOString(), endsAt: ends.toISOString(), idempotencyKey: crypto.randomUUID() }); if (result.kind === "ready") { setBooking(result.value); show("ready", "Your appointment has been rescheduled."); } else show(result.kind, result.message); });
cancel.addEventListener("click", async () => { if (!window.confirm("Cancel this appointment?")) return; cancel.disabled = true; show("loading", "Cancelling your appointment..."); const result = await cancelManagedBooking(window.fetch.bind(window), apiBase, token, crypto.randomUUID()); if (result.kind === "ready") { setBooking(result.value); formElement.hidden = true; show("ready", "Your appointment has been cancelled."); } else { cancel.disabled = false; show(result.kind, result.message); } });
void load();

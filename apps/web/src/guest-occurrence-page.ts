// Ownership: compact public occurrence reservation conversation.

import { createGuestOccurrenceReservation, fetchGuestOccurrences } from "./guest-booking-client.js";

const root = document.querySelector<HTMLElement>("[data-guest-occurrence]");
const status = document.querySelector<HTMLElement>("#guest-occurrence-status");
const form = document.querySelector<HTMLFormElement>("#guest-occurrence-form");
const select = document.querySelector<HTMLSelectElement>("#guest-occurrence-select");
if (!root || !status || !form || !select) throw new Error("Public occurrence controls are incomplete");
const formElement = form;
const selectElement = select;
const apiBase = root.dataset.apiBase || "";
const publicCode = new URLSearchParams(location.search).get("code") || "";
const read = (id: string) => document.querySelector<HTMLInputElement>(`#${id}`)?.value.trim() ?? "";
const show = (kind: string, message: string) => { status.dataset.state = kind; status.textContent = message; status.hidden = false; };
async function load(): Promise<void> {
  if (!publicCode) return show("error", "This booking link is missing its code.");
  const result = await fetchGuestOccurrences(window.fetch.bind(window), apiBase, publicCode);
  if (result.kind !== "ready") return show(result.kind, result.message);
  if (!result.value.length) return show("unavailable", "There are no published places available right now.");
  result.value.forEach((occurrence) => selectElement.add(new Option(`${occurrence.label} · ${new Date(occurrence.startsAt).toLocaleString([], { dateStyle: "medium", timeStyle: "short" })}`, occurrence.id)));
  formElement.hidden = false;
  show("ready", "Choose a time, then tell us how to recognise your reservation.");
}
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const occurrenceId = selectElement.value;
  const name = read("guest-occurrence-name");
  const quantity = Number(document.querySelector<HTMLInputElement>("#guest-occurrence-quantity")?.value ?? "1");
  const destination = read("guest-occurrence-contact");
  const channel = document.querySelector<HTMLSelectElement>("#guest-occurrence-channel")?.value as "email" | "sms" | "voice" | "";
  const consent = document.querySelector<HTMLInputElement>("#guest-occurrence-consent")?.checked === true;
  if (!occurrenceId || !name || !Number.isInteger(quantity) || quantity < 1 || (destination && (!channel || !consent))) return show("error", "Choose a time and provide a name. Contact details require reminder consent.");
  show("loading", "Confirming your place...");
  const result = await createGuestOccurrenceReservation(window.fetch.bind(window), apiBase, publicCode, occurrenceId, { customerName: name, quantity, idempotencyKey: crypto.randomUUID(), ...(destination && channel ? { contact: { channel, destination, consentGranted: true } } : {}) });
  if (result.kind !== "ready") return show(result.kind, result.message);
  formElement.hidden = true;
  show("ready", `Reserved ${result.value.quantity} place${result.value.quantity === 1 ? "" : "s"}. Your reference is ${result.value.reservationId}.`);
});
void load();

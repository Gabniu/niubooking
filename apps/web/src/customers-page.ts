// Ownership: compact tenant customer workspace with explicit loading, denied, error, empty, and success states.

import { createCustomer, fetchCustomers, setCustomerStatus, updateCustomer } from "./customers-client.js";
import type { CustomerProfileSummary } from "@bookingapp/contracts";

const root = document.querySelector<HTMLElement>("[data-customers-page]");
const status = document.querySelector<HTMLElement>("#customer-status");
const list = document.querySelector<HTMLElement>("#customer-list");
const createButton = document.querySelector<HTMLButtonElement>("#create-customer");
const refreshButton = document.querySelector<HTMLButtonElement>("#refresh-customers");
const editor = document.querySelector<HTMLFormElement>("#customer-editor");
const cancelEdit = document.querySelector<HTMLButtonElement>("#cancel-customer-edit");
if (!root || !status || !list || !createButton || !refreshButton || !editor || !cancelEdit) throw new Error("Customer workspace controls are incomplete");
const statusElement = status;
const listElement = list;
const editorElement = editor;
const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
let editingCustomerId = "";
function show(kind: string, text: string): void { statusElement.dataset.state = kind; statusElement.textContent = text; }
function render(customers: readonly CustomerProfileSummary[]): void {
  listElement.replaceChildren();
  if (!customers.length) { listElement.textContent = "No customer profiles yet."; return; }
  for (const customer of customers) { const row = document.createElement("div"); row.className = "customer-row"; row.innerHTML = `<strong>${customer.displayName}</strong><span>${customer.id}</span><small>${customer.status} · ${customer.timezone ?? "Timezone not set"}</small><div class="customer-row-actions"><button class="account-button customer-edit-button" type="button">Edit</button><button class="account-button customer-status-button" data-customer-id="${customer.id}" data-next-status="${customer.status === "active" ? "archived" : "active"}" type="button">${customer.status === "active" ? "Archive" : "Restore"}</button></div>`; row.querySelector<HTMLButtonElement>(".customer-edit-button")?.addEventListener("click", () => { editingCustomerId = customer.id; (document.querySelector<HTMLInputElement>("#editing-customer-id")!).value = customer.id; (document.querySelector<HTMLInputElement>("#edit-customer-name")!).value = customer.displayName; (document.querySelector<HTMLInputElement>("#edit-customer-locale")!).value = customer.preferredLocale ?? ""; (document.querySelector<HTMLInputElement>("#edit-customer-timezone")!).value = customer.timezone ?? ""; editorElement.hidden = false; document.querySelector<HTMLInputElement>("#edit-customer-name")?.focus(); }); row.querySelector<HTMLButtonElement>(".customer-status-button")?.addEventListener("click", async (event) => { const button = event.currentTarget as HTMLButtonElement; button.disabled = true; const result = await setCustomerStatus(window.fetch.bind(window), apiBase, tenantId, customer.id, button.dataset.nextStatus as "active" | "archived"); if (result.kind === "ready") await load(); else show(result.kind, result.message); button.disabled = false; }); listElement.append(row); }
}
async function load(): Promise<void> {
  if (!tenantId) return show("denied", "Choose an authorized workspace before loading customers.");
  show("loading", "Loading customer profiles...");
  const result = await fetchCustomers(window.fetch.bind(window), apiBase, tenantId);
  if (result.kind === "ready") { render(result.customers); show("ready", `${result.customers.length} customer profile${result.customers.length === 1 ? "" : "s"} loaded.`); } else show(result.kind, result.message);
}
createButton.addEventListener("click", async () => {
  const name = document.querySelector<HTMLInputElement>("#customer-name")?.value.trim() ?? "";
  const locale = document.querySelector<HTMLInputElement>("#customer-locale")?.value.trim() || null;
  const timezone = document.querySelector<HTMLInputElement>("#customer-timezone")?.value.trim() || null;
  if (!name) return show("error", "Enter a customer display name.");
  createButton.disabled = true;
  const result = await createCustomer(window.fetch.bind(window), apiBase, tenantId, name, locale, timezone);
  if (result.kind === "ready") { show("ready", "Customer profile created."); await load(); } else show(result.kind, result.message);
  createButton.disabled = false;
});
refreshButton.addEventListener("click", () => { void load(); });
cancelEdit.addEventListener("click", () => { editorElement.hidden = true; editingCustomerId = ""; });
editorElement.addEventListener("submit", async (event) => { event.preventDefault(); if (!editingCustomerId) return; const name = document.querySelector<HTMLInputElement>("#edit-customer-name")?.value.trim() ?? ""; const locale = document.querySelector<HTMLInputElement>("#edit-customer-locale")?.value.trim() || null; const timezone = document.querySelector<HTMLInputElement>("#edit-customer-timezone")?.value.trim() || null; if (!name) return show("error", "Enter a customer display name."); const result = await updateCustomer(window.fetch.bind(window), apiBase, tenantId, editingCustomerId, name, locale, timezone); if (result.kind === "ready") { editorElement.hidden = true; editingCustomerId = ""; show("ready", "Customer profile updated."); await load(); } else show(result.kind, result.message); });
void load();

// Ownership: authorized QR lifecycle and print-safe studio interactions.

import type { QrDestinationSummary } from "@bookingapp/contracts";
import { createQrDestination, fetchQrDestinations, setQrDestinationStatus } from "./qr-admin-client.js";
import { createPrintPreview, type PrintSpec } from "./qr-print-studio.js";
import { generateBrowserPrintQrSvg } from "./qr-svg-browser.js";

function required<T extends Element>(query: string): T { const element = document.querySelector<T>(query); if (!element) throw new Error(`QR Studio control missing: ${query}`); return element; }
const root = required<HTMLElement>("[data-qr-studio]"); const form = required<HTMLFormElement>("#qr-create-form"); const selector = required<HTMLSelectElement>("#qr-destination"); const status = required<HTMLElement>("#qr-studio-status"); const preview = required<HTMLElement>("#qr-preview"); const previewTitle = required<HTMLElement>("#qr-preview-title"); const diagnostics = required<HTMLElement>("#qr-diagnostics"); const lifecycle = required<HTMLSelectElement>("#qr-lifecycle"); const printButton = required<HTMLButtonElement>("#qr-print"); const downloadButton = required<HTMLButtonElement>("#qr-download");
const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
const bookingBase = root.dataset.bookingBase || "";
const destinations = new Map<string, QrDestinationSummary>();
let currentSvg = "";

function show(kind: string, message: string): void { status.dataset.state = kind; status.textContent = message; status.hidden = false; }
function selected(): QrDestinationSummary | null { return destinations.get(selector.value) ?? null; }
function spec(): PrintSpec { return { template: (document.querySelector<HTMLSelectElement>("#qr-template")?.value ?? "a5-flyer") as PrintSpec["template"], variant: (document.querySelector<HTMLSelectElement>("#qr-variant")?.value ?? "hero") as PrintSpec["variant"], headline: document.querySelector<HTMLInputElement>("#qr-headline")?.value ?? "", callToAction: document.querySelector<HTMLInputElement>("#qr-cta")?.value ?? "", businessLabel: document.querySelector<HTMLInputElement>("#qr-business")?.value ?? "", accent: document.querySelector<HTMLInputElement>("#qr-accent")?.value ?? "#10B981", logoUrl: null }; }
async function render(): Promise<void> {
  const destination = selected();
  if (!destination) { previewTitle.textContent = "No destination selected"; preview.replaceChildren(document.createTextNode("Select an authorized QR destination to preview it.")); diagnostics.textContent = "Print safety checks appear after selection."; lifecycle.disabled = true; printButton.disabled = true; downloadButton.disabled = true; return; }
  lifecycle.disabled = destination.status === "expired" || destination.status === "revoked"; lifecycle.value = destination.status === "expired" ? "revoked" : destination.status;
  const model = createPrintPreview(spec(), destination.publicCode, bookingBase); diagnostics.textContent = model.diagnostics.join(" "); previewTitle.textContent = `${destination.publicCode} · ${destination.status}`; printButton.disabled = !model.scanSafe; downloadButton.disabled = !model.scanSafe;
  try { currentSvg = model.scanSafe ? await generateBrowserPrintQrSvg({ value: model.qrValue, accent: model.spec.accent, logoRequested: false }) : ""; preview.innerHTML = currentSvg || "QR preview unavailable until diagnostics pass."; } catch { currentSvg = ""; preview.textContent = "We could not create the printable QR code. Check the details above and try again."; }
}
function populate(values: readonly QrDestinationSummary[]): void { destinations.clear(); selector.replaceChildren(new Option("Choose a destination", "")); for (const value of values) { destinations.set(value.publicCode, value); selector.add(new Option(`${value.publicCode} · ${value.status}`, value.publicCode)); } if (values[0]) selector.value = values[0].publicCode; void render(); }
async function load(): Promise<void> { if (!tenantId) return show("denied", "Choose an authorized workspace before managing QR destinations."); show("loading", "Loading QR destinations…"); const result = await fetchQrDestinations(window.fetch.bind(window), apiBase, tenantId); if (result.kind === "ready") { populate(result.destinations); show("ready", `${result.destinations.length} destination${result.destinations.length === 1 ? "" : "s"} loaded.`); } else if (result.kind === "denied" || result.kind === "error") show(result.kind, result.message); else show("error", "QR destinations could not be loaded."); }
form.addEventListener("submit", async (event) => { event.preventDefault(); if (!tenantId) return show("denied", "Choose an authorized workspace before creating a QR destination."); const value = (query: string): string | null => document.querySelector<HTMLInputElement>(query)?.value.trim() || null; const input = { branchId: value("#qr-branch"), serviceId: value("#qr-service"), campaign: value("#qr-campaign") }; const result = await createQrDestination(window.fetch.bind(window), apiBase, tenantId, input); if (result.kind === "ready") { show("ready", "QR destination created."); form.reset(); await load(); selector.value = result.destination.publicCode; await render(); } else show("error", result.message); });
selector.addEventListener("change", () => { void render(); });
lifecycle.addEventListener("change", async () => { const destination = selected(); if (!destination || lifecycle.value === "expired") return; const result = await setQrDestinationStatus(window.fetch.bind(window), apiBase, tenantId, destination.publicCode, lifecycle.value as "active" | "paused" | "revoked"); if (result.kind === "error") { show("error", result.message); lifecycle.value = destination.status; return; } destination.status = result.status.status; show("ready", "QR destination status updated."); await render(); });
for (const input of form.querySelectorAll("input, select")) input.addEventListener("input", () => { void render(); });
printButton.addEventListener("click", () => window.print());
downloadButton.addEventListener("click", () => { if (!currentSvg) return; const link = document.createElement("a"); link.href = URL.createObjectURL(new Blob([currentSvg], { type: "image/svg+xml" })); link.download = `${selected()?.publicCode ?? "booking-qr"}.svg`; link.click(); URL.revokeObjectURL(link.href); });
void load();

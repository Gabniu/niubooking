// Ownership: compact tenant resource administration backed by the resource API.

import { createResource, fetchResources, setResourceStatus } from "./resources-client.js";

const root = document.querySelector<HTMLElement>("[data-resources-page]");
const form = document.querySelector<HTMLFormElement>("#resource-form");
const status = document.querySelector<HTMLElement>("#resource-status");
const list = document.querySelector<HTMLElement>("#resource-list");
const refresh = document.querySelector<HTMLButtonElement>("#refresh-resources");
if (!root || !form || !status || !list || !refresh) throw new Error("Resource workspace controls are incomplete");
const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
const statusElement = status;
const listElement = list;
function show(kind: string, message: string): void { statusElement.dataset.state = kind; statusElement.textContent = message; statusElement.hidden = false; }
function render(resources: readonly { id: string; name: string; resourceType: string; capabilities?: readonly string[]; status: "active" | "inactive" }[]): void { listElement.replaceChildren(); if (!resources.length) { listElement.textContent = "No resources configured for this workspace."; return; } for (const resource of resources) { const row = document.createElement("article"); row.className = "resource-row"; const heading = document.createElement("strong"); heading.textContent = resource.name; const meta = document.createElement("span"); meta.textContent = `${resource.resourceType}${resource.capabilities?.length ? ` · ${resource.capabilities.join(", ")}` : ""}`; const state = document.createElement("small"); state.className = `resource-status resource-status-${resource.status}`; state.textContent = resource.status; const button = document.createElement("button"); button.type = "button"; button.className = "account-button"; button.textContent = resource.status === "active" ? "Pause" : "Activate"; button.addEventListener("click", async () => { button.disabled = true; const next = resource.status === "active" ? "inactive" : "active"; const result = await setResourceStatus(window.fetch.bind(window), apiBase, tenantId, resource.id, next); if (result.kind === "ready") { show("ready", `${resource.name} is now ${next}.`); await load(); } else show("error", result.message); button.disabled = false; }); row.append(heading, meta, state, button); listElement.append(row); } }
async function load(): Promise<void> { if (!tenantId) return show("denied", "Choose an authorized workspace before managing resources."); show("loading", "Loading resources…"); const result = await fetchResources(window.fetch.bind(window), apiBase, tenantId); if (result.kind === "ready") { render(result.resources); show("ready", `${result.resources.length} resource${result.resources.length === 1 ? "" : "s"} loaded.`); } else show(result.kind, result.message); }
form.addEventListener("submit", async (event) => { event.preventDefault(); const name = document.querySelector<HTMLInputElement>("#resource-name")?.value.trim() ?? ""; const resourceType = document.querySelector<HTMLInputElement>("#resource-type")?.value.trim() ?? ""; const capabilities = (document.querySelector<HTMLInputElement>("#resource-capabilities")?.value ?? "").split(",").map((value) => value.trim()).filter(Boolean); if (!name || !resourceType) return show("error", "Enter a resource name and type."); const result = await createResource(window.fetch.bind(window), apiBase, tenantId, { name, resourceType, capabilities }); if (result.kind === "ready") { form.reset(); show("ready", `${result.resource.name} was added.`); await load(); } else show("error", result.message); });
refresh.addEventListener("click", () => { void load(); });
void load();

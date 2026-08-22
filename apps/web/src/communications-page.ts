// Ownership: authenticated communication-settings workspace; it never invents tenant data.

import { defaultBookingChangePolicy, type CommunicationSettings, type ReminderRule } from "@bookingapp/domain";
import type { CustomerContactMethodSummary } from "@bookingapp/contracts";
import { fetchCommunicationSettings, saveCommunicationSettings } from "./communication-settings-client.js";
import { fetchContactMethods, saveContactMethod } from "./contact-methods-client.js";
import { fetchCustomers } from "./customers-client.js";

const root = document.querySelector<HTMLElement>("[data-communications-page]");
if (!root) throw new Error("Communication settings root is missing");

const formElement = root.querySelector<HTMLFormElement>("#communication-settings-form");
const statusElement = root.querySelector<HTMLElement>("#communication-status");
const rulesListElement = root.querySelector<HTMLElement>("#reminder-rules");
const addRuleElement = root.querySelector<HTMLButtonElement>("#add-reminder-rule");
const contactFormElement = root.querySelector<HTMLElement>("#contact-method-form");
const contactListElement = root.querySelector<HTMLElement>("#contact-methods");
const contactSubmitElement = root.querySelector<HTMLButtonElement>("#save-contact-method");
const customerSelectElement = root.querySelector<HTMLSelectElement>("#contact-customer-id");
if (!formElement || !statusElement || !rulesListElement || !addRuleElement || !contactFormElement || !contactListElement || !contactSubmitElement || !customerSelectElement) throw new Error("Communication settings controls are incomplete");
const form = formElement;
const status = statusElement;
const rulesList = rulesListElement;
const addRule = addRuleElement;
const contactForm = contactFormElement;
const contactList = contactListElement;
const contactSubmit = contactSubmitElement;
const customerSelect = customerSelectElement;

const tenantId = root.dataset.tenantId || new URLSearchParams(location.search).get("tenant") || "";
const apiBase = root.dataset.apiBase || "";
let currentRules: ReminderRule[] = [];

function setStatus(kind: "loading" | "ready" | "error" | "denied", message: string): void {
  status.dataset.state = kind;
  status.textContent = message;
  status.hidden = false;
}

function field<T extends HTMLElement>(selector: string): T {
  const element = form.querySelector<T>(selector);
  if (!element) throw new Error(`Missing settings field: ${selector}`);
  return element;
}

function renderRules(): void {
  rulesList.replaceChildren();
  if (currentRules.length === 0) {
    const empty = document.createElement("p");
    empty.className = "rule-empty";
    empty.textContent = "No reminder rules configured. Add one to start sending appointment reminders.";
    rulesList.append(empty);
    return;
  }
  for (const rule of currentRules) {
    const row = document.createElement("article");
    row.className = "rule-row";
    row.dataset.ruleId = rule.id;
    row.innerHTML = `<label class="rule-enabled"><input data-field="enabled" type="checkbox" ${rule.enabled ? "checked" : ""} /> Enabled</label><label>Minutes before<input data-field="minutesBefore" type="number" min="1" step="1" value="${rule.minutesBefore}" /></label><label>Frequency cap (hours)<input data-field="frequencyCapHours" type="number" min="1" step="1" value="${rule.frequencyCapHours}" /></label><fieldset><legend>Channels</legend><label><input data-channel="email" type="checkbox" ${rule.channels.includes("email") ? "checked" : ""} /> Email</label><label><input data-channel="sms" type="checkbox" ${rule.channels.includes("sms") ? "checked" : ""} /> SMS</label><label><input data-channel="voice" type="checkbox" ${rule.channels.includes("voice") ? "checked" : ""} /> Voice</label></fieldset><button class="remove-rule" type="button">Remove</button>`;
    row.querySelector<HTMLButtonElement>(".remove-rule")?.addEventListener("click", () => { currentRules = currentRules.filter((item) => item.id !== rule.id); renderRules(); });
    rulesList.append(row);
  }
}

function renderSettings(settings: CommunicationSettings): void {
  const changePolicy = settings.bookingChangePolicy ?? defaultBookingChangePolicy;
  field<HTMLInputElement>("[name=remindersEnabled]").checked = settings.remindersEnabled;
  field<HTMLInputElement>("[name=feedbackEnabled]").checked = settings.feedbackEnabled;
  field<HTMLInputElement>("[name=timezone]").value = settings.timezone;
  field<HTMLInputElement>("[name=defaultFeedbackFrequencyDays]").value = String(settings.defaultFeedbackFrequencyDays);
  field<HTMLInputElement>("[name=rescheduleEnabled]").checked = changePolicy.rescheduleEnabled;
  field<HTMLInputElement>("[name=cancellationEnabled]").checked = changePolicy.cancellationEnabled;
  field<HTMLInputElement>("[name=minimumNoticeMinutes]").value = String(changePolicy.minimumNoticeMinutes);
  currentRules = settings.reminderRules.map((rule) => ({ ...rule, channels: [...rule.channels] }));
  renderRules();
  form.hidden = false;
}

function renderContactMethods(methods: readonly CustomerContactMethodSummary[]): void {
  contactList.replaceChildren();
  if (methods.length === 0) { contactList.textContent = "No contact methods captured yet."; return; }
  for (const method of methods) {
    const row = document.createElement("div");
    row.className = "contact-method-row";
    row.innerHTML = `<strong>${method.customerName ?? "Customer name unavailable"}</strong><span>${method.channel} · ${method.maskedDestination}</span><small>${method.verifiedAt ? "Verified" : "Pending verification"} · ${method.consentStatus}</small>`;
    contactList.append(row);
  }
}

async function loadContactMethods(): Promise<void> {
  const result = await fetchContactMethods(window.fetch.bind(window), apiBase, tenantId);
  if (result.kind === "ready") renderContactMethods(result.methods);
  else contactList.textContent = result.message;
}

async function loadCustomerOptions(): Promise<void> {
  const result = await fetchCustomers(window.fetch.bind(window), apiBase, tenantId);
  customerSelect.replaceChildren();
  if (result.kind !== "ready" || result.customers.length === 0) { customerSelect.add(new Option(result.kind === "ready" ? "Create a customer profile first" : result.message, "")); customerSelect.disabled = true; return; }
  customerSelect.add(new Option("Choose a customer", ""));
  for (const customer of result.customers) customerSelect.add(new Option(customer.displayName, customer.id));
  customerSelect.disabled = false;
}

function readSettings(): Omit<CommunicationSettings, "tenantId"> {
  const ruleRows = [...rulesList.querySelectorAll<HTMLElement>("[data-rule-id]")];
  const reminderRules = ruleRows.map((row) => {
    const channels = [...row.querySelectorAll<HTMLInputElement>("[data-channel]:checked")].map((input) => input.dataset.channel).filter((value): value is "email" | "sms" | "voice" => value === "email" || value === "sms" || value === "voice");
    const minutesBefore = Number(row.querySelector<HTMLInputElement>("[data-field=minutesBefore]")?.value);
    const frequencyCapHours = Number(row.querySelector<HTMLInputElement>("[data-field=frequencyCapHours]")?.value);
    if (!Number.isInteger(minutesBefore) || minutesBefore < 1 || !Number.isInteger(frequencyCapHours) || frequencyCapHours < 1 || channels.length === 0) throw new Error("Each reminder rule needs a positive offset, frequency cap, and at least one channel.");
    return { id: row.dataset.ruleId ?? "", enabled: row.querySelector<HTMLInputElement>("[data-field=enabled]")?.checked === true, minutesBefore, frequencyCapHours, channels, quietHoursStart: null, quietHoursEnd: null };
  });
  const defaultFeedbackFrequencyDays = Number(field<HTMLInputElement>("[name=defaultFeedbackFrequencyDays]").value);
  if (!Number.isInteger(defaultFeedbackFrequencyDays) || defaultFeedbackFrequencyDays < 1) throw new Error("Feedback frequency must be a positive number of days.");
  const minimumNoticeMinutes = Number(field<HTMLInputElement>("[name=minimumNoticeMinutes]").value);
  if (!Number.isInteger(minimumNoticeMinutes) || minimumNoticeMinutes < 0 || minimumNoticeMinutes > 43_200) throw new Error("Booking change notice must be between 0 and 30 days.");
  return { timezone: field<HTMLInputElement>("[name=timezone]").value.trim(), remindersEnabled: field<HTMLInputElement>("[name=remindersEnabled]").checked, feedbackEnabled: field<HTMLInputElement>("[name=feedbackEnabled]").checked, defaultFeedbackFrequencyDays, bookingChangePolicy: { rescheduleEnabled: field<HTMLInputElement>("[name=rescheduleEnabled]").checked, cancellationEnabled: field<HTMLInputElement>("[name=cancellationEnabled]").checked, minimumNoticeMinutes }, reminderRules };
}

addRule.addEventListener("click", () => { currentRules = [...currentRules, { id: `rule-${crypto.randomUUID()}`, enabled: true, minutesBefore: 1440, channels: ["email"], quietHoursStart: null, quietHoursEnd: null, frequencyCapHours: 24 }]; renderRules(); });
form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (!tenantId) return setStatus("denied", "Choose an authorized workspace before editing communication settings.");
  try {
    const settings = readSettings();
    setStatus("loading", "Saving communication settings...");
    const result = await saveCommunicationSettings(window.fetch.bind(window), apiBase, tenantId, settings);
    if (result.kind === "ready") { renderSettings(result.settings); setStatus("ready", "Communication settings saved."); }
    else setStatus(result.kind, result.message);
  } catch (error) { setStatus("error", error instanceof Error ? error.message : "Communication settings could not be saved."); }
});

contactSubmit.addEventListener("click", async () => {
  if (!tenantId) return setStatus("denied", "Choose an authorized workspace before adding contact methods.");
  const read = (name: string): string => contactForm.querySelector<HTMLInputElement | HTMLSelectElement>(`[name=${name}]`)?.value.trim() ?? "";
  try {
    setStatus("loading", "Saving contact method...");
    const result = await saveContactMethod(window.fetch.bind(window), apiBase, tenantId, { customerId: read("customerId"), channel: read("channel") as "email" | "sms" | "voice", destination: read("destination"), consentStatus: read("consentStatus") as "granted" | "denied" | "unknown" });
    if (result.kind === "ready") { renderContactMethods(result.methods); contactForm.querySelector<HTMLInputElement>("[name=customerId]")!.value = ""; contactForm.querySelector<HTMLInputElement>("[name=destination]")!.value = ""; setStatus("ready", "Contact method saved and awaiting verification."); }
    else setStatus(result.kind, result.message);
  } catch (error) { setStatus("error", error instanceof Error ? error.message : "Contact method could not be saved."); }
});

if (!tenantId) setStatus("denied", "Choose an authorized workspace to load communication settings.");
else { setStatus("loading", "Loading communication settings..."); Promise.all([fetchCommunicationSettings(window.fetch.bind(window), apiBase, tenantId), loadContactMethods(), loadCustomerOptions()]).then(([result]) => result.kind === "ready" ? renderSettings(result.settings) : setStatus(result.kind, result.message)).catch(() => setStatus("error", "Communication settings could not be loaded.")); }

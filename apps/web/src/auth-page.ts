// Ownership: compact shell sign-in action; the API owns the OIDC redirect and session cookie.

import { authUrl, sessionUrl } from "./auth-client.js";

const root = document.querySelector<HTMLElement>("body");
const apiBase = root?.dataset.apiBase ?? "";
const loginButtons = [...document.querySelectorAll<HTMLButtonElement>(".topbar-actions .account-button, .empty-actions .primary-button")];
for (const button of loginButtons) {
  button.addEventListener("click", () => { button.disabled = true; window.location.assign(authUrl(apiBase, "login")); });
}
void fetch(sessionUrl(apiBase), { credentials: "include" }).then((response) => response.ok ? response.json() as Promise<{ data?: { authenticated?: boolean } }> : null).then((result) => {
  if (!result?.data?.authenticated || !loginButtons.length) return;
  for (const button of loginButtons) { button.textContent = "Sign out"; button.disabled = false; button.onclick = async () => { button.disabled = true; await fetch(authUrl(apiBase, "logout"), { method: "POST", credentials: "include" }); window.location.reload(); }; }
}).catch(() => {});

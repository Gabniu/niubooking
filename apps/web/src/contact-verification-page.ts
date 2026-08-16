// Ownership: public verification page; it accepts only a short-lived challenge code.

import { verifyContactChallenge } from "./contact-verification-client.js";

const status = document.querySelector<HTMLElement>("#verification-status");
const codeInput = document.querySelector<HTMLInputElement>("#verification-code");
const verifyButton = document.querySelector<HTMLButtonElement>("#verify-contact");
if (!status || !codeInput || !verifyButton) throw new Error("Verification controls are incomplete");
const statusElement = status;
const challengeId = new URLSearchParams(location.search).get("challenge") ?? "";
const apiBase = new URLSearchParams(location.search).get("api") ?? "";
function show(kind: string, message: string): void { statusElement.dataset.state = kind; statusElement.textContent = message; }
verifyButton.addEventListener("click", async () => {
  const code = codeInput.value.trim();
  if (!challengeId) return show("error", "This verification link is incomplete.");
  if (!/^\d{6}$/.test(code)) return show("invalid", "Enter the six-digit code from your message.");
  verifyButton.disabled = true;
  show("loading", "Checking your code...");
  try {
    const result = await verifyContactChallenge(window.fetch.bind(window), apiBase, challengeId, code);
    show(result.kind, result.kind === "verified" ? "Contact method verified. You can close this page." : result.message);
  } catch { show("error", "Verification is temporarily unavailable. Try again shortly."); }
  finally { verifyButton.disabled = false; }
});

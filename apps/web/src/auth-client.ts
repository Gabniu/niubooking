// Ownership: browser navigation only; tokens stay in the Booking HttpOnly cookie.

export function authUrl(apiBase: string, action: "login" | "logout"): string {
  const base = apiBase.trim().replace(/\/$/u, "");
  return `${base}/auth/${action}`;
}

export function sessionUrl(apiBase: string): string {
  const base = apiBase.trim().replace(/\/$/u, "");
  return `${base}/auth/session`;
}

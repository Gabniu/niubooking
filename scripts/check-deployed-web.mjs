// Ownership: release smoke gate for the deployed Next route inventory; health alone is not web acceptance.

const baseUrl = (process.env.BOOKING_DEPLOYMENT_BASE_URL ?? "").replace(/\/$/u, "");
if (!baseUrl) {
  console.error("Set BOOKING_DEPLOYMENT_BASE_URL to the deployed web origin before running this gate.");
  process.exit(2);
}

const routes = [
  "/", "/auth/sign-in", "/app", "/app/communications", "/app/customers",
  "/app/feedback", "/app/gtfs", "/app/occurrences", "/app/pack-settings",
  "/app/packs", "/app/qr-studio", "/app/resources", "/app/schedule",
  "/app/service-composition", "/app/services", "/app/transport",
  "/book/example-code", "/feedback/example-capability", "/manage/example-token",
  "/reserve/example-code", "/ticket/example-token", "/trip/example-code",
  "/verify-contact/example-challenge",
];

const results = await Promise.all(routes.map(async (route) => {
  try {
    const response = await fetch(`${baseUrl}${route}`, { redirect: "manual", signal: AbortSignal.timeout(15_000) });
    const body = await response.text();
    const isNextPage = response.status === 200 && body.includes("__next_f.push");
    return { route, status: response.status, ok: isNextPage, reason: isNextPage ? "Next page" : "expected a 200 Next response" };
  } catch (error) {
    return { route, status: "error", ok: false, reason: error instanceof Error ? error.message : "request failed" };
  }
}));

for (const result of results) console.log(`${result.ok ? "PASS" : "FAIL"} ${result.status} ${result.route} — ${result.reason}`);
const failures = results.filter((result) => !result.ok);
if (failures.length) {
  console.error(`${failures.length} deployed route${failures.length === 1 ? "" : "s"} failed the Next web smoke gate.`);
  process.exit(1);
}
console.log(`Deployed web gate passed: ${results.length} Next routes are present at ${baseUrl}.`);

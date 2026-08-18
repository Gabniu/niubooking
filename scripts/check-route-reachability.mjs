import { access, readFile } from "node:fs/promises";
import path from "node:path";

const root = process.cwd();
const failures = [];

const routes = [
  ["/", "apps/web/app/page.tsx", "public", "public home"],
  ["/auth/sign-in", "apps/web/app/auth/sign-in/page.tsx", "public", "public home"],
  ["/auth/login", "apps/web/app/auth/login/route.ts", "auth", "sign-in action"],
  ["/auth/callback", "apps/web/app/auth/callback/route.ts", "auth", "identity provider"],
  ["/app", "apps/web/app/app/page.tsx", "staff", "workspace shell"],
  ["/app/schedule", "apps/web/app/app/schedule/page.tsx", "staff", "workspace navigation"],
  ["/app/customers", "apps/web/app/app/customers/page.tsx", "staff", "workspace navigation"],
  ["/app/services", "apps/web/app/app/services/page.tsx", "staff", "workspace navigation"],
  ["/app/service-composition", "apps/web/app/app/service-composition/page.tsx", "staff", "service Configure action"],
  ["/app/resources", "apps/web/app/app/resources/page.tsx", "staff", "workspace navigation"],
  ["/app/occurrences", "apps/web/app/app/occurrences/page.tsx", "staff", "workspace navigation"],
  ["/app/feedback", "apps/web/app/app/feedback/page.tsx", "staff", "workspace navigation"],
  ["/app/communications", "apps/web/app/app/communications/page.tsx", "staff", "workspace navigation"],
  ["/app/packs", "apps/web/app/app/packs/page.tsx", "staff", "workspace navigation"],
  ["/app/pack-settings", "apps/web/app/app/pack-settings/page.tsx", "staff", "workspace navigation"],
  ["/app/qr-studio", "apps/web/app/app/qr-studio/page.tsx", "staff", "workspace navigation"],
  ["/book/[code]", "apps/web/app/book/[code]/page.tsx", "public", "QR or booking link"],
  ["/reserve/[code]", "apps/web/app/reserve/[code]/page.tsx", "public", "QR or occurrence link"],
  ["/manage/[token]", "apps/web/app/manage/[token]/page.tsx", "public", "confirmation/reminder link"],
  ["/feedback/[capability]", "apps/web/app/feedback/[capability]/page.tsx", "public", "feedback message/link"],
  ["/verify-contact/[challenge]", "apps/web/app/verify-contact/[challenge]/page.tsx", "public", "verification message"],
];

const staffNavigation = [
  "/app", "/app/schedule", "/app/customers", "/app/services", "/app/resources",
  "/app/occurrences", "/app/feedback", "/app/communications", "/app/packs",
  "/app/pack-settings", "/app/qr-studio",
];

async function exists(relativePath) {
  try {
    await access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

for (const [route, file, audience, entrypoint] of routes) {
  if (!(await exists(file))) failures.push(`${route} (${audience}) is missing its route file: ${file}`);
  if (audience === "public" && !entrypoint) failures.push(`${route} is missing an explicit public entrypoint.`);
}

const shell = await readFile(path.join(root, "apps/web/app/components/workspace-shell.tsx"), "utf8");
for (const href of staffNavigation) {
  if (!shell.includes(`"${href}"`)) failures.push(`Staff route ${href} is not present in workspace navigation.`);
}

const servicesPage = await readFile(path.join(root, "apps/web/app/components/services-page.tsx"), "utf8");
if (!servicesPage.includes("/app/service-composition")) {
  failures.push("Service composition has no contextual Configure entrypoint from the services page.");
}

const packPage = await readFile(path.join(root, "apps/web/app/app/packs/page.tsx"), "utf8");
if (!packPage.includes("/app/pack-settings")) failures.push("Pack settings has no entrypoint from the pack catalog.");

const home = await readFile(path.join(root, "apps/web/app/components/public-home.tsx"), "utf8");
if (!home.includes("/auth/sign-in")) failures.push("Public home has no staff sign-in entrypoint.");

const homeState = await readFile(path.join(root, "apps/web/app/components/workspace-home-state.tsx"), "utf8");
for (const href of ["/auth/sign-in", "/app/schedule", "/app/pack-settings"]) {
  if (!homeState.includes(href)) failures.push(`Workspace home state is missing recovery/action link ${href}.`);
}

if (failures.length) {
  console.error("Route reachability gate failed:\n" + failures.map((failure) => `- ${failure}`).join("\n"));
  process.exitCode = 1;
} else {
  const staffCount = routes.filter(([, , audience]) => audience === "staff").length;
  const publicCount = routes.filter(([, , audience]) => audience === "public").length;
  console.log(`Route reachability gate passed: ${staffCount} staff, ${publicCount} public, and ${routes.length - staffCount - publicCount} auth routes are wired with entrypoints.`);
}

// Ownership: production web bridge; Next serves migrated routes while legacy pages remain available during migration.
import { spawn } from "node:child_process";
import { createServer, request as httpRequest } from "node:http";

const root = process.cwd();
const nextPort = 4174;
const legacyPort = 4175;
const proxyPort = Number(process.env.PORT ?? 4173);
const children = [];

function start(command, args, env = {}) {
  const child = spawn(command, args, { cwd: root, env: { ...process.env, ...env }, stdio: "inherit", shell: false, windowsHide: true });
  children.push(child);
  return child;
}

function nextRequest(pathname) {
  return pathname === "/" || pathname === "/index.html" || pathname === "/app" || pathname === "/app.html" || pathname.startsWith("/app/") || pathname.startsWith("/manage/") || pathname.startsWith("/book/") || pathname.startsWith("/feedback/") || pathname.startsWith("/reserve/") || pathname.startsWith("/trip/") || pathname.startsWith("/ticket/") || pathname.startsWith("/verify-contact/") || pathname.startsWith("/_next/") || pathname.startsWith("/auth/");
}

function proxy(request, response, port) {
  const upstream = httpRequest({ hostname: "127.0.0.1", port, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${port}` } }, (result) => { response.writeHead(result.statusCode ?? 502, result.headers); result.pipe(response); });
  upstream.on("error", () => response.writeHead(502).end("Web service is starting. Please retry."));
  request.pipe(upstream);
}

function ready(port) {
  return new Promise((resolve) => { const check = () => { const probe = httpRequest({ hostname: "127.0.0.1", port, path: "/", method: "GET" }, (response) => { response.resume(); resolve(response.statusCode !== undefined); }); probe.on("error", () => setTimeout(check, 250)); probe.end(); }; check(); });
}

start(process.execPath, [process.env.BOOKING_NEXT_SERVER_PATH ?? "apps/web/server.js"], { HOSTNAME: "127.0.0.1", PORT: String(nextPort), NODE_ENV: "production" });
start(process.execPath, ["scripts/serve-web.mjs"], { HOST: "127.0.0.1", PORT: String(legacyPort), BOOKING_WEB_ROOT: process.env.BOOKING_LEGACY_WEB_ROOT ?? "legacy-web", BOOKING_CONTRACTS_ROOT: "packages/contracts/dist" });
await ready(nextPort);
await ready(legacyPort);

const server = createServer((request, response) => proxy(request, response, nextRequest(request.url ?? "/") ? nextPort : legacyPort));
server.listen(proxyPort, "0.0.0.0", () => console.log(`Booking Next/legacy production web: http://0.0.0.0:${proxyPort}`));

function shutdown() { server.close(); for (const child of children) child.kill(); process.exit(0); }
process.on("exit", () => { for (const child of children) child.kill(); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);

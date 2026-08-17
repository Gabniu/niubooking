// Ownership: local browser-test bridge; Next owns migrated routes and the static server owns legacy fixtures.
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
  return pathname === "/" || pathname === "/index.html" || pathname === "/app" || pathname === "/app.html" || pathname.startsWith("/app/") || pathname.startsWith("/manage/") || pathname.startsWith("/book/") || pathname.startsWith("/feedback/") || pathname.startsWith("/reserve/") || pathname.startsWith("/_next/") || pathname.startsWith("/auth/");
}

function proxy(request, response, port) {
  const upstream = httpRequest({ hostname: "127.0.0.1", port, path: request.url, method: request.method, headers: { ...request.headers, host: `127.0.0.1:${port}` } }, (result) => {
    response.writeHead(result.statusCode ?? 502, result.headers);
    result.pipe(response);
  });
  upstream.on("error", () => response.writeHead(502).end("Web service is starting. Please retry."));
  request.pipe(upstream);
}

function ready(port) {
  return new Promise((resolve) => {
    const check = () => {
      const probe = httpRequest({ hostname: "127.0.0.1", port, path: "/", method: "GET" }, (response) => {
        response.resume();
        resolve(response.statusCode !== undefined);
      });
      probe.on("error", () => setTimeout(check, 250));
      probe.end();
    };
    check();
  });
}

const npmCommand = process.platform === "win32" ? "cmd.exe" : "npm";
const npmArgs = process.platform === "win32" ? ["/d", "/s", "/c", "npm run dev --workspace @bookingapp/web -- -p 4174"] : ["run", "dev", "--workspace", "@bookingapp/web", "--", "-p", String(nextPort)];
start(npmCommand, npmArgs);
start(process.execPath, ["scripts/serve-web.mjs"], { PORT: String(legacyPort) });
await ready(nextPort);
await ready(legacyPort);

const server = createServer((request, response) => proxy(request, response, nextRequest(request.url ?? "/") ? nextPort : legacyPort));
server.listen(proxyPort, "127.0.0.1", () => console.log(`Booking Next/legacy web: http://127.0.0.1:${proxyPort}`));

function shutdown() {
  server.close();
  for (const child of children) child.kill();
  process.exit(0);
}
process.on("exit", () => { for (const child of children) child.kill(); });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, shutdown);

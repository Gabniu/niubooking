import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

const root = path.resolve(process.cwd(), process.env.BOOKING_WEB_ROOT ?? path.join("apps", "web"));
const packageRoot = path.resolve(process.cwd(), process.env.BOOKING_CONTRACTS_ROOT ?? path.join("packages", "contracts", "dist"));
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST?.trim() || "127.0.0.1";
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".ts", "text/javascript; charset=utf-8"],
]);

function injectWorkspaceScripts(html) {
  if (html.includes("dist/workspace-shell.js")) return html;
  const scripts = [
    '<script type="module" src="./dist/workspace-shell.js"></script>',
    html.includes("dist/auth-page.js") ? "" : '<script type="module" src="./dist/auth-page.js"></script>',
  ].join("");
  return html.replace("</body>", `${scripts}</body>`);
}

function resolveRequestPath(requestUrl = "/") {
  const pathname = decodeURIComponent(new URL(requestUrl, "http://localhost").pathname);
  if (pathname.startsWith("/_packages/contracts/")) {
    const packagePath = path.resolve(packageRoot, pathname.slice("/_packages/contracts/".length));
    return packagePath === packageRoot || packagePath.startsWith(`${packageRoot}${path.sep}`) ? packagePath : undefined;
  }
  const requested = pathname === "/" ? "index.html" : pathname.slice(1);
  const absolute = path.resolve(root, requested);
  return absolute === root || absolute.startsWith(`${root}${path.sep}`) ? absolute : undefined;
}

const server = createServer(async (request, response) => {
  const absolute = resolveRequestPath(request.url);
  if (!absolute) {
    response.writeHead(403).end("Forbidden");
    return;
  }
  try {
    const details = await stat(absolute);
    if (!details.isFile()) throw new Error("Not a file");
    if (path.extname(absolute) === ".html") {
      const html = injectWorkspaceScripts(await readFile(absolute, "utf8"));
      response.writeHead(200, {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
      });
      response.end(html);
      return;
    }
    response.writeHead(200, {
      "Content-Type": mimeTypes.get(path.extname(absolute)) ?? "application/octet-stream",
      "Cache-Control": "no-store",
    });
    createReadStream(absolute).pipe(response);
  } catch {
    response.writeHead(404).end("Not found");
  }
});

server.listen(port, host, () => console.log(`Booking web fixture: http://${host}:${port}`));

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.close(() => process.exit(0)));
}

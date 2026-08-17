// Ownership: internal worker liveness/readiness surface. It exposes counters only, never jobs, destinations, or provider details.

import { createServer, type Server } from "node:http";
import type { WorkerRuntime } from "./worker-runtime.js";

function sendJson(response: import("node:http").ServerResponse, status: number, body: unknown): void {
  const payload = JSON.stringify(body);
  response.statusCode = status;
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(payload);
}

export function createWorkerHealthServer(runtime: WorkerRuntime): Server {
  return createServer((request, response) => {
    if (request.method !== "GET") return sendJson(response, 405, { status: "method_not_allowed" });
    if (request.url === "/health/live") return sendJson(response, 200, { status: "ok", service: "booking-worker" });
    if (request.url === "/health/ready") {
      const health = runtime.health();
      return sendJson(response, health.status === "ready" ? 200 : 503, { service: "booking-worker", ...health });
    }
    return sendJson(response, 404, { status: "not_found" });
  });
}

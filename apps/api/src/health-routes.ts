import type { FastifyInstance } from "fastify";

export interface HealthCheck {
  check(): Promise<boolean>;
}

export function registerHealthRoutes(app: FastifyInstance, health?: HealthCheck): void {
  app.get("/health/live", async (_request, reply) => reply.send({ status: "ok", service: "booking-api" }));
  app.get("/health/ready", async (_request, reply) => {
    if (!health) return reply.code(503).send({ status: "not_ready", service: "booking-api", reason: "Readiness is not configured." });
    try {
      return await health.check() ? reply.send({ status: "ready", service: "booking-api" }) : reply.code(503).send({ status: "not_ready", service: "booking-api" });
    } catch {
      return reply.code(503).send({ status: "not_ready", service: "booking-api" });
    }
  });
}

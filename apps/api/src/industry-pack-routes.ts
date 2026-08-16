// Ownership: read-only catalog of code-reviewed pack manifests.

import type { FastifyInstance } from "fastify";
import { defaultIndustryPackRegistry } from "@bookingapp/domain";
export interface IndustryPackRouteDependencies { list?(): readonly unknown[]; }
export function registerIndustryPackRoutes(app: FastifyInstance, dependencies: IndustryPackRouteDependencies = {}): void { app.get("/v1/industry-packs", async (_request, reply) => { try { const data = dependencies.list ? dependencies.list() : defaultIndustryPackRegistry.list(); return reply.send({ data, error: null }); } catch { return reply.code(503).send({ data: null, error: { code: "PACKS_UNAVAILABLE", message: "Industry packs are temporarily unavailable." } }); } }); }
